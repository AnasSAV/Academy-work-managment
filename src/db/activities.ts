import { and, asc, count, eq } from "drizzle-orm";
import type { ActivityTypeInput, ChapterDetailsInput } from "@/lib/validation/schemas";
import { NotFoundError, RuleError } from "./errors";
import type { Db } from "./index";
import { nextPosition } from "./ordering";
import { activityTypes, chapterActivities, chapters, modules } from "./schema";

/**
 * Activity state lives in `chapter_activity`, one row per (chapter, activity type), created the
 * first time it changes. A missing row means "not done". `today` is passed in ("YYYY-MM-DD") so
 * these functions stay deterministic and testable.
 */

function resolve(db: Db, chapterId: number, activityTypeId: number) {
  const chapter = db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
  if (!chapter) throw new NotFoundError("Chapter");
  const type = db
    .select()
    .from(activityTypes)
    .where(and(eq(activityTypes.id, activityTypeId), eq(activityTypes.moduleId, chapter.moduleId)))
    .get();
  if (!type) throw new NotFoundError("Activity");
  const existing = db
    .select()
    .from(chapterActivities)
    .where(
      and(
        eq(chapterActivities.chapterId, chapterId),
        eq(chapterActivities.activityTypeId, activityTypeId),
      ),
    )
    .get();
  return { chapter, type, existing };
}

function upsert(
  db: Db,
  chapterId: number,
  activityTypeId: number,
  values: Partial<typeof chapterActivities.$inferInsert>,
) {
  db.insert(chapterActivities)
    .values({ chapterId, activityTypeId, ...values })
    .onConflictDoUpdate({
      target: [chapterActivities.chapterId, chapterActivities.activityTypeId],
      set: values,
    })
    .run();
}

function markReviewed(db: Db, chapterId: number, today: string) {
  db.update(chapters).set({ lastReviewedAt: today }).where(eq(chapters.id, chapterId)).run();
}

/**
 * Tick or untick an activity. Ticking "revised" logs a first revision and stamps the chapter's
 * last-reviewed date; unticking it clears the revision count.
 */
export function setActivityDone(
  db: Db,
  chapterId: number,
  activityTypeId: number,
  done: boolean,
  today: string,
) {
  const { type, existing } = resolve(db, chapterId, activityTypeId);
  const isRevised = type.key === "revised";
  const wasDone = existing?.done ?? false;

  upsert(db, chapterId, activityTypeId, {
    done,
    doneAt: done ? (wasDone ? (existing?.doneAt ?? today) : today) : null,
    revisionCount: isRevised
      ? done
        ? Math.max(existing?.revisionCount ?? 0, 1)
        : 0
      : (existing?.revisionCount ?? 0),
  });
  if (isRevised && done && !wasDone) markReviewed(db, chapterId, today);
}

/**
 * Record done/total for an activity that tracks counts (e.g. questions). Reaching the total ticks
 * the activity; dropping below it unticks it. Clearing both leaves the tick as it was.
 */
export function setActivityCounts(
  db: Db,
  chapterId: number,
  activityTypeId: number,
  counts: { countDone: number | null; countTotal: number | null },
  today: string,
) {
  const { type, existing } = resolve(db, chapterId, activityTypeId);
  if (!type.tracksCounts) throw new RuleError(`"${type.label}" does not track counts`);

  const { countDone, countTotal } = counts;
  const hasTarget = countTotal !== null && countTotal > 0;
  const values: Partial<typeof chapterActivities.$inferInsert> = { countDone, countTotal };

  if (hasTarget) {
    const complete = (countDone ?? 0) >= countTotal;
    values.done = complete;
    values.doneAt = complete ? (existing?.done ? (existing.doneAt ?? today) : today) : null;
  }
  upsert(db, chapterId, activityTypeId, values);
}

/** Add (+1) or remove (-1) a revision. Revising stamps the chapter's last-reviewed date. */
export function adjustRevision(db: Db, chapterId: number, delta: 1 | -1, today: string) {
  const chapter = db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
  if (!chapter) throw new NotFoundError("Chapter");
  const type = db
    .select()
    .from(activityTypes)
    .where(and(eq(activityTypes.moduleId, chapter.moduleId), eq(activityTypes.key, "revised")))
    .get();
  if (!type) throw new NotFoundError("Revised activity");

  const existing = db
    .select()
    .from(chapterActivities)
    .where(
      and(
        eq(chapterActivities.chapterId, chapterId),
        eq(chapterActivities.activityTypeId, type.id),
      ),
    )
    .get();

  const next = Math.max(0, (existing?.revisionCount ?? 0) + delta);
  upsert(db, chapterId, type.id, {
    revisionCount: next,
    done: next > 0,
    doneAt: next > 0 ? (delta === 1 ? today : (existing?.doneAt ?? today)) : null,
  });
  if (delta === 1) markReviewed(db, chapterId, today);
}

/**
 * Mark every activity of a chapter done, in one transaction. Ticking Revised counts as a first
 * revision and stamps the last-reviewed date, exactly as ticking it by hand does.
 */
export function completeChapter(db: Db, chapterId: number, today: string) {
  const chapter = db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
  if (!chapter) throw new NotFoundError("Chapter");
  db.transaction((tx) => {
    const t = tx as unknown as Db;
    for (const type of listActivityTypes(t, chapter.moduleId)) {
      setActivityDone(t, chapterId, type.id, true, today);
    }
  });
}

export function updateChapterDetails(db: Db, chapterId: number, input: ChapterDetailsInput) {
  const row = db.update(chapters).set(input).where(eq(chapters.id, chapterId)).returning().get();
  if (!row) throw new NotFoundError("Chapter");
  return row;
}

// ---- activity types (per module) ---------------------------------------------------------------

export function listActivityTypes(db: Db, moduleId: number) {
  return db
    .select()
    .from(activityTypes)
    .where(eq(activityTypes.moduleId, moduleId))
    .orderBy(asc(activityTypes.position), asc(activityTypes.id))
    .all();
}

function assertLabelFree(db: Db, moduleId: number, label: string, exceptId?: number) {
  const clash = listActivityTypes(db, moduleId).find(
    (t) => t.label.toLowerCase() === label.toLowerCase() && t.id !== exceptId,
  );
  if (clash) throw new RuleError(`An activity called "${clash.label}" already exists`);
}

export function createActivityType(db: Db, moduleId: number, input: ActivityTypeInput) {
  if (!db.select().from(modules).where(eq(modules.id, moduleId)).get()) {
    throw new NotFoundError("Module");
  }
  assertLabelFree(db, moduleId, input.label);
  return db
    .insert(activityTypes)
    .values({
      moduleId,
      label: input.label,
      weight: input.weight,
      tracksCounts: input.tracksCounts,
      position: nextPosition(db, activityTypes, eq(activityTypes.moduleId, moduleId)),
    })
    .returning()
    .get();
}

/** Built-in activities keep their identity: only the name and weight can change. */
export function updateActivityType(db: Db, id: number, input: ActivityTypeInput) {
  const type = db.select().from(activityTypes).where(eq(activityTypes.id, id)).get();
  if (!type) throw new NotFoundError("Activity");
  assertLabelFree(db, type.moduleId, input.label, id);
  return db
    .update(activityTypes)
    .set({
      label: input.label,
      weight: input.weight,
      tracksCounts: type.key ? type.tracksCounts : input.tracksCounts,
    })
    .where(eq(activityTypes.id, id))
    .returning()
    .get();
}

export function getActivityTypeDeleteImpact(db: Db, id: number) {
  return {
    activityRecords: db
      .select({ n: count() })
      .from(chapterActivities)
      .where(eq(chapterActivities.activityTypeId, id))
      .get()!.n,
  };
}

export function deleteActivityType(db: Db, id: number) {
  const type = db.select().from(activityTypes).where(eq(activityTypes.id, id)).get();
  if (!type) throw new NotFoundError("Activity");
  if (type.key) throw new RuleError(`"${type.label}" is built in and cannot be deleted`);
  db.delete(activityTypes).where(eq(activityTypes.id, id)).run();
}
