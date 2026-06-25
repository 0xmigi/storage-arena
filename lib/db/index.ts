import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Dual driver:
//   - DATABASE_URL set  → postgres-js (Neon/Supabase/remote) for real,
//     multi-user persistence in production.
//   - DATABASE_URL unset → PGlite, an in-process Postgres (a local file).
//     Zero install, real Postgres semantics — same schema/queries either way.
//
// The ready-promise is pinned on globalThis: Next bundles each API route
// separately, so a plain module-level singleton gives EACH route its own DB
// instance. With PGlite (single-writer, file-locked) that means the upload
// route and the read routes open different instances → writes are invisible to
// reads and the lock conflicts. One shared instance per process fixes it.
const _g = globalThis as unknown as { __dbReady?: Promise<any> };

// One statement per entry. PGlite's extended-query protocol rejects multiple
// commands in a single execute(), so we run these sequentially rather than as
// one semicolon-joined string. ALTERs make this idempotent for older DBs.
const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS runs (
    id uuid PRIMARY KEY,
    backend text NOT NULL,
    bytes integer NOT NULL,
    ms integer NOT NULL,
    live boolean NOT NULL DEFAULT false,
    blob_id text,
    blob_url text,
    user_id text,
    ip text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE runs ADD COLUMN IF NOT EXISTS ip text`,
  `CREATE INDEX IF NOT EXISTS runs_created_at_idx ON runs (created_at)`,
  `CREATE TABLE IF NOT EXISTS contestant_requests (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

async function init() {
  let db: any;
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    db = drizzle(postgres(url, { prepare: false }), { schema });
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const fs = await import("fs");
    fs.mkdirSync(".data", { recursive: true }); // PGlite's own mkdir isn't recursive
    const client = new PGlite(".data/pglite");
    db = drizzle(client, { schema });
  }
  for (const stmt of DDL) await db.execute(sql.raw(stmt));
  return db;
}

export async function getDb() {
  if (!_g.__dbReady) _g.__dbReady = init();
  return _g.__dbReady;
}
