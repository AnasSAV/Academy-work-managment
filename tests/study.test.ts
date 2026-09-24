import { describe, expect, it } from "vitest";
import { monthGrid, monthKey, monthLabel, parseMonth, shiftMonth, WEEKDAYS } from "@/lib/calendar";
import { addDays, relativeDays } from "@/lib/dates";
import {
  attention,
  boardStatus,
  datedItems,
  describeReason,
  revisionDue,
  revisionInterval,
  upcomingItems,
  type AttentionInput,
  type ChapterSignals,
} from "@/lib/study";

const signals = (over: Partial<ChapterSignals> = {}): ChapterSignals => ({
  progress: 0,
  learned: false,
  learnedAt: null,
  revised: false,
  revisionCount: 0,
  confidence: null,
  lastReviewedAt: null,
  ...over,
});

describe("dates helpers", () => {
  it("adds days across month and year ends, and back", () => {
    expect(addDays("2026-03-10", 5)).toBe("2026-03-15");
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
    expect(addDays("2026-03-10", 0)).toBe("2026-03-10");
  });

  it("stays on calendar days across a daylight-saving change", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("describes offsets in words", () => {
    expect(relativeDays(0)).toBe("Today");
    expect(relativeDays(1)).toBe("Tomorrow");
    expect(relativeDays(5)).toBe("In 5 days");
    expect(relativeDays(-1)).toBe("Yesterday");
    expect(relativeDays(-4)).toBe("4 days ago");
  });
});

describe("boardStatus", () => {
  it("puts an untouched chapter in To learn", () => {
    expect(boardStatus(signals())).toBe("to_learn");
  });

  it("puts anything started but not revised in Learning", () => {
    expect(boardStatus(signals({ progress: 0.4, learned: true }))).toBe("learning");
    expect(boardStatus(signals({ progress: 0.15 }))).toBe("learning"); // e.g. only notes
    expect(boardStatus(signals({ learned: true }))).toBe("learning");
  });

  it("puts a revised, unfinished chapter in Revising", () => {
    expect(boardStatus(signals({ progress: 0.7, revised: true }))).toBe("revising");
    expect(boardStatus(signals({ progress: 0.7, revisionCount: 2 }))).toBe("revising");
  });

  it("puts a finished chapter in Done, even at 99.6% (it displays as 100%)", () => {
    expect(boardStatus(signals({ progress: 1, revised: true }))).toBe("done");
    expect(boardStatus(signals({ progress: 0.996 }))).toBe("done");
    expect(boardStatus(signals({ progress: 0.99 }))).not.toBe("done");
  });
});

describe("revisionInterval", () => {
  it("scales the base by confidence", () => {
    expect(revisionInterval(14, 3, 0)).toBe(14);
    expect(revisionInterval(14, null, 0)).toBe(14);
    expect(revisionInterval(14, 1, 0)).toBe(4); // 3.5 rounds up
    expect(revisionInterval(14, 2, 0)).toBe(7);
    expect(revisionInterval(14, 4, 0)).toBe(21);
    expect(revisionInterval(14, 5, 0)).toBe(35);
  });

  it("stretches by 1.5x per revision, up to three", () => {
    expect(revisionInterval(14, 3, 1)).toBe(21);
    expect(revisionInterval(14, 3, 2)).toBe(32); // 31.5
    expect(revisionInterval(14, 3, 3)).toBe(47); // 47.25
    expect(revisionInterval(14, 3, 9)).toBe(47); // capped
    expect(revisionInterval(14, 3, -2)).toBe(14);
  });

  it("is never less than a day", () => {
    expect(revisionInterval(1, 1, 0)).toBe(1);
    expect(revisionInterval(1, 2, 0)).toBe(1);
  });

  it("falls back to the base for an out-of-range confidence", () => {
    expect(revisionInterval(14, 9, 0)).toBe(14);
  });
});

describe("revisionDue", () => {
  const learned = (over: Partial<ChapterSignals> = {}) =>
    signals({ learned: true, progress: 0.4, ...over });

  it("does not apply before a chapter is learned", () => {
    expect(revisionDue(signals({ progress: 0.15 }), 14, "2026-03-10")).toBeNull();
    expect(revisionDue(signals(), 14, "2026-03-10")).toBeNull();
  });

  it("counts from the last review, then classifies by how far away it is", () => {
    const s = learned({ lastReviewedAt: "2026-03-01" }); // due 2026-03-15
    expect(revisionDue(s, 14, "2026-03-10")).toMatchObject({
      dueDate: "2026-03-15",
      intervalDays: 14,
      daysUntil: 5,
      state: "soon",
    });
    expect(revisionDue(s, 14, "2026-03-15")).toMatchObject({ daysUntil: 0, state: "today" });
    expect(revisionDue(s, 14, "2026-03-20")).toMatchObject({ daysUntil: -5, state: "overdue" });
    expect(revisionDue(s, 14, "2026-02-20")).toMatchObject({ daysUntil: 23, state: "later" });
    expect(revisionDue(s, 14, "2026-03-08")).toMatchObject({ daysUntil: 7, state: "soon" });
    expect(revisionDue(s, 14, "2026-03-07")).toMatchObject({ daysUntil: 8, state: "later" });
  });

  it("starts from the day it was learned when it has never been reviewed", () => {
    const s = learned({ learnedAt: "2026-03-01" });
    expect(revisionDue(s, 14, "2026-03-10")?.dueDate).toBe("2026-03-15");
  });

  it("prefers the last review over the learned date", () => {
    const s = learned({ learnedAt: "2026-01-01", lastReviewedAt: "2026-03-01" });
    expect(revisionDue(s, 14, "2026-03-10")?.dueDate).toBe("2026-03-15");
  });

  it("starts the clock today when there is no date at all", () => {
    expect(revisionDue(learned(), 14, "2026-03-10")).toMatchObject({
      dueDate: "2026-03-24",
      state: "later",
    });
  });

  it("brings a shaky chapter back sooner and a secure one later", () => {
    const base = { lastReviewedAt: "2026-03-01" };
    expect(revisionDue(learned({ ...base, confidence: 1 }), 14, "2026-03-10")?.dueDate).toBe(
      "2026-03-05",
    );
    expect(revisionDue(learned({ ...base, confidence: 5 }), 14, "2026-03-10")?.dueDate).toBe(
      "2026-04-05",
    );
  });

  it("spaces revisions further apart as they accumulate", () => {
    const base = { lastReviewedAt: "2026-03-01", confidence: 3 };
    expect(
      revisionDue(learned({ ...base, revisionCount: 0 }), 14, "2026-03-10")?.intervalDays,
    ).toBe(14);
    expect(
      revisionDue(learned({ ...base, revisionCount: 2 }), 14, "2026-03-10")?.intervalDays,
    ).toBe(32);
  });
});

describe("attention", () => {
  const overdue = (daysOver: number) => ({
    dueDate: "x",
    intervalDays: 14,
    daysUntil: -daysOver,
    state: "overdue" as const,
  });
  const input = (over: Partial<AttentionInput> = {}): AttentionInput => ({
    confidence: null,
    progress: 0.4,
    revision: null,
    moduleStarted: true,
    examInDays: null,
    ...over,
  });

  it("is null when nothing is wrong", () => {
    expect(attention(input())).toBeNull();
    expect(attention(input({ confidence: 3 }))).toBeNull();
    expect(attention(input({ confidence: 5, examInDays: 3 }))).toBeNull(); // an exam alone is not a reason
  });

  it("scores overdue revision by how late it is, capped", () => {
    expect(attention(input({ revision: overdue(14) }))).toMatchObject({
      score: 5,
      reasons: [{ kind: "overdue", days: 14 }],
    });
    expect(attention(input({ revision: overdue(1) }))?.score).toBeCloseTo(3 + 1 / 7);
    expect(attention(input({ revision: overdue(90) }))?.score).toBe(6);
  });

  it("flags revision due today, but not revision that is still upcoming", () => {
    const today = { dueDate: "x", intervalDays: 14, daysUntil: 0, state: "today" as const };
    expect(attention(input({ revision: today }))).toMatchObject({
      score: 2,
      reasons: [{ kind: "due_today" }],
    });
    const soon = { dueDate: "x", intervalDays: 14, daysUntil: 3, state: "soon" as const };
    expect(attention(input({ revision: soon }))).toBeNull();
  });

  it("flags low confidence, worse for 1 than 2", () => {
    expect(attention(input({ confidence: 1 }))).toMatchObject({
      score: 3,
      reasons: [{ kind: "low_confidence", confidence: 1 }],
    });
    expect(attention(input({ confidence: 2 }))?.score).toBe(2);
    expect(attention(input({ confidence: 3 }))).toBeNull();
  });

  it("flags an untouched chapter only once its module is under way or its exam is near", () => {
    const untouched = { progress: 0 };
    expect(attention(input({ ...untouched, moduleStarted: false }))).toBeNull();
    expect(attention(input({ ...untouched }))).toMatchObject({
      score: 1,
      reasons: [{ kind: "untouched" }],
    });
    expect(
      attention(input({ ...untouched, moduleStarted: false, examInDays: 20 }))?.reasons,
    ).toEqual([{ kind: "untouched" }, { kind: "exam_soon", days: 20 }]);
    expect(attention(input({ ...untouched, moduleStarted: false, examInDays: 45 }))).toBeNull();
    expect(attention(input({ progress: 0.05 }))).toBeNull(); // started, so not untouched
  });

  it("raises the score when the exam is near, more inside two weeks", () => {
    const base = { revision: overdue(14) }; // 5
    expect(attention(input({ ...base, examInDays: 10 }))?.score).toBe(7);
    expect(attention(input({ ...base, examInDays: 14 }))?.score).toBe(7);
    expect(attention(input({ ...base, examInDays: 20 }))?.score).toBe(6);
    expect(attention(input({ ...base, examInDays: 30 }))?.score).toBe(6);
    expect(attention(input({ ...base, examInDays: 31 }))?.score).toBe(5);
    expect(attention(input({ ...base, examInDays: 0 }))?.reasons.at(-1)).toEqual({
      kind: "exam_soon",
      days: 0,
    });
  });

  it("adds reasons together", () => {
    const r = attention(input({ confidence: 1, revision: overdue(7) }));
    expect(r?.score).toBe(3 + 1 + 3); // overdue 7 days = 3 + 1, low confidence 1 = 3
    expect(r?.reasons.map((x) => x.kind)).toEqual(["overdue", "low_confidence"]);
  });

  it("describes every reason in words", () => {
    expect(describeReason({ kind: "overdue", days: 1 })).toBe("Revision overdue by 1 day");
    expect(describeReason({ kind: "overdue", days: 5 })).toBe("Revision overdue by 5 days");
    expect(describeReason({ kind: "due_today" })).toBe("Revision due today");
    expect(describeReason({ kind: "low_confidence", confidence: 2 })).toBe(
      "Low confidence (2 of 5)",
    );
    expect(describeReason({ kind: "untouched" })).toBe("Not started");
    expect(describeReason({ kind: "exam_soon", days: 1 })).toBe("Exam in 1 day");
    expect(describeReason({ kind: "exam_soon", days: 12 })).toBe("Exam in 12 days");
    expect(describeReason({ kind: "exam_soon", days: 0 })).toBe("Exam today");
  });
});

describe("datedItems and upcomingItems", () => {
  const today = "2026-03-10";
  const modules = [
    { id: 1, name: "Networks", color: "#2a78d6", examDate: "2026-03-10" },
    { id: 2, name: "ML", color: "#eb6834", examDate: "2026-02-01" },
    { id: 3, name: "NLP", color: "#1baf7a", examDate: null },
  ];
  const a = (id: number, moduleId: number, dueDate: string | null, status = "not_started") => ({
    id,
    name: `A${id}`,
    dueDate,
    status,
    weight: 10,
    moduleId,
  });

  it("includes dated assessments and exams, oldest first, exam before assessment on a shared day", () => {
    const items = datedItems(
      [a(1, 3, "2026-03-20"), a(2, 1, "2026-03-10"), a(3, 3, null), a(4, 3, "2026-03-01")],
      modules,
      today,
    );
    expect(items.map((i) => i.key)).toEqual([
      "exam-2", // 2026-02-01
      "assessment-4", // 2026-03-01
      "exam-1", // 2026-03-10, before the assessment on the same day
      "assessment-2",
      "assessment-1",
    ]);
    expect(items.find((i) => i.key === "assessment-3")).toBeUndefined();
  });

  it("computes signed day offsets and module details", () => {
    const items = datedItems([a(1, 1, "2026-03-13"), a(2, 1, "2026-03-05")], modules, today);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey["assessment-1"]).toMatchObject({
      days: 3,
      moduleName: "Networks",
      moduleColor: "#2a78d6",
      weight: 10,
    });
    expect(byKey["assessment-2"].days).toBe(-5);
    expect(byKey["exam-1"]).toMatchObject({
      days: 0,
      kind: "exam",
      title: "Networks exam",
      weight: null,
    });
  });

  it("marks submitted and graded work, and past exams, as finished", () => {
    const items = datedItems(
      [
        a(1, 3, "2026-03-20", "submitted"),
        a(2, 3, "2026-03-21", "graded"),
        a(3, 3, "2026-03-22", "in_progress"),
      ],
      modules,
      today,
    );
    const finished = Object.fromEntries(items.map((i) => [i.key, i.finished]));
    expect(finished).toMatchObject({
      "assessment-1": true,
      "assessment-2": true,
      "assessment-3": false,
      "exam-1": false, // today: not over yet
      "exam-2": true, // last month
    });
  });

  it("keeps overdue unfinished work in upcoming, and drops finished items and past exams", () => {
    const items = datedItems(
      [a(1, 3, "2026-03-01"), a(2, 3, "2026-03-20", "submitted"), a(3, 3, "2026-03-30")],
      modules,
      today,
    );
    const upcoming = upcomingItems(items);
    expect(upcoming.map((i) => i.key)).toEqual(["assessment-1", "exam-1", "assessment-3"]);
    expect(upcoming[0].days).toBeLessThan(0);
  });

  it("ignores assessments whose module is unknown", () => {
    expect(
      datedItems([a(1, 99, "2026-03-20")], modules, today).some((i) => i.key === "assessment-1"),
    ).toBe(false);
  });
});

describe("calendar", () => {
  it("reads a month, falling back to the current one", () => {
    expect(parseMonth("2026-03", "2026-09-24")).toEqual({ year: 2026, month: 3 });
    expect(parseMonth(undefined, "2026-09-24")).toEqual({ year: 2026, month: 9 });
    for (const bad of ["", "2026-13", "2026-00", "26-03", "March", "2026-3", "2026-03-01"]) {
      expect(parseMonth(bad, "2026-09-24")).toEqual({ year: 2026, month: 9 });
    }
  });

  it("formats and shifts months across year ends", () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
    expect(shiftMonth({ year: 2026, month: 5 }, 14)).toEqual({ year: 2027, month: 7 });
    expect(shiftMonth({ year: 2026, month: 5 }, -17)).toEqual({ year: 2024, month: 12 });
    expect(monthLabel({ year: 2026, month: 3 })).toBe("March 2026");
  });

  it("lays out Monday-first weeks padded with neighbouring days", () => {
    // February 2026 starts on a Sunday, so its first week begins on Monday 26 January.
    const feb = monthGrid({ year: 2026, month: 2 });
    expect(feb[0][0]).toEqual({ date: "2026-01-26", inMonth: false });
    expect(feb[0][6]).toEqual({ date: "2026-02-01", inMonth: true });
    expect(feb).toHaveLength(5);
    expect(feb.at(-1)!.at(-1)).toEqual({ date: "2026-03-01", inMonth: false });
    expect(feb.every((w) => w.length === 7)).toBe(true);
  });

  it("covers every day of the month exactly once, including a leap February", () => {
    const grid = monthGrid({ year: 2028, month: 2 }).flat();
    const inMonth = grid.filter((d) => d.inMonth).map((d) => d.date);
    expect(inMonth).toHaveLength(29);
    expect(new Set(inMonth).size).toBe(29);
    expect(inMonth[0]).toBe("2028-02-01");
    expect(inMonth.at(-1)).toBe("2028-02-29");
  });

  it("uses six weeks when the month needs them", () => {
    // March 2026 starts on Sunday and has 31 days: 6 rows.
    expect(monthGrid({ year: 2026, month: 3 })).toHaveLength(6);
    // February 2027 starts on Monday and has 28 days: exactly 4 rows.
    expect(monthGrid({ year: 2027, month: 2 })).toHaveLength(4);
  });

  it("keeps dates consecutive across a daylight-saving change", () => {
    const days = monthGrid({ year: 2026, month: 3 })
      .flat()
      .map((d) => d.date);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBe(addDays(days[i - 1], 1));
  });

  it("names the weekdays Monday first", () => {
    expect(WEEKDAYS[0]).toBe("Mon");
    expect(WEEKDAYS[6]).toBe("Sun");
  });
});
