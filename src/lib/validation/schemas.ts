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

const optionalNumber = (label: string, min: number, max: number, opts: { int?: boolean } = {}) =>
  z.preprocess(
    (v) => {
      const b = blankToNull(v);
      return typeof b === "string" ? Number(b) : b;
    },
    (opts.int
      ? z
          .number({ error: `${label} must be a whole number` })
          .int(`${label} must be a whole number`)
      : z.number({ error: `${label} must be a number` })
    )
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .nullable(),
  );

const requiredNumber = (label: string, min: number, max: number, opts: { int?: boolean } = {}) =>
  optionalNumber(label, min, max, opts).pipe(z.number({ error: `${label} is required` }));

/** Checkbox: browsers send "on" when ticked and nothing when not. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

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

export const activityTypeSchema = z.object({
  label: requiredText("Name", 50),
  weight: requiredNumber("Weight", 0, 1000),
  tracksCounts: checkbox,
});

export const activityCountsSchema = z
  .object({
    countDone: optionalNumber("Done", 0, 100000, { int: true }),
    countTotal: optionalNumber("Total", 0, 100000, { int: true }),
  })
  .refine((v) => v.countTotal === null || v.countDone === null || v.countDone <= v.countTotal, {
    path: ["countDone"],
    error: "Done cannot be more than the total",
  });

/** OneNote links can be https:// URLs or onenote: protocol links. */
const noteLink = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(2000, "Link is too long")
    .regex(/^(https?:\/\/|onenote:)/i, "Link must start with https://, http:// or onenote:")
    .nullable(),
);

export const chapterDetailsSchema = z.object({
  confidence: optionalNumber("Confidence", 1, 5, { int: true }),
  lastReviewedAt: optionalDate("Last reviewed"),
  note: optionalText("Note", 4000),
  onenoteUrl: noteLink,
});

/** Formula settings. The form works in percent; storage uses a 0-1 fraction. */
export const settingsSchema = z
  .object({
    readinessChapterPercent: requiredNumber("Chapters share", 0, 100),
    reviseAfterDays: requiredNumber("Revise after (days)", 1, 365, { int: true }),
  })
  .transform((v) => ({
    readinessChapterWeight: v.readinessChapterPercent / 100,
    reviseAfterDays: v.reviseAfterDays,
  }));

export const moveDirectionSchema = z.enum(["up", "down"]);

export type SemesterInput = z.infer<typeof semesterSchema>;
export type ModuleInput = z.infer<typeof moduleSchema>;
export type ActivityTypeInput = z.infer<typeof activityTypeSchema>;
export type ChapterDetailsInput = z.infer<typeof chapterDetailsSchema>;
export type MoveDirection = z.infer<typeof moveDirectionSchema>;
