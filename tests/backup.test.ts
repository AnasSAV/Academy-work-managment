import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import { backupDatabase, timestamp } from "@/db/backup";
import { semesters } from "@/db/schema";
import { seedDatabase } from "@/db/seed";

let dir: string;
let source: string;
let open: Db[] = [];

/** Open a database the way the app does, and remember it so the test can close it. */
function openDb(file: string): Db {
  const db = createDatabase(file);
  open.push(db);
  return db;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-"));
  source = path.join(dir, "app.db");
});
afterEach(() => {
  // Windows will not delete a database file that is still open.
  for (const db of open) (db as unknown as { $client: Database.Database }).$client.close();
  open = [];
  fs.rmSync(dir, { recursive: true, force: true });
});

const count = (file: string, table: string) => {
  const db = new Database(file, { readonly: true });
  try {
    return (db.prepare(`select count(*) c from ${table}`).get() as { c: number }).c;
  } finally {
    db.close();
  }
};

describe("timestamp", () => {
  it("is sortable local time with zero padding", () => {
    expect(timestamp(new Date(2026, 0, 5, 9, 3, 7))).toBe("20260105-090307");
    expect(timestamp(new Date(2026, 11, 31, 23, 59, 59))).toBe("20261231-235959");
  });
});

describe("backupDatabase", () => {
  it("copies the whole database, including changes still in the write-ahead log", async () => {
    const db = openDb(source); // WAL mode: recent writes live in app.db-wal
    seedDatabase(db);
    expect(fs.existsSync(source + "-wal")).toBe(true);

    const backup = await backupDatabase(
      source,
      path.join(dir, "backups"),
      new Date(2026, 2, 10, 8, 0, 0),
    );

    expect(path.basename(backup)).toBe("app-20260310-080000.db");
    expect(count(backup, "semester")).toBe(1);
    expect(count(backup, "module")).toBe(6);
    expect(count(backup, "chapter")).toBe(10);
    expect(count(backup, "activity_type")).toBe(24);
  });

  it("is a working, independent database", async () => {
    const db = openDb(source);
    seedDatabase(db);
    const backup = await backupDatabase(source, path.join(dir, "backups"));

    // Changing the original afterwards does not touch the backup.
    db.delete(semesters).run();
    expect(count(source, "module")).toBe(0);
    expect(count(backup, "module")).toBe(6);

    // The backup opens with the app's own code and keeps its structure (foreign keys, indexes).
    const restored = openDb(backup);
    expect(restored.select().from(semesters).all()).toHaveLength(1);
  });

  it("leaves the source database untouched", async () => {
    const db = openDb(source);
    seedDatabase(db);
    const before = count(source, "chapter");
    await backupDatabase(source, path.join(dir, "backups"));
    expect(count(source, "chapter")).toBe(before);
  });

  it("creates the backup folder and never overwrites an earlier backup", async () => {
    openDb(source);
    const backups = path.join(dir, "nested", "backups");
    const when = new Date(2026, 2, 10, 8, 0, 0);
    const a = await backupDatabase(source, backups, when);
    const b = await backupDatabase(source, backups, when);
    const c = await backupDatabase(source, backups, when);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(path.basename(b)).toBe("app-20260310-080000-1.db");
    expect(path.basename(c)).toBe("app-20260310-080000-2.db");
    expect(fs.readdirSync(backups)).toHaveLength(3);
  });

  it("says so plainly when there is no database yet, and creates nothing", async () => {
    const backups = path.join(dir, "backups");
    await expect(backupDatabase(path.join(dir, "missing.db"), backups)).rejects.toThrow(
      /No database found/,
    );
    expect(fs.existsSync(backups)).toBe(false);
  });
});
