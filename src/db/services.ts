import { count, eq, inArray } from "drizzle-orm";
import type { ModuleInput, SemesterInput } from "@/lib/validation/schemas";
import type { Db } from "./index";
import { createModuleWithDefaults } from "./modules";
import { moveRow, nextPosition } from "./ordering";
import { assessments, chapterActivities, chapters, modules, pastPapers, semesters } from "./schema";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

type Direction = "up" | "down";

function required<T>(row: T | undefined, what: string): T {
  if (!row) throw new NotFoundError(what);
  return row;
}

// ---- semesters ---------------------------------------------------------------------------------

export function createSemester(db: Db, input: SemesterInput) {
  const position = nextPosition(db, semesters);
  return db
    .insert(semesters)
    .values({ ...input, position })
    .returning()
    .get();
}

export function updateSemester(db: Db, id: number, input: SemesterInput) {
  const row = db.update(semesters).set(input).where(eq(semesters.id, id)).returning().get();
  return required(row, "Semester");
}

export function deleteSemester(db: Db, id: number) {
  required(db.select().from(semesters).where(eq(semesters.id, id)).get(), "Semester");
  db.delete(semesters).where(eq(semesters.id, id)).run();
}

export function moveSemester(db: Db, id: number, direction: Direction) {
  return moveRow(db, semesters, undefined, id, direction);
}

/** What deleting a semester would remove, for the confirmation dialog. */
export function getSemesterDeleteImpact(db: Db, id: number) {
  const moduleIds = db.select({ id: modules.id }).from(modules).where(eq(modules.semesterId, id));
  const countIn = (table: typeof chapters | typeof assessments | typeof pastPapers) =>
    db.select({ n: count() }).from(table).where(inArray(table.moduleId, moduleIds)).get()!.n;
  return {
    modules: db.select({ n: count() }).from(modules).where(eq(modules.semesterId, id)).get()!.n,
    chapters: countIn(chapters),
    assessments: countIn(assessments),
    pastPapers: countIn(pastPapers),
  };
}

// ---- modules -----------------------------------------------------------------------------------

export function createModule(db: Db, semesterId: number, input: ModuleInput) {
  required(db.select().from(semesters).where(eq(semesters.id, semesterId)).get(), "Semester");
  const position = nextPosition(db, modules, eq(modules.semesterId, semesterId));
  return createModuleWithDefaults(db, { ...input, semesterId, position });
}

export function updateModule(db: Db, id: number, input: ModuleInput) {
  const row = db.update(modules).set(input).where(eq(modules.id, id)).returning().get();
  return required(row, "Module");
}

export function deleteModule(db: Db, id: number) {
  const row = required(db.select().from(modules).where(eq(modules.id, id)).get(), "Module");
  db.delete(modules).where(eq(modules.id, id)).run();
  return row;
}

export function moveModule(db: Db, id: number, direction: Direction) {
  const row = required(db.select().from(modules).where(eq(modules.id, id)).get(), "Module");
  return moveRow(db, modules, eq(modules.semesterId, row.semesterId), id, direction);
}

export function getModuleDeleteImpact(db: Db, id: number) {
  const chapterIds = db.select({ id: chapters.id }).from(chapters).where(eq(chapters.moduleId, id));
  const countByModule = (table: typeof chapters | typeof assessments | typeof pastPapers) =>
    db.select({ n: count() }).from(table).where(eq(table.moduleId, id)).get()!.n;
  return {
    chapters: countByModule(chapters),
    assessments: countByModule(assessments),
    pastPapers: countByModule(pastPapers),
    activityRecords: db
      .select({ n: count() })
      .from(chapterActivities)
      .where(inArray(chapterActivities.chapterId, chapterIds))
      .get()!.n,
  };
}

// ---- chapters ----------------------------------------------------------------------------------

/** Append chapters to the end of a module, in the given order. */
export function addChapters(db: Db, moduleId: number, titles: string[]) {
  required(db.select().from(modules).where(eq(modules.id, moduleId)).get(), "Module");
  return db.transaction((tx) => {
    const start = nextPosition(tx as unknown as Db, chapters, eq(chapters.moduleId, moduleId));
    return tx
      .insert(chapters)
      .values(titles.map((title, i) => ({ moduleId, title, position: start + i })))
      .returning()
      .all();
  });
}

export function renameChapter(db: Db, id: number, title: string) {
  const row = db.update(chapters).set({ title }).where(eq(chapters.id, id)).returning().get();
  return required(row, "Chapter");
}

export function deleteChapter(db: Db, id: number) {
  const row = required(db.select().from(chapters).where(eq(chapters.id, id)).get(), "Chapter");
  db.delete(chapters).where(eq(chapters.id, id)).run();
  return row;
}

export function moveChapter(db: Db, id: number, direction: Direction) {
  const row = required(db.select().from(chapters).where(eq(chapters.id, id)).get(), "Chapter");
  return moveRow(db, chapters, eq(chapters.moduleId, row.moduleId), id, direction);
}

export function getChapterDeleteImpact(db: Db, id: number) {
  return {
    activityRecords: db
      .select({ n: count() })
      .from(chapterActivities)
      .where(eq(chapterActivities.chapterId, id))
      .get()!.n,
  };
}
