import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { databasePath, migrationsDir } from "./config";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Open a SQLite database (":memory:" allowed), enable foreign keys so deletes cascade,
 * and apply any pending migrations.
 */
export function createDatabase(file: string = databasePath): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsDir });
  return db;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __academyDb?: Db };

export function getDb(): Db {
  return (globalForDb.__academyDb ??= createDatabase());
}

export * as schema from "./schema";
