import { z } from "zod";

export type FieldErrors = Record<string, string>;

export type ParseResult<T> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors: FieldErrors };

/** Like Object.fromEntries, but a key that appears more than once (checkboxes) becomes an array. */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (!(key in out)) out[key] = value;
    else
      out[key] = Array.isArray(out[key]) ? [...(out[key] as unknown[]), value] : [out[key], value];
  }
  return out;
}

/** Validate a form submission (or any plain object) against a schema. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  input: FormData | Record<string, unknown>,
): ParseResult<z.output<S>> {
  const raw = input instanceof FormData ? formDataToObject(input) : input;
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, error: result.error.issues[0]?.message ?? "Invalid input", fieldErrors };
}
