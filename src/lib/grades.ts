/**
 * Grade calculations for one module. Pure functions, no database.
 *
 * A module grade is measured in points out of a "basis". Each assessment is worth its weight in
 * points, and scoring 80% on a 10-weight component earns 8 points. The basis is 100 when the
 * weights add up to 100 or less. When they add up to more (a mistake the UI warns about) the basis
 * is the total, so the grade can never exceed 100%. Weight that has not been allocated to any
 * component (a total under 100) can never be earned, so it is left out of what is "still
 * available" and is reported separately.
 *
 * Only components with a score count as graded. Everything else is outstanding.
 */

export interface GradeItem {
  id: number;
  name: string;
  /** Weight as a percentage of the module grade. */
  weight: number;
  score: number | null;
  maxScore: number;
}

const clampMin0 = (n: number) => Math.max(0, n);

/** Score as a percentage of its maximum, or null when it has no usable score. */
export function itemPercent(item: Pick<GradeItem, "score" | "maxScore">): number | null {
  if (item.score === null || item.maxScore <= 0) return null;
  return clampMin0((item.score / item.maxScore) * 100);
}

export interface GradeSummary {
  /** Sum of all weights. */
  total: number;
  /** What the grade is measured against: 100, or the total when it is over 100. */
  basis: number;
  /** Weight not given to any component (basis minus total). Cannot be earned. */
  unallocated: number;
  gradedWeight: number;
  gradedCount: number;
  /** Weight of components still to be graded. */
  outstanding: number;
  outstandingCount: number;
  /** Points earned so far. */
  earned: number;
  /** Points dropped on graded work (graded weight minus earned). */
  lost: number;
  /** Average score on graded work, as a percentage. Null when nothing is graded. */
  average: number | null;
  /** Grade so far as a percentage of the whole module grade. */
  gradePercent: number;
  /** The best possible final grade: full marks on everything outstanding. */
  bestCase: number;
  /** The final grade if every outstanding component scores the current average. */
  atCurrentAverage: number | null;
}

export function summarizeGrades(items: GradeItem[]): GradeSummary {
  const total = Math.round(items.reduce((sum, i) => sum + i.weight, 0) * 100) / 100;
  const basis = Math.max(100, total);

  let gradedWeight = 0;
  let gradedCount = 0;
  let earned = 0;
  for (const item of items) {
    const pct = itemPercent(item);
    if (pct === null) continue;
    gradedWeight += item.weight;
    gradedCount += 1;
    earned += (item.weight * pct) / 100;
  }
  const outstanding = total - gradedWeight;
  const average = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;

  return {
    total,
    basis,
    unallocated: basis - total,
    gradedWeight,
    gradedCount,
    outstanding,
    outstandingCount: items.length - gradedCount,
    earned,
    lost: gradedWeight - earned,
    average,
    gradePercent: (earned / basis) * 100,
    bestCase: ((earned + outstanding) / basis) * 100,
    atCurrentAverage:
      average === null ? null : ((earned + (outstanding * average) / 100) / basis) * 100,
  };
}

export type TargetStatus =
  /** No target has been set. */
  | { kind: "none" }
  /** The target is already met, even if everything left scores zero. `margin` is in grade points. */
  | { kind: "secured"; margin: number }
  /** The average needed across all the outstanding weight. */
  | { kind: "needed"; average: number }
  /** Even full marks on everything outstanding falls short. */
  | { kind: "unreachable"; bestCase: number }
  /** Nothing is left to be graded and the target was missed. */
  | { kind: "finished"; final: number; short: number };

/** What it takes to reach a target grade (a percentage of the whole module grade). */
export function targetStatus(summary: GradeSummary, target: number | null): TargetStatus {
  if (target === null || !Number.isFinite(target)) return { kind: "none" };

  const targetPoints = (target / 100) * summary.basis;
  const gap = targetPoints - summary.earned;
  if (gap <= 1e-9) return { kind: "secured", margin: (-gap / summary.basis) * 100 };

  if (summary.outstanding <= 1e-9) {
    return { kind: "finished", final: summary.gradePercent, short: target - summary.gradePercent };
  }
  const average = (gap / summary.outstanding) * 100;
  if (average > 100 + 1e-9) return { kind: "unreachable", bestCase: summary.bestCase };
  return { kind: "needed", average };
}

export interface Projection {
  /** Projected final grade as a percentage of the whole module grade. */
  grade: number;
  /** Outstanding components that used an assumed score. */
  assumed: number;
  /** Outstanding components with no assumed score, counted as zero. */
  unfilled: number;
}

/**
 * What-if: keep every graded score, and give each outstanding component an assumed percentage.
 * `assumed` is per component id; `fallback` covers components not listed. A component with neither
 * counts as zero and is reported in `unfilled`.
 */
export function projectGrade(
  items: GradeItem[],
  assumed: Record<number, number | null | undefined>,
  fallback: number | null,
): Projection {
  const summary = summarizeGrades(items);
  let points = summary.earned;
  let assumedCount = 0;
  let unfilled = 0;

  for (const item of items) {
    if (itemPercent(item) !== null) continue;
    const pct = assumed[item.id] ?? fallback;
    if (pct === null || pct === undefined || !Number.isFinite(pct)) {
      unfilled += 1;
      continue;
    }
    assumedCount += 1;
    points += (item.weight * Math.min(Math.max(pct, 0), 100)) / 100;
  }
  return { grade: (points / summary.basis) * 100, assumed: assumedCount, unfilled };
}

/** Format a percentage for display: at most one decimal, no trailing ".0". */
export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}
