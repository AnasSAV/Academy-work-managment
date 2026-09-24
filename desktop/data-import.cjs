"use strict";
/**
 * Bring existing data (a database file, or a whole `data` folder from the development version)
 * into the desktop app's data folder. Plain file operations only, so it can be tested without
 * Electron. The app's server must not be running while this happens.
 */
const fs = require("node:fs");
const path = require("node:path");

const SQLITE_HEADER = "SQLite format 3\0";

/** True when the first 16 bytes are SQLite's magic header. */
function isSqliteFile(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(16);
    const read = fs.readSync(fd, buf, 0, 16, 0);
    return read === 16 && buf.toString("latin1") === SQLITE_HEADER;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return n;
}

const pad = (n) => String(n).padStart(2, "0");
function timestamp(now) {
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Work out what a chosen path contains. Accepts a database file, or a folder holding `app.db`.
 * The uploads folder is taken from beside the database, or (for a file in `backups/`) from the
 * folder above. Throws a plain-English Error if it is not a usable SQLite database.
 */
function describeSource(chosen) {
  let db;
  let uploads = null;
  if (isDir(chosen)) {
    db = path.join(chosen, "app.db");
    if (!fs.existsSync(db)) {
      throw new Error(`There is no app.db in ${chosen}. Choose the folder that contains app.db.`);
    }
    if (isDir(path.join(chosen, "uploads"))) uploads = path.join(chosen, "uploads");
  } else {
    db = chosen;
    const here = path.dirname(db);
    for (const candidate of [path.join(here, "uploads"), path.join(here, "..", "uploads")]) {
      if (isDir(candidate)) {
        uploads = path.resolve(candidate);
        break;
      }
    }
  }
  if (!isSqliteFile(db)) throw new Error(`${db} is not a SQLite database.`);
  // A database in write-ahead mode may still have recent changes in these two side files.
  const sidecars = ["-wal", "-shm"].map((s) => db + s).filter((p) => fs.existsSync(p));
  return {
    db,
    sidecars,
    uploads,
    bytes: fs.statSync(db).size,
    uploadCount: uploads ? countFiles(uploads) : 0,
  };
}

function moveIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return true;
}

/** Put the files that were moved aside back where they were. */
function rollbackImport(dataDir, backupDir) {
  for (const name of ["app.db", "app.db-wal", "app.db-shm"]) {
    fs.rmSync(path.join(dataDir, name), { force: true });
    moveIfExists(path.join(backupDir, name), path.join(dataDir, name));
  }
  fs.rmSync(path.join(dataDir, "uploads"), { recursive: true, force: true });
  moveIfExists(path.join(backupDir, "uploads"), path.join(dataDir, "uploads"));
}

/**
 * Replace the app's data with the chosen source. What is there now is moved (not copied) into
 * `<dataDir>/backups/before-import-<time>` first, and put back if anything goes wrong.
 * Returns where the old data went.
 */
function importData(chosen, dataDir, now = new Date()) {
  const source = describeSource(chosen);
  const target = path.join(dataDir, "app.db");
  if (path.resolve(source.db) === path.resolve(target)) {
    throw new Error("That is the app's own database. Choose the data you want to bring in.");
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const backupDir = path.join(dataDir, "backups", `before-import-${timestamp(now)}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const name of ["app.db", "app.db-wal", "app.db-shm", "uploads"]) {
    moveIfExists(path.join(dataDir, name), path.join(backupDir, name));
  }

  try {
    fs.copyFileSync(source.db, target);
    for (const side of source.sidecars) {
      fs.copyFileSync(side, target + side.slice(source.db.length)); // "-wal" or "-shm"
    }
    if (source.uploads)
      fs.cpSync(source.uploads, path.join(dataDir, "uploads"), { recursive: true });
  } catch (error) {
    rollbackImport(dataDir, backupDir);
    throw error;
  }
  return { backupDir, source };
}

module.exports = { isSqliteFile, describeSource, importData, rollbackImport, timestamp };
