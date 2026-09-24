import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import { createAssessment } from "@/db/assessments";
import { loadModuleInsights, loadSemesterDashboard } from "@/db/dashboard-queries";
import { createPastPaper } from "@/db/past-papers";
import { setActivityCounts, setActivityDone, listActivityTypes } from "@/db/activities";
import { semesters } from "@/db/schema";
import { addChapters, createModule, createSemester } from "@/db/services";
import {
  HEAT_LABELS,
  activityBreakdown,
  heatLevel,
  paperTrend,
  pickCurrentSemester,
  weightByStatus,
} from "@/lib/dashboard";
import { parseInput } from "@/lib/validation/parse";
import { assessmentSchema, moduleSchema, pastPaperSchema } from "@/lib/validation/schemas";

const settings = { readinessChapterWeight: 0.7 };

function parsed<T>(r: { ok: true; data: T } | { ok: false; error: string }) {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

describe("heatLevel", () => {
  it("buckets into untouched, three stages and complete", () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(0.01)).toBe(1);
    expect(heatLevel(0.33)).toBe(1);
    expect(heatLevel(0.34)).toBe(2);
    expect(heatLevel(0.66)).toBe(2);
    expect(heatLevel(0.67)).toBe(3);
    expect(heatLevel(0.99)).toBe(3);
    expect(heatLevel(1)).toBe(4);
  });

  it("follows the rounded percentage shown to the reader", () => {
    expect(heatLevel(0.996)).toBe(4); // shows as 100%
    expect(heatLevel(0.004)).toBe(0); // shows as 0%
    expect(heatLevel(0.335)).toBe(2); // shows as 34%
    expect(heatLevel(-1)).toBe(0);
    expect(heatLevel(3)).toBe(4);
  });

  it("has a label for every level", () => {
    expect(Object.keys(HEAT_LABELS)).toHaveLength(5);
  });
});

describe("pickCurrentSemester", () => {
  const s = (id: number, position: number, startDate: string | null, endDate: string | null) => ({
    id,
    position,
    startDate,
    endDate,
  });

  it("is null when there are no semesters", () => {
    expect(pickCurrentSemester([], "2026-03-01")).toBeNull();
  });

  it("prefers the semester that is running today", () => {
    const list = [
      s(1, 0, "2025-09-01", "2026-01-31"),
      s(2, 1, "2026-02-01", "2026-06-30"),
      s(3, 2, "2026-09-01", null),
    ];
    expect(pickCurrentSemester(list, "2026-03-10")?.id).toBe(2);
    expect(pickCurrentSemester(list, "2026-02-01")?.id).toBe(2); // inclusive start
    expect(pickCurrentSemester(list, "2026-06-30")?.id).toBe(2); // inclusive end
  });

  it("falls back to the latest semester that has started", () => {
    const list = [s(1, 0, "2025-09-01", "2026-01-31"), s(2, 1, "2026-02-01", "2026-06-30")];
    expect(pickCurrentSemester(list, "2026-08-01")?.id).toBe(2);
    expect(pickCurrentSemester([...list].reverse(), "2026-08-01")?.id).toBe(2);
  });

  it("falls back to the first when nothing has started or there are no dates", () => {
    expect(
      pickCurrentSemester([s(1, 0, "2027-01-01", null), s(2, 1, "2028-01-01", null)], "2026-03-01")
        ?.id,
    ).toBe(1);
    expect(pickCurrentSemester([s(9, 1, null, null), s(4, 0, null, null)], "2026-03-01")?.id).toBe(
      4,
    );
  });

  it("handles open-ended semesters", () => {
    expect(pickCurrentSemester([s(1, 0, "2026-01-01", null)], "2026-12-31")?.id).toBe(1);
    expect(
      pickCurrentSemester([s(1, 0, null, "2026-06-30"), s(2, 1, null, null)], "2026-03-01")?.id,
    ).toBe(1);
  });
});

describe("activityBreakdown", () => {
  const types = [
    { id: 1, label: "Learned", weight: 40, tracksCounts: false },
    { id: 2, label: "Questions done", weight: 30, tracksCounts: true },
  ];
  const state = (
    activityTypeId: number,
    done: boolean,
    countDone: number | null = null,
    countTotal: number | null = null,
  ) => ({
    activityTypeId,
    done,
    countDone,
    countTotal,
  });

  it("averages completion per activity, including partial question counts", () => {
    const chapters = [
      {
        states: new Map([
          [1, state(1, true)],
          [2, state(2, false, 10, 40)],
        ]),
      },
      { states: new Map([[1, state(1, true)]]) },
      { states: new Map() },
      { states: new Map([[2, state(2, true)]]) },
    ];
    const [learned, questions] = activityBreakdown(types, chapters);
    expect(learned).toMatchObject({ label: "Learned", doneChapters: 2, totalChapters: 4 });
    expect(learned.value).toBeCloseTo(0.5);
    // (0.25 + 0 + 0 + 1) / 4
    expect(questions.value).toBeCloseTo(0.3125);
    expect(questions.doneChapters).toBe(1);
  });

  it("is all zero with no chapters", () => {
    expect(activityBreakdown(types, [])).toEqual([
      { typeId: 1, label: "Learned", value: 0, doneChapters: 0, totalChapters: 0 },
      { typeId: 2, label: "Questions done", value: 0, doneChapters: 0, totalChapters: 0 },
    ]);
  });
});

describe("paperTrend", () => {
  const p = (id: number, over: Record<string, unknown> = {}) => ({
    id,
    title: `P${id}`,
    year: null,
    attempted: true,
    score: 50,
    maxScore: 100,
    attemptedAt: null,
    ...over,
  });

  it("keeps only scored attempts, as percentages of their own maximum", () => {
    const trend = paperTrend([
      p(1, { score: 45, maxScore: 50 }),
      p(2, { attempted: false }),
      p(3, { score: null }),
      p(4, { maxScore: null }),
      p(5, { maxScore: 0 }),
    ]);
    expect(trend.map((t) => [t.id, t.percent])).toEqual([[1, 90]]);
  });

  it("orders by date attempted, then year, then id, with undated last", () => {
    const trend = paperTrend([
      p(1, { attemptedAt: "2026-03-05", year: 2021 }),
      p(2),
      p(3, { attemptedAt: "2026-01-10" }),
      p(4, { year: 2020 }),
      p(5, { year: 2020 }),
      p(6, { attemptedAt: "2026-03-05", year: 2019 }),
    ]);
    expect(trend.map((t) => t.id)).toEqual([3, 6, 1, 2, 4, 5]);
  });

  it("rounds to one decimal", () => {
    expect(paperTrend([p(1, { score: 1, maxScore: 3 })])[0].percent).toBe(33.3);
  });
});

describe("weightByStatus", () => {
  const item = (
    weight: number,
    status: "graded" | "submitted" | "in_progress" | "not_started",
  ) => ({ weight, status });

  it("splits weight by status and reports the graded share", () => {
    const r = weightByStatus([
      item(10, "graded"),
      item(20, "submitted"),
      item(30, "in_progress"),
      item(40, "not_started"),
    ]);
    expect(r.total).toBe(100);
    expect(r.whole).toBe(100);
    expect(r.gradedShare).toBeCloseTo(0.1);
    expect(r.segments.map((s) => [s.key, s.weight])).toEqual([
      ["graded", 10],
      ["submitted", 20],
      ["in_progress", 30],
      ["not_started", 40],
    ]);
  });

  it("adds an unallocated segment when the weights fall short of 100", () => {
    const r = weightByStatus([item(60, "graded")]);
    expect(r.segments.at(-1)).toEqual({ key: "unallocated", weight: 40 });
    expect(r.gradedShare).toBeCloseTo(0.6);
  });

  it("measures against the total when weights exceed 100", () => {
    const r = weightByStatus([item(60, "graded"), item(60, "not_started")]);
    expect(r.whole).toBe(120);
    expect(r.segments.some((s) => s.key === "unallocated")).toBe(false);
    expect(r.gradedShare).toBeCloseTo(0.5);
  });

  it("is entirely unallocated with no assessments", () => {
    const r = weightByStatus([]);
    expect(r.segments.filter((s) => s.weight > 0)).toEqual([{ key: "unallocated", weight: 100 }]);
    expect(r.gradedShare).toBe(0);
  });

  it("tolerates floating-point weights", () => {
    const r = weightByStatus([
      item(33.3, "graded"),
      item(33.3, "graded"),
      item(33.4, "not_started"),
    ]);
    expect(r.total).toBe(100);
    expect(r.segments.some((s) => s.key === "unallocated")).toBe(false);
  });
});

// ---- against the database ----------------------------------------------------------------------

describe("dashboard queries", () => {
  let db: Db;
  let semesterId: number;
  let a: number;
  let b: number;

  const moduleInput = (name: string) =>
    parsed(parseInput(moduleSchema, { name, color: "#2a78d6" }));

  beforeEach(() => {
    db = createDatabase(":memory:");
    semesterId = createSemester(db, { name: "S", startDate: null, endDate: null }).id;
    a = createModule(db, semesterId, moduleInput("A")).id;
    b = createModule(db, semesterId, moduleInput("B")).id;
    createModule(db, semesterId, moduleInput("Empty"));
  });

  const semester = () => db.select().from(semesters).get()!;

  it("summarises the semester and agrees with per-module progress", () => {
    const chaptersA = addChapters(db, a, ["A1", "A2"]);
    addChapters(db, b, ["B1"]);
    const typesA = listActivityTypes(db, a);
    for (const t of typesA) setActivityDone(db, chaptersA[0].id, t.id, true, "2026-03-01"); // A1 = 100%
    createPastPaper(db, a, parsed(parseInput(pastPaperSchema, { title: "P", score: "70" })));
    createPastPaper(db, b, parsed(parseInput(pastPaperSchema, { title: "Q" })));
    createAssessment(
      db,
      a,
      parsed(parseInput(assessmentSchema, { name: "X", weight: "10", score: "8", maxScore: "10" })),
    );
    createAssessment(db, b, parsed(parseInput(assessmentSchema, { name: "Y", weight: "10" })));

    const d = loadSemesterDashboard(db, semester(), settings);
    expect(d.modules.map((m) => m.module.name)).toEqual(["A", "B", "Empty"]);

    const [ma, mb, me] = d.modules;
    expect(ma.chaptersComplete).toBe(1);
    expect(ma.progress.chapterProgress).toBeCloseTo(0.5);
    // chapters 0.5 x 0.7, past papers (1 attempted of 1, 70%) x 0.3
    expect(ma.progress.readiness).toBeCloseTo(0.7 * 0.5 + 0.3 * 0.7);
    expect(mb.progress.readiness).toBe(0);
    expect(me.progress.chapters).toEqual([]);
    expect(ma.papers).toEqual({ attempted: 1, total: 1 });
    expect(mb.papers).toEqual({ attempted: 0, total: 1 });
    expect(ma.assessments).toEqual({ graded: 1, total: 1 });

    expect(d.completion).toBeCloseTo((ma.progress.readiness + 0 + 0) / 3);
    expect(d.totals).toEqual({
      chapters: 3,
      chaptersComplete: 1,
      papersAttempted: 1,
      papersTotal: 2,
      assessmentsGraded: 1,
      assessmentsTotal: 2,
    });
  });

  it("does not count a chapter as complete until it rounds to 100%", () => {
    const [c] = addChapters(db, a, ["A1"]);
    const types = listActivityTypes(db, a);
    setActivityDone(db, c.id, types[0].id, true, "2026-03-01");
    expect(loadSemesterDashboard(db, semester(), settings).totals.chaptersComplete).toBe(0);
  });

  it("handles a semester with no modules", () => {
    const other = createSemester(db, { name: "Empty semester", startDate: null, endDate: null });
    const d = loadSemesterDashboard(db, other, settings);
    expect(d.modules).toEqual([]);
    expect(d.completion).toBe(0);
    expect(d.totals.chapters).toBe(0);
  });

  it("builds module insights from the same data", () => {
    const [c1, c2] = addChapters(db, a, ["A1", "A2"]);
    const types = listActivityTypes(db, a);
    const learned = types.find((t) => t.key === "learned")!;
    const questions = types.find((t) => t.key === "questions")!;
    setActivityDone(db, c1.id, learned.id, true, "2026-03-01");
    setActivityCounts(db, c2.id, questions.id, { countDone: 10, countTotal: 20 }, "2026-03-01");
    createPastPaper(
      db,
      a,
      parsed(
        parseInput(pastPaperSchema, { title: "Early", score: "40", attemptedAt: "2026-01-10" }),
      ),
    );
    createPastPaper(
      db,
      a,
      parsed(
        parseInput(pastPaperSchema, { title: "Later", score: "70", attemptedAt: "2026-02-20" }),
      ),
    );
    createPastPaper(db, a, parsed(parseInput(pastPaperSchema, { title: "Unattempted" })));
    createAssessment(
      db,
      a,
      parsed(
        parseInput(assessmentSchema, { name: "Quiz", weight: "30", score: "9", maxScore: "10" }),
      ),
    );
    createAssessment(db, a, parsed(parseInput(assessmentSchema, { name: "Exam", weight: "50" })));

    const i = loadModuleInsights(db, a, settings);
    const byLabel = Object.fromEntries(i.activityBars.map((x) => [x.label, x]));
    expect(byLabel["Learned"]).toMatchObject({ doneChapters: 1, totalChapters: 2 });
    expect(byLabel["Learned"].value).toBeCloseTo(0.5);
    expect(byLabel["Questions done"].value).toBeCloseTo(0.25);
    expect(i.trend.map((t) => [t.title, t.percent])).toEqual([
      ["Early", 40],
      ["Later", 70],
    ]);
    expect(i.paperCount).toBe(3);
    expect(i.assessmentCount).toBe(2);
    expect(i.weights.whole).toBe(100);
    expect(i.weights.segments.find((s) => s.key === "graded")?.weight).toBe(30);
    expect(i.weights.segments.find((s) => s.key === "unallocated")?.weight).toBe(20);
    expect(i.progress.readiness).toBeGreaterThan(0);
  });
});
