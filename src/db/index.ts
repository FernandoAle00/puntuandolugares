import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { schema } from "./schema";

const DEFAULT_DB_URL = "file:./data/puntuando.db";

function ensureLocalDbDir(url: string) {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  if (!filePath || filePath === ":memory:") return;
  const dir = path.dirname(path.resolve(process.cwd(), filePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const globalForDb = globalThis as unknown as {
  libsqlClient?: Client;
  drizzleDb?: LibSQLDatabase<typeof schema>;
};

function createDb() {
  const url = process.env.DATABASE_URL || DEFAULT_DB_URL;
  ensureLocalDbDir(url);

  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  // Enable foreign keys for local SQLite connections
  if (url.startsWith("file:")) {
    void client.execute("PRAGMA foreign_keys = ON;");
  }

  return { client, db: drizzle(client, { schema }) };
}

const instance = globalForDb.drizzleDb
  ? { client: globalForDb.libsqlClient!, db: globalForDb.drizzleDb }
  : createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.libsqlClient = instance.client;
  globalForDb.drizzleDb = instance.db;
}

export const dbClient = instance.client;
export const db = instance.db;
