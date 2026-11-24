import crypto from "node:crypto";
import { dbClient } from "@/db";

const CREATE_TABLES_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS user (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified integer DEFAULT 0 NOT NULL,
    image text,
    accent_color text DEFAULT 'teal' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email)`,
  `CREATE TABLE IF NOT EXISTS session (
    id text PRIMARY KEY NOT NULL,
    expires_at integer NOT NULL,
    token text NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    ip_address text,
    user_agent text,
    user_id text NOT NULL REFERENCES user(id) ON DELETE cascade
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS session_token_unique ON session (token)`,
  `CREATE TABLE IF NOT EXISTS account (
    id text PRIMARY KEY NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at integer,
    refresh_token_expires_at integer,
    scope text,
    password text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS verification (
    id text PRIMARY KEY NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at integer NOT NULL,
    created_at integer,
    updated_at integer
  )`,
  `CREATE TABLE IF NOT EXISTS friendship (
    id text PRIMARY KEY NOT NULL,
    requester_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
    addressee_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
    status text DEFAULT 'pending' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    CONSTRAINT friendship_no_self CHECK (requester_id <> addressee_id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS friendship_pair_unique ON friendship (requester_id, addressee_id)`,
  `CREATE TABLE IF NOT EXISTS food_group (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    is_personal integer DEFAULT 0 NOT NULL,
    created_by text REFERENCES user(id) ON DELETE set null,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS group_member (
    id text PRIMARY KEY NOT NULL,
    group_id text NOT NULL REFERENCES food_group(id) ON DELETE cascade,
    user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
    role text DEFAULT 'member' NOT NULL,
    joined_at integer NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS group_member_unique ON group_member (group_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS place (
    id text PRIMARY KEY NOT NULL,
    group_id text NOT NULL REFERENCES food_group(id) ON DELETE cascade,
    name text NOT NULL,
    address text DEFAULT '' NOT NULL,
    service_type text DEFAULT 'dine_in' NOT NULL,
    meals text NOT NULL,
    created_by text REFERENCES user(id) ON DELETE set null,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rating (
    id text PRIMARY KEY NOT NULL,
    place_id text NOT NULL REFERENCES place(id) ON DELETE cascade,
    user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
    score real NOT NULL,
    note text DEFAULT '' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    CONSTRAINT rating_score_range CHECK (score >= 1 AND score <= 10)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rating_place_user_unique ON rating (place_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS place_visit (
    id text PRIMARY KEY NOT NULL,
    place_id text NOT NULL REFERENCES place(id) ON DELETE cascade,
    visited_at text DEFAULT '' NOT NULL,
    created_by text REFERENCES user(id) ON DELETE set null,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS visit_entry (
    id text PRIMARY KEY NOT NULL,
    visit_id text NOT NULL REFERENCES place_visit(id) ON DELETE cascade,
    user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
    dish text DEFAULT '' NOT NULL,
    score real NOT NULL,
    note text DEFAULT '' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    CONSTRAINT visit_entry_score_range CHECK (score >= 1 AND score <= 10)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS visit_entry_visit_user_unique ON visit_entry (visit_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS place_photo (
    id text PRIMARY KEY NOT NULL,
    place_id text NOT NULL REFERENCES place(id) ON DELETE cascade,
    visit_id text REFERENCES place_visit(id) ON DELETE set null,
    user_id text REFERENCES user(id) ON DELETE set null,
    filename text NOT NULL,
    mime_type text NOT NULL,
    caption text DEFAULT '' NOT NULL,
    created_at integer NOT NULL
  )`,
];

const COLUMN_MIGRATIONS: Array<{ table: string; column: string; ddl: string }> = [
  {
    table: "food_group",
    column: "is_personal",
    ddl: "ALTER TABLE food_group ADD COLUMN is_personal integer NOT NULL DEFAULT 0",
  },
  {
    table: "place",
    column: "service_type",
    ddl: "ALTER TABLE place ADD COLUMN service_type text NOT NULL DEFAULT 'dine_in'",
  },
  {
    table: "place_photo",
    column: "visit_id",
    ddl: "ALTER TABLE place_photo ADD COLUMN visit_id text REFERENCES place_visit(id) ON DELETE set null",
  },
];

async function hasColumn(table: string, column: string): Promise<boolean> {
  const result = await dbClient.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => String(row.name) === column);
}

/**
 * Backfills legacy place ratings into an initial visit ("Visita #1") for places that have
 * ratings but no recorded visits yet. Idempotent and non-destructive.
 */
async function backfillLegacyRatingsIntoVisits(): Promise<number> {
  const placesToBackfill = await dbClient.execute(`
    SELECT DISTINCT r.place_id
    FROM rating r
    WHERE NOT EXISTS (
      SELECT 1 FROM place_visit v WHERE v.place_id = r.place_id
    )
  `);

  let migratedPlaces = 0;

  for (const row of placesToBackfill.rows) {
    const placeId = String(row.place_id);
    const ratingsRes = await dbClient.execute({
      sql: `SELECT user_id, score, note, created_at, updated_at FROM rating WHERE place_id = ?`,
      args: [placeId],
    });
    if (ratingsRes.rows.length === 0) continue;

    const visitId = crypto.randomUUID();
    const earliestCreatedAt = Math.min(
      ...ratingsRes.rows.map((r) => Number(r.created_at) || Math.floor(Date.now() / 1000)),
    );
    const latestUpdatedAt = Math.max(
      ...ratingsRes.rows.map((r) => Number(r.updated_at) || earliestCreatedAt),
    );
    const firstRow = ratingsRes.rows[0];
    if (!firstRow) continue;
    const firstUserId = String(firstRow.user_id);

    await dbClient.batch(
      [
        {
          sql: `INSERT INTO place_visit (id, place_id, visited_at, created_by, created_at, updated_at)
                VALUES (?, ?, '', ?, ?, ?)`,
          args: [visitId, placeId, firstUserId, earliestCreatedAt, latestUpdatedAt],
        },
        ...ratingsRes.rows.map((r) => ({
          sql: `INSERT OR IGNORE INTO visit_entry (id, visit_id, user_id, dish, score, note, created_at, updated_at)
                VALUES (?, ?, ?, '', ?, ?, ?, ?)`,
          args: [
            crypto.randomUUID(),
            visitId,
            String(r.user_id),
            Number(r.score),
            String(r.note ?? ""),
            Number(r.created_at) || earliestCreatedAt,
            Number(r.updated_at) || latestUpdatedAt,
          ],
        })),
        {
          sql: `UPDATE place_photo SET visit_id = ? WHERE place_id = ? AND visit_id IS NULL`,
          args: [visitId, placeId],
        },
      ],
      "write",
    );

    migratedPlaces++;
  }

  return migratedPlaces;
}

/**
 * Applies additive, idempotent SQLite schema migrations without dropping or rewriting tables.
 */
async function main() {
  for (const statement of CREATE_TABLES_SQL) {
    await dbClient.execute(statement);
  }

  let applied = 0;
  for (const migration of COLUMN_MIGRATIONS) {
    const exists = await hasColumn(migration.table, migration.column);
    if (!exists) {
      await dbClient.execute(migration.ddl);
      applied++;
      console.log(`Migración aplicada: ${migration.table}.${migration.column}`);
    }
  }

  const backfilled = await backfillLegacyRatingsIntoVisits();
  if (backfilled > 0) {
    console.log(`Backfill de visitas completado: ${backfilled} lugares convertidos a Visita #1.`);
  }

  console.log(
    applied > 0 || backfilled > 0
      ? `Migración completada (${applied} columnas, ${backfilled} lugares migrados a visitas).`
      : "Esquema al día (sin cambios pendientes).",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error aplicando migraciones:", err);
    process.exit(1);
  });
