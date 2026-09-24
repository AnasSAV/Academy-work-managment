"use server";

import { getDb } from "@/db";
import { createSemester, deleteSemester, moveSemester, updateSemester } from "@/db/services";
import { parseInput } from "@/lib/validation/parse";
import { semesterSchema } from "@/lib/validation/schemas";
import { failure, guard, parseDirection, parseId, type ActionResult } from "./helpers";

export async function createSemesterAction(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  const parsed = parseInput(semesterSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => ({ id: createSemester(getDb(), parsed.data).id }));
}

export async function updateSemesterAction(id: number, formData: FormData): Promise<ActionResult> {
  const semesterId = parseId(id);
  if (!semesterId) return failure("Invalid semester");
  const parsed = parseInput(semesterSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updateSemester(getDb(), semesterId, parsed.data);
    return undefined;
  });
}

export async function deleteSemesterAction(id: number): Promise<ActionResult> {
  const semesterId = parseId(id);
  if (!semesterId) return failure("Invalid semester");
  return guard(() => {
    deleteSemester(getDb(), semesterId);
    return undefined;
  });
}

export async function moveSemesterAction(id: number, direction: string): Promise<ActionResult> {
  const semesterId = parseId(id);
  const dir = parseDirection(direction);
  if (!semesterId || !dir) return failure("Invalid request");
  return guard(() => {
    moveSemester(getDb(), semesterId, dir);
    return undefined;
  });
}
