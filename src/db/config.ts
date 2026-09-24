import path from "node:path";

const root = process.cwd();

function resolveFromRoot(value: string) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

export const databasePath = resolveFromRoot(process.env.DATABASE_PATH ?? "data/app.db");
export const uploadsDir = resolveFromRoot(process.env.UPLOADS_DIR ?? "data/uploads");
export const migrationsDir = path.join(root, "src", "db", "migrations");
