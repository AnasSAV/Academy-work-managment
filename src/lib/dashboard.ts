import {
  activityCompletion,
  meanProgress,
  toPercent,
  type ActivityDef,
  type ActivityState,
} from "./progress";

/**
 * Pure helpers behind the dashboard charts: bucketing, choosing the current semester, and turning
 * rows into chart-ready series. No database, no dates other than what is passed in.
 */

// ---- heatmap -----------------------------------------------------------------------------------

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export const HEAT_LABELS: Record<HeatLevel, string> = {
  0: "Not started",
  1: "1–33%",
  2: "34–66%",
  3: "67–99%",
  4: "Complete",
};

/**
 * Bucket a 0–1 progress value into five classes: untouched, three stages, complete. Based on the
 * rounded percentage that is displayed, so a cell never disagrees with its own label (99.6% shows
 * as 100% and counts as complete).
 */
export function heatLevel(progress: number): HeatLevel {
  const pct = toPercent(progress);
  if (pct <= 0) return 0;
  if (pct <= 33) return 1;
  if (pct <= 66) return 2;
  if (pct < 100) return 3;
  return 4;
}

// ---- choosing what to show ---------------------------------------------------------------------

interface DatedSemester {
  id: number;
  startDate: string | null;
  endDate: string | null;
  position: number;
}

/**
 * The semester the dashboard opens on: the one running today; otherwise the most recent one that
 * has already started; otherwise the first in the list. Null when there are no semesters.
 */
export function pickCurrentSemester<T extends DatedSemester>(
  semesters: T[],
  today: string,
): T | null {
  if (semesters.length === 0) return null;
  const ordered = [...semesters].sort((a, b) => a.position - b.position || a.id - b.id);

  const running = ordered.find(
    (s) =>
      (s.startDate !== null || s.endDate !== null) &&
      (s.startDate === null || s.startDate <= today) &&
      (s.endDate === null || today <= s.endDate),
  );
  if (running) return running;

  const started = ordered
    .filter((s) => s.startDate !== null && s.startDate <= today)
    .sort((a, b) => (b.startDate as string).localeCompare(a.startDate as string));
  return started[0] ?? ordered[0];
}

// ---- module insights ---------------------------------------------------------------------------

export interface ActivityBar {
  typeId: number;
  label: string;
  /** Mean completion across chapters, 0 to 1 (partial question counts included). */
  value: number;
  /** Chapters where this activity is fully done. */
  doneChapters: number;
  totalChapters: number;
}

/** How far along each activity is across all of a module's chapters. */
export function activityBreakdown(
  types: (ActivityDef & { label: string })[],
  chapters: { states: Map<number, ActivityState> }[],
): ActivityBar[] {
  return types.map((type) => {
    const completions = chapters.map((c) => activityCompletion(type, c.states.get(type.id)));
    return {
      typeId: type.id,
      label: type.label,
      value: meanProgress(completions),
      doneChapters: completions.filter((v) => v >= 1).length,
      totalChapters: chapters.length,
    };
  });
}

export interface TrendPoint {
  id: number;
  title: string;
  year: number | null;
  date: string | null;
  /** Score as a percentage, 0 to 100+. */
  percent: number;
}

interface TrendPaper {
  id: number;
  title: string;
  year: number | null;
  attempted: boolean;
  score: number | null;
  maxScore: number | null;
  attemptedAt: string | null;
}

/**
 * Scored attempts in the order they were taken: by date attempted, then by exam year, then by
 * when they were logged. Papers without a usable score are left out.
 */
export function paperTrend(papers: TrendPaper[]): TrendPoint[] {
  return papers
    .filter((p) => p.attempted && p.score !== null && p.maxScore !== null && p.maxScore > 0)
    .map((p) => ({
      id: p.id,
      title: p.title,
      year: p.year,
      date: p.attemptedAt,
      percent: Math.round(((p.score as number) / (p.maxScore as number)) * 1000) / 10,
    }))
    .sort((a, b) => {
      if (a.date !== b.date) {
        if (a.date === null) return 1;
        if (b.date === null) return -1;
        return a.date.localeCompare(b.date);
      }
      return (a.year ?? 0) - (b.year ?? 0) || a.id - b.id;
    });
}

export type StatusKey = "graded" | "submitted" | "in_progress" | "not_started";

export const STATUS_ORDER: StatusKey[] = ["graded", "submitted", "in_progress", "not_started"];

export interface WeightSegment {
  key: StatusKey | "unallocated";
  weight: number;
}

export interface WeightBreakdown {
  segments: WeightSegment[];
  /** What the ring is measured against: 100, or the total when weights exceed 100. */
  whole: number;
  total: number;
  /** Weight of graded components, as a share of `whole` (0 to 1). */
  gradedShare: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Split assessment weight by how far each component has got. Weight not yet allocated to any
 * component (when the total is under 100) is its own segment so the ring is always complete.
 */
export function weightByStatus(items: { weight: number; status: StatusKey }[]): WeightBreakdown {
  const total = round2(items.reduce((sum, a) => sum + a.weight, 0));
  const whole = Math.max(100, total);
  const segments: WeightSegment[] = STATUS_ORDER.map((key) => ({
    key,
    weight: round2(items.filter((a) => a.status === key).reduce((sum, a) => sum + a.weight, 0)),
  }));
  const unallocated = round2(whole - total);
  if (unallocated > 0) segments.push({ key: "unallocated", weight: unallocated });
  const graded = segments.find((s) => s.key === "graded")?.weight ?? 0;
  return { segments, whole, total, gradedShare: whole > 0 ? graded / whole : 0 };
}
