"use server";

import { getDb } from "@/db";
import {
  createAssessment,
  createTag,
  deleteAssessment,
  deleteTag,
  moveAssessment,
  updateAssessment,
  updateTag,
} from "@/db/assessments";
import { uploadsDir } from "@/db/config";
import { deleteStored } from "@/lib/storage";
import { parseInput } from "@/lib/validation/parse";
import { assessmentSchema, tagSchema } from "@/lib/validation/schemas";
import { failure, guard, parseDirection, parseId, type ActionResult } from "./helpers";

export async function createAssessmentAction(
  moduleId: number,
  formData: FormData,
): Promise<ActionResult> {
  const parentId = parseId(moduleId);
  if (!parentId) return failure("Invalid module");
  const parsed = parseInput(assessmentSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    createAssessment(getDb(), parentId, parsed.data);
    return undefined;
  });
}

export async function updateAssessmentAction(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const assessmentId = parseId(id);
  if (!assessmentId) return failure("Invalid assessment");
  const parsed = parseInput(assessmentSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updateAssessment(getDb(), assessmentId, parsed.data);
    return undefined;
  });
}

export async function deleteAssessmentAction(id: number): Promise<ActionResult> {
  const assessmentId = parseId(id);
  if (!assessmentId) return failure("Invalid assessment");
  return guard(() => {
    deleteStored(uploadsDir, deleteAssessment(getDb(), assessmentId).files);
    return undefined;
  });
}

export async function moveAssessmentAction(id: number, direction: string): Promise<ActionResult> {
  const assessmentId = parseId(id);
  const dir = parseDirection(direction);
  if (!assessmentId || !dir) return failure("Invalid request");
  return guard(() => {
    moveAssessment(getDb(), assessmentId, dir);
    return undefined;
  });
}

export async function createTagAction(moduleId: number, formData: FormData): Promise<ActionResult> {
  const parentId = parseId(moduleId);
  if (!parentId) return failure("Invalid module");
  const parsed = parseInput(tagSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    createTag(getDb(), parentId, parsed.data);
    return undefined;
  });
}

export async function updateTagAction(id: number, formData: FormData): Promise<ActionResult> {
  const tagId = parseId(id);
  if (!tagId) return failure("Invalid tag");
  const parsed = parseInput(tagSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updateTag(getDb(), tagId, parsed.data);
    return undefined;
  });
}

export async function deleteTagAction(id: number): Promise<ActionResult> {
  const tagId = parseId(id);
  if (!tagId) return failure("Invalid tag");
  return guard(() => {
    deleteTag(getDb(), tagId);
    return undefined;
  });
}
