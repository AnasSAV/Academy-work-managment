import { z } from "zod";

/** Treat missing and blank form values as "not provided". */
const blankToNull = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (label: string, max: number) =>
  z.preprocess(
    blankToNull,
    z.string().trim().max(max, `${label} must be at most ${max} characters`).nullable(),
  );

const optionalDate = (label: string) =>
  z.preprocess(blankToNull, z.iso.date({ error: `${label} must be a valid date` }).nullable());

const optionalNumber = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => {
      const b = blankToNull(v);
      return typeof b === "string" ? Number(b) : b;
    },
    z
      .number({ error: `${label} must be a number` })
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .nullable(),
  );

export const semesterSchema = z
  .object({
    name: requiredText("Name", 100),
    startDate: optionalDate("Start date"),
    endDate: optionalDate("End date"),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    error: "End date must be on or after the start date",
  });

export const moduleSchema = z.object({
  name: requiredText("Name", 150),
  code: optionalText("Code", 30),
  credits: optionalNumber("Credits", 0, 100),
  lecturers: optionalText("Lecturers", 200),
  color: z
    .string({ error: "Colour is required" })
    .regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value like #3b82f6"),
  targetGrade: optionalNumber("Target grade", 0, 100),
  examDate: optionalDate("Exam date"),
  notes: optionalText("Notes", 2000),
});

export const chapterTitleSchema = z.object({ title: requiredText("Title", 200) });

const MAX_CHAPTERS_PER_ADD = 200;

/** One chapter per non-blank line. */
export const chapterLinesSchema = z.object({
  lines: z
    .string({ error: "Enter at least one chapter title" })
    .transform((s) =>
      s
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(200, "Each title must be at most 200 characters"))
        .min(1, "Enter at least one chapter title")
        .max(MAX_CHAPTERS_PER_ADD, `Add at most ${MAX_CHAPTERS_PER_ADD} chapters at a time`),
    ),
});

export const moveDirectionSchema = z.enum(["up", "down"]);

export type SemesterInput = z.infer<typeof semesterSchema>;
export type ModuleInput = z.infer<typeof moduleSchema>;
export type MoveDirection = z.infer<typeof moveDirectionSchema>;
