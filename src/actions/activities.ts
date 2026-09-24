"use server";

import { getDb } from "@/db";
import {
  adjustRevision,
  completeChapter,
  createActivityType,
  deleteActivityType,
  setActivityCounts,
  setActivityDone,
  updateActivityType,
  updateChapterDetails,
} from "@/db/activities";
import { todayISO } from "@/lib/dates";
import { parseInput } from "@/lib/validation/parse";
import {
  activityCountsSchema,
  activityTypeSchema,
  chapterDetailsSchema,
} from "@/lib/validation/schemas";
import { failure, guard, parseId, type ActionResult } from "./helpers";

const nothing = () => undefined;

export async function setActivityDoneAction(
  chapterId: number,
  activityTypeId: number,
  done: boolean,
): Promise<ActionResult> {
  const chapter = parseId(chapterId);
  const activity = parseId(activityTypeId);
  if (!chapter || !activity || typeof done !== "boolean") return failure("Invalid request");
  return guard(() => {
    setActivityDone(getDb(), chapter, activity, done, todayISO());
    return nothing();
  });
}

export async function setActivityCountsAction(
  chapterId: number,
  activityTypeId: number,
  formData: FormData,
): Promise<ActionResult> {
  const chapter = parseId(chapterId);
  const activity = parseId(activityTypeId);
  if (!chapter || !activity) return failure("Invalid request");
  const parsed = parseInput(activityCountsSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    setActivityCounts(getDb(), chapter, activity, parsed.data, todayISO());
    return nothing();
  });
}

export async function adjustRevisionAction(
  chapterId: number,
  delta: number,
): Promise<ActionResult> {
  const chapter = parseId(chapterId);
  if (!chapter || (delta !== 1 && delta !== -1)) return failure("Invalid request");
  return guard(() => {
    adjustRevision(getDb(), chapter, delta, todayISO());
    return nothing();
  });
}

export async function completeChapterAction(chapterId: number): Promise<ActionResult> {
  const chapter = parseId(chapterId);
  if (!chapter) return failure("Invalid request");
  return guard(() => {
    completeChapter(getDb(), chapter, todayISO());
    return nothing();
  });
}

export async function updateChapterDetailsAction(
  chapterId: number,
  formData: FormData,
): Promise<ActionResult> {
  const chapter = parseId(chapterId);
  if (!chapter) return failure("Invalid chapter");
  const parsed = parseInput(chapterDetailsSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updateChapterDetails(getDb(), chapter, parsed.data);
    return nothing();
  });
}

export async function createActivityTypeAction(
  moduleId: number,
  formData: FormData,
): Promise<ActionResult> {
  const parentId = parseId(moduleId);
  if (!parentId) return failure("Invalid module");
  const parsed = parseInput(activityTypeSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    createActivityType(getDb(), parentId, parsed.data);
    return nothing();
  });
}

export async function updateActivityTypeAction(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const typeId = parseId(id);
  if (!typeId) return failure("Invalid activity");
  const parsed = parseInput(activityTypeSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updateActivityType(getDb(), typeId, parsed.data);
    return nothing();
  });
}

export async function deleteActivityTypeAction(id: number): Promise<ActionResult> {
  const typeId = parseId(id);
  if (!typeId) return failure("Invalid activity");
  return guard(() => {
    deleteActivityType(getDb(), typeId);
    return nothing();
  });
}
