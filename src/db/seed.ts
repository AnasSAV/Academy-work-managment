import { eq } from "drizzle-orm";
import { MODULE_COLORS } from "@/lib/defaults";
import type { Db } from "./index";
import { createModuleWithDefaults } from "./modules";
import { chapters, semesters } from "./schema";

export const SEED_SEMESTER = "Semester 07";

export const SEED_MODULES = [
  "Computer Networks and Security",
  "Advanced DS",
  "Organizational Behavior and Management",
  "Concurrent Programming",
  "Natural Language Processing",
  "Advanced ML",
] as const;

/** Titles are seeded exactly as they appear in OneNote (two are truncated there); rename in the UI. */
export const SEED_NETWORK_CHAPTERS = [
  "01 Introduction and OSI…",
  "02 The Data Link Layer",
  "03 Wide-Area Networks",
  "04 Local-Area Networks",
  "05 Network Layer",
  "06 Internet Protocol",
  "07 Transport Layer",
  "08 Internet Transport Protocols",
  "09 Introduction to Net…",
  "10 Public Key Infrastructure",
] as const;

/**
 * Create the real starting data: one semester, six modules, and the ten Computer Networks and
 * Security chapters. No assessments, past papers or files. Skips if the semester already exists.
 */
export function seedDatabase(db: Db): { seeded: boolean } {
  const existing = db.select().from(semesters).where(eq(semesters.name, SEED_SEMESTER)).get();
  if (existing) return { seeded: false };

  db.transaction((tx) => {
    const [semester] = tx.insert(semesters).values({ name: SEED_SEMESTER }).returning().all();

    SEED_MODULES.forEach((name, position) => {
      const created = createModuleWithDefaults(tx as unknown as Db, {
        semesterId: semester.id,
        name,
        color: MODULE_COLORS[position % MODULE_COLORS.length],
        position,
      });
      if (position === 0) {
        tx.insert(chapters)
          .values(
            SEED_NETWORK_CHAPTERS.map((title, i) => ({
              moduleId: created.id,
              title,
              position: i,
            })),
          )
          .run();
      }
    });
  });

  return { seeded: true };
}
