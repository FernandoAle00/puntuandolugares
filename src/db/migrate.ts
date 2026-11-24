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
  `CREATE TABLE IF NOT EXISTS place_photo (
    id text PRIMARY KEY NOT NULL,
    place_id text NOT NULL REFERENCES place(id) ON DELETE cascade,
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
];

async function hasColumn(table: string, column: string): Promise<boolean> {
  const result = await dbClient.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => String(row.name) === column);
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

  console.log(
    applied > 0
      ? `Migración completada (${applied} cambio${applied === 1 ? "" : "s"}).`
      : "Esquema al día (sin cambios pendientes).",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error aplicando migraciones:", err);
    process.exit(1);
  });
