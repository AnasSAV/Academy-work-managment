"use server";

import { getDb } from "@/db";
import { uploadsDir } from "@/db/config";
import { createPastPaper, deletePastPaper, updatePastPaper } from "@/db/past-papers";
import { deleteStored } from "@/lib/storage";
import { parseInput } from "@/lib/validation/parse";
import { pastPaperSchema } from "@/lib/validation/schemas";
import { failure, guard, parseId, type ActionResult } from "./helpers";

export async function createPastPaperAction(
  moduleId: number,
  formData: FormData,
): Promise<ActionResult> {
  const parentId = parseId(moduleId);
  if (!parentId) return failure("Invalid module");
  const parsed = parseInput(pastPaperSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    createPastPaper(getDb(), parentId, parsed.data);
    return undefined;
  });
}

export async function updatePastPaperAction(id: number, formData: FormData): Promise<ActionResult> {
  const paperId = parseId(id);
  if (!paperId) return failure("Invalid past paper");
  const parsed = parseInput(pastPaperSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updatePastPaper(getDb(), paperId, parsed.data);
    return undefined;
  });
}

export async function deletePastPaperAction(id: number): Promise<ActionResult> {
  const paperId = parseId(id);
  if (!paperId) return failure("Invalid past paper");
  return guard(() => {
    deleteStored(uploadsDir, deletePastPaper(getDb(), paperId).files);
    return undefined;
  });
}
