"use server";

import { getDb } from "@/db";
import { updateSettings } from "@/db/settings";
import { parseInput } from "@/lib/validation/parse";
import { settingsSchema } from "@/lib/validation/schemas";
import { failure, guard, type ActionResult } from "./helpers";

export async function updateSettingsAction(formData: FormData): Promise<ActionResult> {
  const parsed = parseInput(settingsSchema, formData);
  if (!parsed.ok) return failure(parsed.error, parsed.fieldErrors);
  return guard(() => {
    updateSettings(getDb(), parsed.data);
    return undefined;
  });
}
