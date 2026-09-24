import { count, eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import { createModuleWithDefaults } from "@/db/modules";
import {
  activityTypes,
  assessmentTags,
  assessments,
  chapterActivities,
  chapters,
  modules,
  semesters,
  tags,
} from "@/db/schema";
import { SEED_MODULES, SEED_NETWORK_CHAPTERS, SEED_SEMESTER, seedDatabase } from "@/db/seed";
import { seedDemo } from "@/db/seed-demo";
import { ADVANCED_ML_ASSESSMENTS } from "@/lib/fixtures/advanced-ml";

let db: Db;

function total(table: SQLiteTable) {
  return db.select({ n: count() }).from(table).get()!.n;
}

beforeEach(() => {
  db = createDatabase(":memory:");
});

describe("seedDatabase", () => {
  it("creates Semester 07 with six modules and ten network chapters, and nothing else", () => {
    expect(seedDatabase(db)).toEqual({ seeded: true });

    const [semester] = db.select().from(semesters).all();
    expect(semester.name).toBe(SEED_SEMESTER);

    const mods = db.select().from(modules).orderBy(modules.position).all();
    expect(mods.map((m) => m.name)).toEqual([...SEED_MODULES]);
    expect(new Set(mods.map((m) => m.color)).size).toBe(mods.length);

    const chapterRows = db.select().from(chapters).orderBy(chapters.position).all();
    expect(chapterRows.map((c) => c.title)).toEqual([...SEED_NETWORK_CHAPTERS]);
    expect(new Set(chapterRows.map((c) => c.moduleId))).toEqual(new Set([mods[0].id]));

    expect(total(assessments)).toBe(0);
  });

  it("is idempotent", () => {
    seedDatabase(db);
    expect(seedDatabase(db)).toEqual({ seeded: false });
    expect(total(modules)).toBe(SEED_MODULES.length);
  });

  it("gives every module the four built-in activity types with default weights", () => {
    seedDatabase(db);
    const types = db.select().from(activityTypes).all();
    expect(types).toHaveLength(SEED_MODULES.length * 4);

    const first = types.filter((t) => t.moduleId === 1);
    expect(Object.fromEntries(first.map((t) => [t.key, t.weight]))).toEqual({
      learned: 40,
      questions: 30,
      notes: 15,
      revised: 15,
    });
  });
});

describe("seedDemo", () => {
  it("adds the Advanced ML assessments with the * tag, and only once", () => {
    seedDatabase(db);
    expect(seedDemo(db).seeded).toBe(true);
    expect(seedDemo(db).seeded).toBe(false);

    const rows = db.select().from(assessments).all();
    expect(rows).toHaveLength(ADVANCED_ML_ASSESSMENTS.length);
    expect(rows.reduce((sum, r) => sum + r.weight, 0)).toBe(100);
    expect(total(assessmentTags)).toBe(ADVANCED_ML_ASSESSMENTS.filter((a) => a.starred).length);
  });

  it("refuses to run without the seeded module", () => {
    expect(seedDemo(db).seeded).toBe(false);
  });
});

describe("cascade deletes", () => {
  it("removes a semester's whole subtree", () => {
    seedDatabase(db);
    seedDemo(db);
    const chapter = db.select().from(chapters).get()!;
    const type = db.select().from(activityTypes).get()!;
    db.insert(chapterActivities)
      .values({ chapterId: chapter.id, activityTypeId: type.id, done: true })
      .run();

    db.delete(semesters).run();

    for (const table of [
      modules,
      chapters,
      activityTypes,
      chapterActivities,
      assessments,
      tags,
      assessmentTags,
    ]) {
      expect(total(table)).toBe(0);
    }
  });

  it("deleting a tag unlinks it from assessments but keeps the assessments", () => {
    seedDatabase(db);
    seedDemo(db);
    db.delete(tags).run();
    expect(total(assessmentTags)).toBe(0);
    expect(total(assessments)).toBe(ADVANCED_ML_ASSESSMENTS.length);
  });
});

describe("constraints", () => {
  function newModule() {
    const [semester] = db.insert(semesters).values({ name: "S" }).returning().all();
    return createModuleWithDefaults(db, { semesterId: semester.id, name: "M" });
  }

  it("rejects chapter confidence outside 1-5", () => {
    const mod = newModule();
    const insert = (confidence: number) =>
      db.insert(chapters).values({ moduleId: mod.id, title: "c", confidence }).run();
    expect(() => insert(0)).toThrow();
    expect(() => insert(6)).toThrow();
    expect(() => insert(5)).not.toThrow();
  });

  it("rejects assessment weights outside 0-100 and non-positive max scores", () => {
    const mod = newModule();
    const insert = (weight: number, maxScore = 100) =>
      db.insert(assessments).values({ moduleId: mod.id, name: "a", weight, maxScore }).run();
    expect(() => insert(101)).toThrow();
    expect(() => insert(-1)).toThrow();
    expect(() => insert(10, 0)).toThrow();
    expect(() => insert(10)).not.toThrow();
  });

  it("rejects a duplicate tag name within a module but allows it across modules", () => {
    const mod = newModule();
    const other = createModuleWithDefaults(db, { semesterId: mod.semesterId, name: "Other" });
    db.insert(tags).values({ moduleId: mod.id, name: "online" }).run();
    expect(() => db.insert(tags).values({ moduleId: mod.id, name: "online" }).run()).toThrow();
    expect(() =>
      db.insert(tags).values({ moduleId: other.id, name: "online" }).run(),
    ).not.toThrow();
  });

  it("rejects an assessment for a module that does not exist (foreign keys are on)", () => {
    expect(() =>
      db.insert(assessments).values({ moduleId: 999, name: "orphan", weight: 1 }).run(),
    ).toThrow();
  });

  it("stores work mode and group details", () => {
    const mod = newModule();
    db.insert(assessments)
      .values({
        moduleId: mod.id,
        name: "Project",
        weight: 20,
        workMode: "group",
        groupSize: 4,
        groupMembers: "A, B, C, D",
      })
      .run();
    const row = db.select().from(assessments).where(eq(assessments.name, "Project")).get()!;
    expect(row).toMatchObject({ workMode: "group", groupSize: 4, groupMembers: "A, B, C, D" });
  });
});
