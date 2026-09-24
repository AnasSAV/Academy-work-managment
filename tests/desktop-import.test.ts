import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import { backupDatabase } from "@/db/backup";
import { modules } from "@/db/schema";
import { seedDatabase } from "@/db/seed";

// The desktop shell is plain CommonJS, outside the TypeScript project.
const require = createRequire(import.meta.url);
const { describeSource, importData, isSqliteFile, rollbackImport } =
  require("../desktop/data-import.cjs") as {
    describeSource: (p: string) => {
      db: string;
      sidecars: string[];
      uploads: string | null;
      bytes: number;
      uploadCount: number;
    };
    importData: (
      p: string,
      dataDir: string,
      now?: Date,
    ) => { backupDir: string; source: { db: string } };
    isSqliteFile: (p: string) => boolean;
    rollbackImport: (dataDir: string, backupDir: string) => void;
  };

let dir: string;
let open: Db[] = [];

function openDb(file: string): Db {
  const db = createDatabase(file);
  open.push(db);
  return db;
}
const write = (p: string, text: string) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
const read = (p: string) => fs.readFileSync(p, "utf8");
/** A small but genuine SQLite file (an empty database file is 0 bytes and has no header yet). */
function tinyDb(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.exec("create table t (a)");
  db.close();
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-"));
});
afterEach(() => {
  // Windows will not delete a database file that is still open.
  for (const db of open) (db as unknown as { $client: Database.Database }).$client.close();
  open = [];
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A "development" data folder: a seeded database plus one uploaded file. */
function makeDevData(name = "dev-data") {
  const folder = path.join(dir, name);
  const db = openDb(path.join(folder, "app.db"));
  seedDatabase(db);
  write(path.join(folder, "uploads", "module", "1", "abc.pdf"), "pdf-bytes");
  return folder;
}

describe("isSqliteFile", () => {
  it("accepts a real database and rejects anything else", async () => {
    const db = path.join(dir, "real.db");
    tinyDb(db);
    write(path.join(dir, "notes.txt"), "just some text that is definitely long enough");
    write(path.join(dir, "tiny.db"), "x");
    expect(isSqliteFile(db)).toBe(true);
    expect(isSqliteFile(path.join(dir, "notes.txt"))).toBe(false);
    expect(isSqliteFile(path.join(dir, "tiny.db"))).toBe(false);
    expect(isSqliteFile(path.join(dir, "missing.db"))).toBe(false);
  });
});

describe("describeSource", () => {
  it("reads a data folder: database and uploads", () => {
    const folder = makeDevData();
    const info = describeSource(folder);
    expect(info.db).toBe(path.join(folder, "app.db"));
    expect(info.uploads).toBe(path.join(folder, "uploads"));
    expect(info.uploadCount).toBe(1);
    expect(info.bytes).toBeGreaterThan(0);
  });

  it("finds the uploads folder above a file in backups/", async () => {
    const folder = makeDevData();
    const backup = await backupDatabase(path.join(folder, "app.db"), path.join(folder, "backups"));
    const info = describeSource(backup);
    expect(path.resolve(info.uploads!)).toBe(path.join(folder, "uploads"));
    expect(info.uploadCount).toBe(1);
  });

  it("has no uploads when there is no uploads folder", () => {
    const file = path.join(dir, "lonely.db");
    tinyDb(file);
    expect(describeSource(file).uploads).toBeNull();
  });

  it("explains itself when the choice is unusable", () => {
    write(path.join(dir, "empty-folder", "readme.txt"), "hi");
    expect(() => describeSource(path.join(dir, "empty-folder"))).toThrow(/no app\.db/);
    write(path.join(dir, "fake.db"), "this is not a database at all, honest");
    expect(() => describeSource(path.join(dir, "fake.db"))).toThrow(/not a SQLite database/);
  });
});

describe("importData", () => {
  it("brings in a backup file and the app opens it", async () => {
    const folder = makeDevData();
    const backup = await backupDatabase(path.join(folder, "app.db"), path.join(folder, "backups"));
    const dataDir = path.join(dir, "app-data");

    importData(backup, dataDir, new Date(2026, 8, 24, 11, 0, 0));

    const imported = openDb(path.join(dataDir, "app.db"));
    expect(imported.select().from(modules).all()).toHaveLength(6);
    expect(read(path.join(dataDir, "uploads", "module", "1", "abc.pdf"))).toBe("pdf-bytes");
  });

  it("brings in a whole data folder, including changes still in the write-ahead log", () => {
    const folder = makeDevData();
    // The source database is still open (like a running dev server), so its recent writes
    // may only be in app.db-wal. The import must carry them.
    expect(fs.existsSync(path.join(folder, "app.db-wal"))).toBe(true);
    const dataDir = path.join(dir, "app-data");

    importData(folder, dataDir);

    const imported = openDb(path.join(dataDir, "app.db"));
    expect(imported.select().from(modules).all()).toHaveLength(6);
  });

  it("keeps what was there before in a backup folder, and leaves the source alone", () => {
    const folder = makeDevData();
    const dataDir = path.join(dir, "app-data");
    write(path.join(dataDir, "app.db"), "old database");
    write(path.join(dataDir, "uploads", "old.txt"), "old upload");

    const { backupDir } = importData(folder, dataDir, new Date(2026, 8, 24, 11, 5, 9));

    expect(path.relative(dataDir, backupDir).replaceAll("\\", "/")).toBe(
      "backups/before-import-20260924-110509",
    );
    expect(read(path.join(backupDir, "app.db"))).toBe("old database");
    expect(read(path.join(backupDir, "uploads", "old.txt"))).toBe("old upload");
    expect(fs.existsSync(path.join(dataDir, "uploads", "old.txt"))).toBe(false);
    // The source is untouched.
    expect(fs.existsSync(path.join(folder, "app.db"))).toBe(true);
    expect(fs.existsSync(path.join(folder, "uploads", "module", "1", "abc.pdf"))).toBe(true);
  });

  it("does not delete earlier before-import backups", () => {
    const folder = makeDevData();
    const dataDir = path.join(dir, "app-data");
    importData(folder, dataDir, new Date(2026, 8, 24, 11, 0, 0));
    importData(folder, dataDir, new Date(2026, 8, 24, 11, 30, 0));
    const kept = fs.readdirSync(path.join(dataDir, "backups")).sort();
    expect(kept).toEqual(["before-import-20260924-110000", "before-import-20260924-113000"]);
  });

  it("refuses to import the app's own database", () => {
    const dataDir = path.join(dir, "app-data");
    tinyDb(path.join(dataDir, "app.db"));
    expect(() => importData(path.join(dataDir, "app.db"), dataDir)).toThrow(/own database/);
    expect(() => importData(dataDir, dataDir)).toThrow(/own database/);
    expect(fs.existsSync(path.join(dataDir, "app.db"))).toBe(true);
  });

  it("does not touch the current data when the source is not a database", () => {
    const dataDir = path.join(dir, "app-data");
    write(path.join(dataDir, "app.db"), "keep me");
    write(path.join(dir, "bad.db"), "not sqlite, just a long enough line of text");
    expect(() => importData(path.join(dir, "bad.db"), dataDir)).toThrow(/not a SQLite/);
    expect(read(path.join(dataDir, "app.db"))).toBe("keep me");
    expect(fs.existsSync(path.join(dataDir, "backups"))).toBe(false);
  });

  it("puts the old data back when told to roll back", () => {
    const folder = makeDevData();
    const dataDir = path.join(dir, "app-data");
    write(path.join(dataDir, "app.db"), "old database");
    write(path.join(dataDir, "uploads", "old.txt"), "old upload");

    const { backupDir } = importData(folder, dataDir);
    rollbackImport(dataDir, backupDir);

    expect(read(path.join(dataDir, "app.db"))).toBe("old database");
    expect(read(path.join(dataDir, "uploads", "old.txt"))).toBe("old upload");
    expect(fs.existsSync(path.join(dataDir, "uploads", "module"))).toBe(false);
  });
});
