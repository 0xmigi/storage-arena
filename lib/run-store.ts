import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { runs, RunInsert } from "./db/schema";
import { BackendId } from "./backends";

export interface BackendAverage {
  backend: BackendId;
  avgMs: number;
  avgBytes: number;
  count: number;
}

// A linear (affine) least-squares fit of ms-vs-bytes for one network, so the
// simulation can extrapolate to any size: predicted ms ≈ intercept + slope·bytes.
// slope/intercept are null when there's <2 points or no spread in bytes (a
// single size cluster), which the client treats as "can't extrapolate yet".
export interface BackendFit {
  backend: BackendId;
  slope: number | null; // ms per byte
  intercept: number | null; // ms at 0 bytes (the fixed startup cost)
  n: number;
  minBytes: number;
  maxBytes: number;
  avgMs: number;
}

// Insert one run. Never throws — a persistence hiccup must not fail an upload.
export async function recordRun(r: RunInsert): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(runs).values({ id: randomUUID(), ...r });
  } catch (e) {
    console.error("recordRun failed:", e);
  }
}

// Count runs in the last `windowMs` (optionally for one IP) — for rate limiting.
// Fails OPEN (returns 0) if the DB is unavailable; the R2 lifecycle rule is the
// hard, DB-independent cost cap.
export async function recentRuns(windowMs: number, ip?: string): Promise<number> {
  try {
    const db = await getDb();
    const cutoff = new Date(Date.now() - windowMs);
    const where = ip
      ? sql`${runs.createdAt} > ${cutoff} and ${runs.ip} = ${ip}`
      : sql`${runs.createdAt} > ${cutoff}`;
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(runs)
      .where(where);
    return rows[0]?.c ?? 0;
  } catch (e) {
    console.error("recentRuns failed:", e);
    return 0;
  }
}

// Per-backend linear fit of ms vs bytes over real recorded runs — the basis
// for extrapolating the simulation to any file size. Uses Postgres regression
// aggregates (regr_slope/regr_intercept return null with <2 distinct x-values).
export async function getFits(): Promise<BackendFit[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        backend: runs.backend,
        slope: sql<number | null>`regr_slope(${runs.ms}, ${runs.bytes})`,
        intercept: sql<number | null>`regr_intercept(${runs.ms}, ${runs.bytes})`,
        n: sql<number>`count(*)::int`,
        minBytes: sql<number>`min(${runs.bytes})::int`,
        maxBytes: sql<number>`max(${runs.bytes})::int`,
        avgMs: sql<number>`round(avg(${runs.ms}))::int`,
      })
      .from(runs)
      .where(sql`${runs.live} = true`)
      .groupBy(runs.backend);
    // Coerce — pg numeric types can surface as strings.
    return rows.map((r: any) => ({
      backend: r.backend,
      slope: r.slope == null ? null : Number(r.slope),
      intercept: r.intercept == null ? null : Number(r.intercept),
      n: Number(r.n),
      minBytes: Number(r.minBytes),
      maxBytes: Number(r.maxBytes),
      avgMs: Number(r.avgMs),
    })) as BackendFit[];
  } catch (e) {
    console.error("getFits failed:", e);
    return [];
  }
}

// Record a "request a contestant" suggestion.
export async function recordRequest(name: string, note?: string): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      sql`insert into contestant_requests (id, name, note) values (${randomUUID()}, ${name}, ${note ?? null})`
    );
  } catch (e) {
    console.error("recordRequest failed:", e);
  }
}

// Per-backend average of REAL recorded runs — what drives the simulation.
// `nearBytes` (optional) restricts to runs of a similar file size, so the
// simulation shows "the average speed for THIS size" rather than blending a
// 1 KB run with a 1 MB one. SIZE_BAND is a multiplicative window each side.
const SIZE_BAND = 4;
export async function getAverages(nearBytes?: number): Promise<BackendAverage[]> {
  try {
    const db = await getDb();
    const live = sql`${runs.live} = true`;
    const where =
      nearBytes && nearBytes > 0
        ? sql`${live} and ${runs.bytes} between ${Math.round(nearBytes / SIZE_BAND)} and ${Math.round(
            nearBytes * SIZE_BAND
          )}`
        : live;
    const rows = await db
      .select({
        backend: runs.backend,
        avgMs: sql<number>`round(avg(${runs.ms}))::int`,
        avgBytes: sql<number>`round(avg(${runs.bytes}))::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(runs)
      .where(where)
      .groupBy(runs.backend);
    return rows as BackendAverage[];
  } catch (e) {
    console.error("getAverages failed:", e);
    return [];
  }
}
