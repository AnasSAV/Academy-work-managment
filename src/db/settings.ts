import { DEFAULT_SETTINGS } from "@/lib/defaults";
import type { Db } from "./index";
import { settings } from "./schema";

export type AppSettings = { -readonly [K in keyof typeof DEFAULT_SETTINGS]: number };

/** Stored overrides merged over the code defaults. Unreadable values fall back to the default. */
export function getSettings(db: Db): AppSettings {
  const result: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of db.select().from(settings).all()) {
    if (!(row.key in result)) continue;
    try {
      const value = JSON.parse(row.value);
      if (typeof value === "number" && Number.isFinite(value)) {
        result[row.key as keyof AppSettings] = value;
      }
    } catch {
      // ignore a corrupt value and keep the default
    }
  }
  return result;
}

export function updateSettings(db: Db, values: Partial<AppSettings>) {
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || !(key in DEFAULT_SETTINGS)) continue;
      tx.insert(settings)
        .values({ key, value: JSON.stringify(value) })
        .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value) } })
        .run();
    }
  });
}
