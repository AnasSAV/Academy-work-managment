import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const pad = (n: number) => String(n).padStart(2, "0");

/** "20260924-101530" in local time, for file names that sort by date. */
export function timestamp(now: Date): string {
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Copy the database to `<dir>/app-<timestamp>.db` using SQLite's online backup, which is safe
 * while the app is running (copying the file by hand is not: recent changes can still be in the
 * -wal file). The source is opened read-only and never modified. Returns the new file's path.
 */
export async function backupDatabase(
  sourcePath: string,
  backupDir: string,
  now: Date = new Date(),
): Promise<string> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No database found at ${sourcePath}. Nothing to back up yet.`);
  }
  fs.mkdirSync(backupDir, { recursive: true });

  const base = `app-${timestamp(now)}`;
  let dest = path.join(backupDir, `${base}.db`);
  for (let n = 1; fs.existsSync(dest); n++) dest = path.join(backupDir, `${base}-${n}.db`);

  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(dest);
  } finally {
    source.close();
  }
  return dest;
}
