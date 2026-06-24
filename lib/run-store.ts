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

// Insert one run. Never throws — a persistence hiccup must not fail an upload.
export async function recordRun(r: RunInsert): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(runs).values({ id: randomUUID(), ...r });
  } catch (e) {
    console.error("recordRun failed:", e);
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

// Per-backend aggregates across every run ever — the crowd-sourced averages
// that feed the signed-out demo recording.
export async function getAverages(): Promise<BackendAverage[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        backend: runs.backend,
        avgMs: sql<number>`round(avg(${runs.ms}))::int`,
        avgBytes: sql<number>`round(avg(${runs.bytes}))::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(runs)
      .where(sql`${runs.live} = true`)
      .groupBy(runs.backend);
    return rows as BackendAverage[];
  } catch (e) {
    console.error("getAverages failed:", e);
    return [];
  }
}
