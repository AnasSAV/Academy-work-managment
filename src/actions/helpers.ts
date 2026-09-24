import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NotFoundError, RuleError } from "@/db/errors";
import { moveDirectionSchema, type MoveDirection } from "@/lib/validation/schemas";
import type { FieldErrors } from "@/lib/validation/parse";

/** What every mutation returns to the client. Errors are values, not exceptions. */
export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };

export function failure(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

const idSchema = z.number().int().positive();

export function parseId(id: unknown): number | null {
  const r = idSchema.safeParse(id);
  return r.success ? r.data : null;
}

export function parseDirection(direction: unknown): MoveDirection | null {
  const r = moveDirectionSchema.safeParse(direction);
  return r.success ? r.data : null;
}

/** Run a database operation, turning known and unexpected errors into a failure result. */
export function guard<T>(fn: () => T): ActionResult<T> {
  try {
    const data = fn();
    // Navigation and every list depend on the data, so refresh the whole app.
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof RuleError) return failure(error.message);
    console.error(error);
    return failure("Something went wrong. Please try again.");
  }
}
