import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Dual driver:
//   - DATABASE_URL set  → postgres-js (Neon/Supabase/remote) for real,
//     multi-user persistence in production.
//   - DATABASE_URL unset → PGlite, an in-process Postgres (a local file).
//     Zero install, real Postgres semantics — same schema/queries either way.
let _db: any = null;
let _ready: Promise<any> | null = null;

const DDL = `
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY,
  backend text NOT NULL,
  bytes integer NOT NULL,
  ms integer NOT NULL,
  live boolean NOT NULL DEFAULT false,
  blob_id text,
  blob_url text,
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contestant_requests (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

async function init() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    _db = drizzle(postgres(url, { prepare: false }), { schema });
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const fs = await import("fs");
    fs.mkdirSync(".data", { recursive: true }); // PGlite's own mkdir isn't recursive
    const client = new PGlite(".data/pglite");
    _db = drizzle(client, { schema });
  }
  await _db.execute(sql.raw(DDL));
  return _db;
}

export async function getDb() {
  if (_db) return _db;
  if (!_ready) _ready = init();
  return _ready;
}
