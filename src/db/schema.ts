import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Conventions
 * - Dates are ISO strings: "YYYY-MM-DD" for calendar dates, full ISO for timestamps.
 * - `position` columns order siblings (0-based, gaps allowed).
 * - Deleting a parent cascades to its children at the database level. The UI asks for
 *   confirmation first. Attachments are polymorphic (no foreign key), so a shared delete helper
 *   (added with file uploads) must remove their rows and files when an owner is deleted.
 */

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const semesters = sqliteTable("semester", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const modules = sqliteTable(
  "module",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    semesterId: integer("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    credits: real("credits"),
    /** Free text, e.g. "NdS, RTU, AF". */
    lecturers: text("lecturers"),
    /** Hex colour such as "#3b82f6". */
    color: text("color").notNull().default("#3b82f6"),
    /** Target grade as a percentage of total marks. */
    targetGrade: real("target_grade"),
    examDate: text("exam_date"),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("module_semester_idx").on(t.semesterId, t.position)],
);

/**
 * Per-module checklist activity definitions. The four built-ins (learned, notes, questions,
 * revised) are created with every module; custom ones can be added. `weight` feeds the chapter
 * progress formula and is re-normalised over the module's activity types.
 */
export const activityTypes = sqliteTable(
  "activity_type",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    /** Stable key for built-ins ("learned" | "notes" | "questions" | "revised"); null for custom. */
    key: text("key"),
    label: text("label").notNull(),
    weight: real("weight").notNull().default(0),
    /** Whether done/total counts are tracked (used by "questions"). */
    tracksCounts: integer("tracks_counts", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    uniqueIndex("activity_type_module_label_uq").on(t.moduleId, t.label),
    check("activity_type_weight_ck", sql`${t.weight} >= 0`),
  ],
);

export const chapters = sqliteTable(
  "chapter",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    /** 1 (shaky) to 5 (confident); null until rated. */
    confidence: integer("confidence"),
    lastReviewedAt: text("last_reviewed_at"),
    note: text("note"),
    onenoteUrl: text("onenote_url"),
    createdAt: createdAt(),
  },
  (t) => [
    index("chapter_module_idx").on(t.moduleId, t.position),
    check("chapter_confidence_ck", sql`${t.confidence} IS NULL OR ${t.confidence} BETWEEN 1 AND 5`),
  ],
);

/**
 * One row per (chapter, activity type), created lazily on first change. A missing row means
 * "not done", so adding a custom activity type never needs a backfill.
 */
export const chapterActivities = sqliteTable(
  "chapter_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chapterId: integer("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    activityTypeId: integer("activity_type_id")
      .notNull()
      .references(() => activityTypes.id, { onDelete: "cascade" }),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
    countDone: integer("count_done"),
    countTotal: integer("count_total"),
    /** How many times the chapter has been revised (used by the "revised" activity). */
    revisionCount: integer("revision_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("chapter_activity_uq").on(t.chapterId, t.activityTypeId),
    check("chapter_activity_counts_ck", sql`${t.countDone} IS NULL OR ${t.countDone} >= 0`),
  ],
);

export const pastPapers = sqliteTable(
  "past_paper",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    year: integer("year"),
    title: text("title").notNull(),
    attempted: integer("attempted", { mode: "boolean" }).notNull().default(false),
    score: real("score"),
    maxScore: real("max_score"),
    minutesTaken: integer("minutes_taken"),
    attemptedAt: text("attempted_at"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("past_paper_module_idx").on(t.moduleId)],
);

export const ASSESSMENT_STATUSES = ["not_started", "in_progress", "submitted", "graded"] as const;
export const WORK_MODES = ["individual", "group", "unspecified"] as const;

export const assessments = sqliteTable(
  "assessment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Free text, e.g. "NdS". */
    lecturer: text("lecturer"),
    /** Weight as a percentage of the module grade (0-100). */
    weight: real("weight").notNull().default(0),
    dueDate: text("due_date"),
    status: text("status", { enum: ASSESSMENT_STATUSES }).notNull().default("not_started"),
    score: real("score"),
    maxScore: real("max_score").notNull().default(100),
    workMode: text("work_mode", { enum: WORK_MODES }).notNull().default("unspecified"),
    groupSize: integer("group_size"),
    groupMembers: text("group_members"),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("assessment_module_idx").on(t.moduleId, t.position),
    check("assessment_weight_ck", sql`${t.weight} BETWEEN 0 AND 100`),
    check("assessment_max_score_ck", sql`${t.maxScore} > 0`),
  ],
);

/** Reusable per-module label. The meaning lives in `description` (e.g. "* = takes place in class"). */
export const tags = sqliteTable(
  "tag",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
  },
  (t) => [uniqueIndex("tag_module_name_uq").on(t.moduleId, t.name)],
);

export const assessmentTags = sqliteTable(
  "assessment_tag",
  {
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.assessmentId, t.tagId] }),
    index("assessment_tag_tag_idx").on(t.tagId),
  ],
);

export const ATTACHMENT_OWNER_TYPES = [
  "semester",
  "module",
  "chapter",
  "assessment",
  "past_paper",
] as const;
export const ATTACHMENT_KINDS = [
  "outline",
  "slides",
  "notes",
  "past_paper",
  "marking_scheme",
  "other",
] as const;

/** Metadata for a file stored under the uploads directory. Owner is polymorphic (no FK). */
export const attachments = sqliteTable(
  "attachment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerType: text("owner_type", { enum: ATTACHMENT_OWNER_TYPES }).notNull(),
    ownerId: integer("owner_id").notNull(),
    kind: text("kind", { enum: ATTACHMENT_KINDS }).notNull().default("other"),
    /** Path relative to the uploads directory. */
    path: text("path").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("attachment_owner_idx").on(t.ownerType, t.ownerId)],
);

/** Stretch: minutes studied, per module and optionally per chapter. */
export const studyLogs = sqliteTable(
  "study_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    minutes: integer("minutes").notNull(),
    date: text("date").notNull(),
    note: text("note"),
  },
  (t) => [
    index("study_log_module_date_idx").on(t.moduleId, t.date),
    check("study_log_minutes_ck", sql`${t.minutes} > 0`),
  ],
);

/** Key/value app settings (values are JSON). Missing keys fall back to code defaults. */
export const settings = sqliteTable("setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Semester = typeof semesters.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type ActivityType = typeof activityTypes.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type ChapterActivity = typeof chapterActivities.$inferSelect;
export type PastPaper = typeof pastPapers.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type StudyLog = typeof studyLogs.$inferSelect;
