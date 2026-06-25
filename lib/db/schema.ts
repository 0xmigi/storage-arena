import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// One row per real (or modeled) upload anyone runs. Aggregated into the
// per-backend averages that drive the signed-out demo recording.
export const runs = pgTable("runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  backend: text("backend").notNull(), // tapedrive | walrus | ipfs | s3
  bytes: integer("bytes").notNull(),
  ms: integer("ms").notNull(),
  live: boolean("live").notNull().default(false), // real upload vs modeled
  blobId: text("blob_id"),
  blobUrl: text("blob_url"), // public, shareable retrieval URL
  userId: text("user_id"), // null until auth is wired
  ip: text("ip"), // for rate limiting
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RunInsert = typeof runs.$inferInsert;
export type RunRow = typeof runs.$inferSelect;
