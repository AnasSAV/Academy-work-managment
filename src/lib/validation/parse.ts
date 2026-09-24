import { z } from "zod";

export type FieldErrors = Record<string, string>;

export type ParseResult<T> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors: FieldErrors };

/** Validate a form submission (or any plain object) against a schema. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  input: FormData | Record<string, unknown>,
): ParseResult<z.output<S>> {
  const raw = input instanceof FormData ? Object.fromEntries(input) : input;
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, error: result.error.issues[0]?.message ?? "Invalid input", fieldErrors };
}
