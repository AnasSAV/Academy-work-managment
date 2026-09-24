"use server";

import { getDb } from "@/db";
import { seedDatabase } from "@/db/seed";
import { failure, guard, type ActionResult } from "./helpers";

/** Load Semester 07, its six modules and the Computer Networks and Security chapters. */
export async function loadStarterDataAction(): Promise<ActionResult> {
  const result = guard(() => seedDatabase(getDb()).seeded);
  if (!result.ok) return result;
  return result.data ? { ok: true, data: undefined } : failure("Semester 07 already exists");
}
