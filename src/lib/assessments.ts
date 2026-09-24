/**
 * Pure rules for assessments and past papers: normalising input, summarising weights, and
 * filtering. No database access, so it is shared by the server and the tests.
 */

export type WorkMode = "individual" | "group" | "unspecified";
export type AssessmentStatus = "not_started" | "in_progress" | "submitted" | "graded";

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  individual: "Individual",
  group: "Group",
  unspecified: "Unspecified",
};

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  graded: "Graded",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** score / max as a percentage, or null when there is no usable score. */
export function scorePercent(score: number | null, maxScore: number | null): number | null {
  if (score === null || maxScore === null || maxScore <= 0) return null;
  return round2((score / maxScore) * 100);
}

interface NormalizableAssessment {
  status: AssessmentStatus;
  score: number | null;
  workMode: WorkMode;
  groupSize: number | null;
  groupMembers: string | null;
}

/**
 * Apply the rules that keep an assessment consistent:
 * - entering a score means it has been graded;
 * - group size and members only make sense for group work.
 */
export function normalizeAssessment<T extends NormalizableAssessment>(input: T): T {
  const isGroup = input.workMode === "group";
  return {
    ...input,
    status: input.score !== null ? "graded" : input.status,
    groupSize: isGroup ? input.groupSize : null,
    groupMembers: isGroup ? input.groupMembers : null,
  };
}

interface NormalizablePastPaper {
  attempted: boolean;
  score: number | null;
  maxScore: number | null;
  minutesTaken: number | null;
  attemptedAt: string | null;
}

/**
 * - a score means the paper was attempted;
 * - a scored paper without a maximum is out of 100;
 * - a paper that was not attempted carries no score, time or date.
 */
export function normalizePastPaper<T extends NormalizablePastPaper>(input: T): T {
  const attempted = input.attempted || input.score !== null;
  if (!attempted) {
    return {
      ...input,
      attempted: false,
      score: null,
      maxScore: null,
      minutesTaken: null,
      attemptedAt: null,
    };
  }
  return {
    ...input,
    attempted: true,
    maxScore: input.score !== null ? (input.maxScore ?? 100) : input.maxScore,
  };
}

export interface WeightSummary {
  total: number;
  /** 100 - total; negative when over-allocated. */
  remaining: number;
  state: "empty" | "complete" | "under" | "over";
}

/** Do the weights add up to 100%? Tolerates rounding noise. */
export function weightSummary(items: { weight: number }[]): WeightSummary {
  const total = round2(items.reduce((sum, a) => sum + a.weight, 0));
  const remaining = round2(100 - total);
  const state =
    items.length === 0
      ? "empty"
      : Math.abs(remaining) < 0.005
        ? "complete"
        : remaining > 0
          ? "under"
          : "over";
  return { total, remaining, state };
}

/** Total weight per work mode. */
export function weightByWorkMode(items: { weight: number; workMode: WorkMode }[]) {
  const totals: Record<WorkMode, number> = { individual: 0, group: 0, unspecified: 0 };
  for (const a of items) totals[a.workMode] = round2(totals[a.workMode] + a.weight);
  return totals;
}

export interface AssessmentFilter {
  mode?: WorkMode | null;
  tagId?: number | null;
}

export function filterAssessments<T extends { workMode: WorkMode; tags: { id: number }[] }>(
  items: T[],
  filter: AssessmentFilter,
): T[] {
  return items.filter(
    (a) =>
      (!filter.mode || a.workMode === filter.mode) &&
      (!filter.tagId || a.tags.some((t) => t.id === filter.tagId)),
  );
}

export function parseWorkMode(value: unknown): WorkMode | null {
  return value === "individual" || value === "group" || value === "unspecified" ? value : null;
}
