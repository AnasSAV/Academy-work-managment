import { addDays, daysBetween } from "./dates";
import { toPercent } from "./progress";

/**
 * Board columns, spaced-revision timing, "needs attention" and deadlines. Pure functions: every
 * "today" is passed in, so results are deterministic.
 */

// ---- board -------------------------------------------------------------------------------------

export type BoardStatus = "to_learn" | "learning" | "revising" | "done";

export const BOARD_STATUSES: BoardStatus[] = ["to_learn", "learning", "revising", "done"];

export const BOARD_LABELS: Record<BoardStatus, string> = {
  to_learn: "To learn",
  learning: "Learning",
  revising: "Revising",
  done: "Done",
};

export interface ChapterSignals {
  /** 0 to 1. */
  progress: number;
  learned: boolean;
  /** Date the Learned activity was ticked, if known. */
  learnedAt: string | null;
  revised: boolean;
  revisionCount: number;
  confidence: number | null;
  lastReviewedAt: string | null;
}

/**
 * Which board column a chapter sits in. The status is derived from what has been ticked, never
 * stored, so it can never disagree with the chapter itself:
 * - Done: every activity is complete (progress rounds to 100%).
 * - Revising: it has been revised at least once but is not finished.
 * - Learning: something has been ticked or counted, but it has not been revised.
 * - To learn: nothing has been done yet.
 */
export function boardStatus(s: ChapterSignals): BoardStatus {
  if (toPercent(s.progress) >= 100) return "done";
  if (s.revised || s.revisionCount > 0) return "revising";
  if (s.progress > 0 || s.learned) return "learning";
  return "to_learn";
}

// ---- spaced revision ---------------------------------------------------------------------------

/** Interval multiplier by confidence: shaky chapters come back sooner, secure ones later. */
const CONFIDENCE_FACTOR: Record<number, number> = { 1: 0.25, 2: 0.5, 3: 1, 4: 1.5, 5: 2.5 };

/** Each completed revision stretches the gap by 1.5x, up to three revisions. */
const REVISION_GROWTH = 1.5;
const MAX_GROWTH_STEPS = 3;

/**
 * Days between revisions: the "revise after" setting, scaled by confidence (unrated counts as 3),
 * and stretched by 1.5x per revision already done (up to three). Never less than one day.
 */
export function revisionInterval(
  baseDays: number,
  confidence: number | null,
  revisionCount: number,
): number {
  const factor = confidence !== null ? (CONFIDENCE_FACTOR[confidence] ?? 1) : 1;
  const growth = REVISION_GROWTH ** Math.min(Math.max(revisionCount, 0), MAX_GROWTH_STEPS);
  return Math.max(1, Math.round(baseDays * factor * growth));
}

export type RevisionState = "overdue" | "today" | "soon" | "later";

export interface RevisionInfo {
  dueDate: string;
  intervalDays: number;
  /** Days from today until it is due; negative once overdue. */
  daysUntil: number;
  state: RevisionState;
}

/** A chapter is "soon" when it falls due within this many days. */
export const REVISION_SOON_DAYS = 7;

/**
 * When a chapter should next be revised. Only chapters that have been learned qualify (there is
 * nothing to revise before that). The clock starts from the last review, else the day it was
 * learned, else today.
 */
export function revisionDue(
  s: ChapterSignals,
  baseDays: number,
  today: string,
): RevisionInfo | null {
  if (!s.learned) return null;
  const from = s.lastReviewedAt ?? s.learnedAt ?? today;
  const intervalDays = revisionInterval(baseDays, s.confidence, s.revisionCount);
  const dueDate = addDays(from, intervalDays);
  const daysUntil = daysBetween(today, dueDate);
  const state: RevisionState =
    daysUntil < 0
      ? "overdue"
      : daysUntil === 0
        ? "today"
        : daysUntil <= REVISION_SOON_DAYS
          ? "soon"
          : "later";
  return { dueDate, intervalDays, daysUntil, state };
}

// ---- needs attention ---------------------------------------------------------------------------

export type AttentionReason =
  | { kind: "overdue"; days: number }
  | { kind: "due_today" }
  | { kind: "low_confidence"; confidence: number }
  | { kind: "untouched" }
  | { kind: "exam_soon"; days: number };

export interface AttentionInput {
  confidence: number | null;
  progress: number;
  revision: RevisionInfo | null;
  /** Whether any chapter in the module has been started. */
  moduleStarted: boolean;
  /** Days until the module's exam; null when there is no upcoming exam. */
  examInDays: number | null;
}

export interface Attention {
  score: number;
  reasons: AttentionReason[];
}

/** Confidence at or below this counts as low. */
export const LOW_CONFIDENCE = 2;

/**
 * Why a chapter needs attention, and how urgently. Reasons: revision overdue (or due today), low
 * confidence, or untouched. An untouched chapter is only flagged once the rest of its module is
 * under way or its exam is within 30 days, so a brand-new module is not one long list of
 * warnings. A near exam raises the score of anything already flagged. Null when nothing applies.
 */
export function attention(input: AttentionInput): Attention | null {
  const reasons: AttentionReason[] = [];
  let score = 0;

  if (input.revision?.state === "overdue") {
    const days = -input.revision.daysUntil;
    reasons.push({ kind: "overdue", days });
    score += 3 + Math.min(days / 7, 3);
  } else if (input.revision?.state === "today") {
    reasons.push({ kind: "due_today" });
    score += 2;
  }

  if (input.confidence !== null && input.confidence <= LOW_CONFIDENCE) {
    reasons.push({ kind: "low_confidence", confidence: input.confidence });
    score += input.confidence === 1 ? 3 : 2;
  }

  const examNear = input.examInDays !== null && input.examInDays <= 30;
  if (toPercent(input.progress) === 0 && (input.moduleStarted || examNear)) {
    reasons.push({ kind: "untouched" });
    score += 1;
  }

  if (reasons.length === 0) return null;

  if (input.examInDays !== null && input.examInDays <= 30) {
    reasons.push({ kind: "exam_soon", days: input.examInDays });
    score += input.examInDays <= 14 ? 2 : 1;
  }
  return { score, reasons };
}

export function describeReason(reason: AttentionReason): string {
  switch (reason.kind) {
    case "overdue":
      return `Revision overdue by ${reason.days} ${reason.days === 1 ? "day" : "days"}`;
    case "due_today":
      return "Revision due today";
    case "low_confidence":
      return `Low confidence (${reason.confidence} of 5)`;
    case "untouched":
      return "Not started";
    case "exam_soon":
      return reason.days === 0
        ? "Exam today"
        : `Exam in ${reason.days} ${reason.days === 1 ? "day" : "days"}`;
  }
}

// ---- deadlines ---------------------------------------------------------------------------------

export interface DeadlineSource {
  id: number;
  name: string;
  dueDate: string | null;
  status: string;
  weight: number;
  moduleId: number;
}

export interface ModuleSource {
  id: number;
  name: string;
  color: string;
  examDate: string | null;
}

export interface DatedItem {
  key: string;
  kind: "assessment" | "exam";
  date: string;
  /** Days from today; negative when the date has passed. */
  days: number;
  title: string;
  moduleId: number;
  moduleName: string;
  moduleColor: string;
  /** Submitted or graded (assessments), or already past (exams). */
  finished: boolean;
  weight: number | null;
}

/** Every dated thing: assessment due dates and module exams, oldest first. */
export function datedItems(
  assessments: DeadlineSource[],
  modules: ModuleSource[],
  today: string,
): DatedItem[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const items: DatedItem[] = [];

  for (const a of assessments) {
    const m = byId.get(a.moduleId);
    if (!a.dueDate || !m) continue;
    items.push({
      key: `assessment-${a.id}`,
      kind: "assessment",
      date: a.dueDate,
      days: daysBetween(today, a.dueDate),
      title: a.name,
      moduleId: m.id,
      moduleName: m.name,
      moduleColor: m.color,
      finished: a.status === "submitted" || a.status === "graded",
      weight: a.weight,
    });
  }
  for (const m of modules) {
    if (!m.examDate) continue;
    const days = daysBetween(today, m.examDate);
    items.push({
      key: `exam-${m.id}`,
      kind: "exam",
      date: m.examDate,
      days,
      title: `${m.name} exam`,
      moduleId: m.id,
      moduleName: m.name,
      moduleColor: m.color,
      finished: days < 0,
      weight: null,
    });
  }
  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === b.kind ? 0 : a.kind === "exam" ? -1 : 1) ||
      a.title.localeCompare(b.title),
  );
}

/**
 * What still needs doing: unfinished assessments (including overdue ones, which come first) and
 * exams that have not happened yet.
 */
export function upcomingItems(items: DatedItem[]): DatedItem[] {
  return items.filter((i) => !i.finished);
}
