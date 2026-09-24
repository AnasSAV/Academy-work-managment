import { eq } from "drizzle-orm";
import { ADVANCED_ML_ASSESSMENTS } from "@/lib/fixtures/advanced-ml";
import type { Db } from "./index";
import { assessmentTags, assessments, modules, tags } from "./schema";

/**
 * Optional demo data: the Advanced ML assessment table, with the "*" marker as a tag.
 * Requires the module to exist (run the normal seed first). Skips if it already has assessments.
 */
export function seedDemo(db: Db): { seeded: boolean; reason?: string } {
  const mod = db.select().from(modules).where(eq(modules.name, "Advanced ML")).get();
  if (!mod) {
    return {
      seeded: false,
      reason: 'Module "Advanced ML" not found. Run `npm run db:seed` first.',
    };
  }

  const already = db.select().from(assessments).where(eq(assessments.moduleId, mod.id)).get();
  if (already) return { seeded: false, reason: "Advanced ML already has assessments." };

  db.transaction((tx) => {
    const [star] = tx
      .insert(tags)
      .values({
        moduleId: mod.id,
        name: "*",
        description: "Marked with * in the course handout (meaning defined per course).",
      })
      .returning()
      .all();

    ADVANCED_ML_ASSESSMENTS.forEach((a, position) => {
      const [row] = tx
        .insert(assessments)
        .values({
          moduleId: mod.id,
          name: a.name,
          lecturer: a.lecturer,
          weight: a.weight,
          position,
        })
        .returning()
        .all();
      if (a.starred) {
        tx.insert(assessmentTags).values({ assessmentId: row.id, tagId: star.id }).run();
      }
    });
  });

  return { seeded: true };
}
