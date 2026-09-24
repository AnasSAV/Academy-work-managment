import { DEFAULT_ACTIVITY_TYPES } from "@/lib/defaults";
import type { Db } from "./index";
import { activityTypes, modules } from "./schema";

type NewModule = typeof modules.$inferInsert;

/** Create a module together with its built-in activity types, in one transaction. */
export function createModuleWithDefaults(db: Db, values: NewModule) {
  return db.transaction((tx) => {
    const [created] = tx.insert(modules).values(values).returning().all();
    tx.insert(activityTypes)
      .values(
        DEFAULT_ACTIVITY_TYPES.map((t, position) => ({
          moduleId: created.id,
          key: t.key,
          label: t.label,
          weight: t.weight,
          tracksCounts: t.tracksCounts,
          position,
        })),
      )
      .run();
    return created;
  });
}
