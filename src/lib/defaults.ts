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

/**
 * Default module colours, assigned in order. These are the first slots of the validated
 * categorical palette: neighbours stay distinguishable under colour-vision deficiency (adjacent
 * separation of at least 8 in OKLab x100 in light mode) and for full-colour readers (at least 15).
 * Some sit below 3:1 contrast on white, so a colour is only ever a small mark beside a text label.
 */
export const MODULE_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;
