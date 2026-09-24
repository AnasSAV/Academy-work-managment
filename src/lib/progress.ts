/**
 * Progress formulas. Everything here is pure: no database, no dates. All results are fractions
 * between 0 and 1; use `toPercent` for display. The formulas are documented in the README.
 *
 * Chapter progress = weighted average of its activities (weights come from the module's activity
 * types and are re-normalised, so they need not sum to 100).
 *   - a ticked activity counts as complete
 *   - an unticked activity that tracks counts contributes countDone / countTotal
 *   - otherwise it contributes 0
 * Module chapter progress = plain mean of its chapters' progress (0 with no chapters).
 * Past-paper progress = coverage (attempted / logged) x performance (mean score of scored attempts).
 * Module readiness = chapters x w + past papers x (1 - w), falling back to whichever part exists.
 */

export interface ActivityDef {
  id: number;
  weight: number;
  tracksCounts: boolean;
}

export interface ActivityState {
  activityTypeId: number;
  done: boolean;
  countDone: number | null;
  countTotal: number | null;
}

export interface PastPaperScore {
  attempted: boolean;
  score: number | null;
  maxScore: number | null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function toPercent(fraction: number): number {
  return Math.round(clamp01(fraction) * 100);
}

/** How complete one activity is, from 0 to 1. */
export function activityCompletion(def: ActivityDef, state: ActivityState | undefined): number {
  if (!state) return 0;
  if (state.done) return 1;
  if (def.tracksCounts && state.countTotal && state.countTotal > 0) {
    return clamp01((state.countDone ?? 0) / state.countTotal);
  }
  return 0;
}

/** Weighted average completion across a module's activity types. */
export function chapterProgress(defs: ActivityDef[], states: ActivityState[]): number {
  const byType = new Map(states.map((s) => [s.activityTypeId, s]));
  let totalWeight = 0;
  let earned = 0;
  for (const def of defs) {
    const weight = Math.max(0, def.weight);
    totalWeight += weight;
    earned += weight * activityCompletion(def, byType.get(def.id));
  }
  return totalWeight > 0 ? earned / totalWeight : 0;
}

export function meanProgress(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Past-paper progress, or null when no papers are logged (so it does not drag readiness down
 * before the student has started). Attempts without a score count towards coverage only.
 */
export function pastPaperProgress(papers: PastPaperScore[]): number | null {
  if (papers.length === 0) return null;
  const attempted = papers.filter((p) => p.attempted);
  const coverage = attempted.length / papers.length;

  const fractions = attempted
    .filter((p) => p.score != null && p.maxScore != null && p.maxScore > 0)
    .map((p) => clamp01(p.score! / p.maxScore!));
  const performance = fractions.length > 0 ? meanProgress(fractions) : 1;

  return coverage * performance;
}

export interface ReadinessInput {
  chapters: number;
  hasChapters: boolean;
  pastPapers: number | null;
  /** Share of readiness given to chapters, 0 to 1 (default 0.7). */
  chapterWeight: number;
}

export function moduleReadiness({
  chapters,
  hasChapters,
  pastPapers,
  chapterWeight,
}: ReadinessInput): number {
  const w = clamp01(chapterWeight);
  if (hasChapters && pastPapers !== null) return clamp01(w * chapters + (1 - w) * pastPapers);
  if (hasChapters) return clamp01(chapters);
  if (pastPapers !== null) return clamp01(pastPapers);
  return 0;
}
