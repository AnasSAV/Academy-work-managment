import { and, asc, count, eq } from "drizzle-orm";
import { pickCurrentSemester } from "@/lib/dashboard";
import type { Db } from "./index";
import {
  activityTypes,
  assessments,
  attachments,
  chapterActivities,
  chapters,
  modules,
  pastPapers,
  semesters,
} from "./schema";

/** Semesters with their modules (id, name, colour), for navigation. */
export function listNav(db: Db) {
  const semesterRows = db
    .select()
    .from(semesters)
    .orderBy(asc(semesters.position), asc(semesters.id))
    .all();
  const moduleRows = db
    .select({
      id: modules.id,
      semesterId: modules.semesterId,
      name: modules.name,
      color: modules.color,
    })
    .from(modules)
    .orderBy(asc(modules.position), asc(modules.id))
    .all();
  return semesterRows.map((s) => ({
    ...s,
    modules: moduleRows.filter((m) => m.semesterId === s.id),
  }));
}

/**
 * The semester a page should show: the one asked for (by id), else the one running today, else the
 * latest that has started, else the first. `current` is null only when there are no semesters.
 */
export function selectSemester(db: Db, requestedId: number | null, today: string) {
  const semesters = listNav(db);
  const current =
    semesters.find((s) => s.id === requestedId) ?? pickCurrentSemester(semesters, today);
  return { semesters, current };
}

export function listSemesterSummaries(db: Db) {
  return listNav(db).map((s) => ({ ...s, moduleCount: s.modules.length }));
}

export function getSemester(db: Db, id: number) {
  return db.select().from(semesters).where(eq(semesters.id, id)).get();
}

export function listModuleSummaries(db: Db, semesterId: number) {
  const rows = db
    .select()
    .from(modules)
    .where(eq(modules.semesterId, semesterId))
    .orderBy(asc(modules.position), asc(modules.id))
    .all();
  const counts = new Map(
    db
      .select({ moduleId: chapters.moduleId, n: count() })
      .from(chapters)
      .innerJoin(modules, eq(modules.id, chapters.moduleId))
      .where(eq(modules.semesterId, semesterId))
      .groupBy(chapters.moduleId)
      .all()
      .map((r) => [r.moduleId, r.n]),
  );
  return rows.map((m) => ({ ...m, chapterCount: counts.get(m.id) ?? 0 }));
}

export function getModule(db: Db, id: number) {
  return db
    .select({ module: modules, semester: semesters })
    .from(modules)
    .innerJoin(semesters, eq(semesters.id, modules.semesterId))
    .where(eq(modules.id, id))
    .get();
}

export function listChapters(db: Db, moduleId: number) {
  return db
    .select()
    .from(chapters)
    .where(eq(chapters.moduleId, moduleId))
    .orderBy(asc(chapters.position), asc(chapters.id))
    .all();
}

/** Recorded activity rows per chapter of a module (what a chapter delete would remove). */
export function chapterActivityCounts(db: Db, moduleId: number) {
  const rows = db
    .select({ chapterId: chapterActivities.chapterId, n: count() })
    .from(chapterActivities)
    .innerJoin(chapters, eq(chapters.id, chapterActivities.chapterId))
    .where(eq(chapters.moduleId, moduleId))
    .groupBy(chapterActivities.chapterId)
    .all();
  return new Map(rows.map((r) => [r.chapterId, r.n]));
}

export function getChapter(db: Db, id: number) {
  return db
    .select({ chapter: chapters, module: modules, semester: semesters })
    .from(chapters)
    .innerJoin(modules, eq(modules.id, chapters.moduleId))
    .innerJoin(semesters, eq(semesters.id, modules.semesterId))
    .where(eq(chapters.id, id))
    .get();
}

/** Files attached to each chapter of a module (what a chapter delete would remove). */
export function chapterAttachmentCounts(db: Db, moduleId: number) {
  const rows = db
    .select({ chapterId: attachments.ownerId, n: count() })
    .from(attachments)
    .innerJoin(
      chapters,
      and(eq(chapters.id, attachments.ownerId), eq(attachments.ownerType, "chapter")),
    )
    .where(eq(chapters.moduleId, moduleId))
    .groupBy(attachments.ownerId)
    .all();
  return new Map(rows.map((r) => [r.chapterId, r.n]));
}

/** Recorded activity rows per activity type of a module (what deleting the type would remove). */
export function activityRecordCounts(db: Db, moduleId: number) {
  const rows = db
    .select({ activityTypeId: chapterActivities.activityTypeId, n: count() })
    .from(chapterActivities)
    .innerJoin(activityTypes, eq(activityTypes.id, chapterActivities.activityTypeId))
    .where(eq(activityTypes.moduleId, moduleId))
    .groupBy(chapterActivities.activityTypeId)
    .all();
  return new Map(rows.map((r) => [r.activityTypeId, r.n]));
}

/** Row counts for a module's tabs. */
export function moduleCounts(db: Db, moduleId: number) {
  const n = (table: typeof chapters | typeof assessments | typeof pastPapers) =>
    db.select({ n: count() }).from(table).where(eq(table.moduleId, moduleId)).get()!.n;
  return { chapters: n(chapters), assessments: n(assessments), pastPapers: n(pastPapers) };
}

export function countAll(db: Db) {
  const n = (table: typeof semesters | typeof modules | typeof chapters) =>
    db.select({ n: count() }).from(table).get()!.n;
  return { semesters: n(semesters), modules: n(modules), chapters: n(chapters) };
}
