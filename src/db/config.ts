import path from "node:path";

const root = process.cwd();

// Paths are resolved at runtime from the working directory (this is a local, single-machine app),
// so tell Turbopack not to trace the whole project for these joins.
function resolveFromRoot(value: string) {
  return path.isAbsolute(value) ? value : path.join(/*turbopackIgnore: true*/ root, value);
}

export const databasePath = resolveFromRoot(process.env.DATABASE_PATH ?? "data/app.db");
export const uploadsDir = resolveFromRoot(process.env.UPLOADS_DIR ?? "data/uploads");
export const migrationsDir = path.join(/*turbopackIgnore: true*/ root, "src", "db", "migrations");

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB);
/** Largest accepted upload, from MAX_UPLOAD_MB (default 50). */
export const maxUploadBytes = (maxUploadMb > 0 ? maxUploadMb : 50) * 1024 * 1024;
