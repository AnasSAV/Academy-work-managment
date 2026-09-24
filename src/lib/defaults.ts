/** Built-in activity types created for every module. Weights are the documented defaults. */
export const DEFAULT_ACTIVITY_TYPES = [
  { key: "learned", label: "Learned", weight: 40, tracksCounts: false },
  { key: "questions", label: "Questions done", weight: 30, tracksCounts: true },
  { key: "notes", label: "Notes made", weight: 15, tracksCounts: false },
  { key: "revised", label: "Revised", weight: 15, tracksCounts: false },
] as const;

/** Default app settings; stored overrides live in the `setting` table. */
export const DEFAULT_SETTINGS = {
  /** Module readiness = chapters * chapterWeight + past papers * (1 - chapterWeight). */
  readinessChapterWeight: 0.7,
  /** A chapter counts as "not revised recently" after this many days. */
  reviseAfterDays: 14,
} as const;

/** Distinct module colours, assigned in order. */
export const MODULE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
] as const;
