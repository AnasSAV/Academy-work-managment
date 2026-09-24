"use server";

import { getDb } from "@/db";
import { addChapters, deleteChapter, moveChapter, renameChapter } from "@/db/services";
import { parseInput } from "@/lib/validation/parse";
import { chapterLinesSchema, chapterTitleSchema } from "@/lib/validation/schemas";
import { failure, guard, parseDirection, parseId, type ActionResult } from "./helpers";

/** Add one chapter per non-blank line. */
export async function addChaptersAction(
  moduleId: number,
  formData: FormData,
): Promise<ActionResult<{ count: number }>> {
  const parentId = parseId(moduleId);
  if (!parentId) return failure("Invalid module");
  const parsed = parseInput(chapterLinesSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => ({ count: addChapters(getDb(), parentId, parsed.data.lines).length }));
}

export async function renameChapterAction(id: number, formData: FormData): Promise<ActionResult> {
  const chapterId = parseId(id);
  if (!chapterId) return failure("Invalid chapter");
  const parsed = parseInput(chapterTitleSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    renameChapter(getDb(), chapterId, parsed.data.title);
    return undefined;
  });
}

export async function deleteChapterAction(id: number): Promise<ActionResult> {
  const chapterId = parseId(id);
  if (!chapterId) return failure("Invalid chapter");
  return guard(() => {
    deleteChapter(getDb(), chapterId);
    return undefined;
  });
}

export async function moveChapterAction(id: number, direction: string): Promise<ActionResult> {
  const chapterId = parseId(id);
  const dir = parseDirection(direction);
  if (!chapterId || !dir) return failure("Invalid request");
  return guard(() => {
    moveChapter(getDb(), chapterId, dir);
    return undefined;
  });
}
