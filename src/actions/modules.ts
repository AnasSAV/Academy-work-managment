"use server";

import { getDb } from "@/db";
import { createModule, deleteModule, moveModule, updateModule } from "@/db/services";
import { parseInput } from "@/lib/validation/parse";
import { moduleSchema } from "@/lib/validation/schemas";
import { failure, guard, parseDirection, parseId, type ActionResult } from "./helpers";

export async function createModuleAction(
  semesterId: number,
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  const parentId = parseId(semesterId);
  if (!parentId) return failure("Invalid semester");
  const parsed = parseInput(moduleSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => ({ id: createModule(getDb(), parentId, parsed.data).id }));
}

export async function updateModuleAction(id: number, formData: FormData): Promise<ActionResult> {
  const moduleId = parseId(id);
  if (!moduleId) return failure("Invalid module");
  const parsed = parseInput(moduleSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updateModule(getDb(), moduleId, parsed.data);
    return undefined;
  });
}

/** Returns the semester id so the caller can navigate there afterwards. */
export async function deleteModuleAction(
  id: number,
): Promise<ActionResult<{ semesterId: number }>> {
  const moduleId = parseId(id);
  if (!moduleId) return failure("Invalid module");
  return guard(() => ({ semesterId: deleteModule(getDb(), moduleId).semesterId }));
}

export async function moveModuleAction(id: number, direction: string): Promise<ActionResult> {
  const moduleId = parseId(id);
  const dir = parseDirection(direction);
  if (!moduleId || !dir) return failure("Invalid request");
  return guard(() => {
    moveModule(getDb(), moduleId, dir);
    return undefined;
  });
}
