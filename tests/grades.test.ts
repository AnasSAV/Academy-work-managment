import { describe, expect, it } from "vitest";
import { ADVANCED_ML_ASSESSMENTS } from "@/lib/fixtures/advanced-ml";
import {
  formatPercent,
  itemPercent,
  projectGrade,
  summarizeGrades,
  targetStatus,
  type GradeItem,
} from "@/lib/grades";

/** The Advanced ML table from the brief, with scores filled in for the first three components. */
function advancedMl(scores: Record<string, [number, number]> = {}): GradeItem[] {
  return ADVANCED_ML_ASSESSMENTS.map((a, i) => {
    const s = scores[a.name];
    return {
      id: i + 1,
      name: a.name,
      weight: a.weight,
      score: s?.[0] ?? null,
      maxScore: s?.[1] ?? 100,
    };
  });
}

// 90% of 3, 80% of 7, 70% of 7: 2.7 + 5.6 + 4.9 = 13.2 points from 17 weight.
const partlyGraded = () =>
  advancedMl({
    "Interactive books": [27, 30],
    "In-class quizzes": [8, 10],
    Assignments: [7, 10],
  });

const item = (id: number, weight: number, score: number | null, maxScore = 100): GradeItem => ({
  id,
  name: `C${id}`,
  weight,
  score,
  maxScore,
});

describe("itemPercent", () => {
  it("is score over maximum as a percentage", () => {
    expect(itemPercent({ score: 17, maxScore: 20 })).toBe(85);
    expect(itemPercent({ score: 0, maxScore: 20 })).toBe(0);
    expect(itemPercent({ score: 2.5, maxScore: 3 })).toBeCloseTo(83.33, 2);
  });

  it("is null without a usable score and never negative", () => {
    expect(itemPercent({ score: null, maxScore: 20 })).toBeNull();
    expect(itemPercent({ score: 5, maxScore: 0 })).toBeNull();
    expect(itemPercent({ score: -3, maxScore: 10 })).toBe(0);
  });
});

describe("summarizeGrades: Advanced ML fixture", () => {
  it("with nothing graded, everything is outstanding", () => {
    const s = summarizeGrades(advancedMl());
    expect(s).toMatchObject({
      total: 100,
      basis: 100,
      unallocated: 0,
      gradedWeight: 0,
      gradedCount: 0,
      outstanding: 100,
      outstandingCount: 8,
      earned: 0,
      average: null,
      gradePercent: 0,
      bestCase: 100,
      atCurrentAverage: null,
    });
  });

  it("with three components graded", () => {
    const s = summarizeGrades(partlyGraded());
    expect(s.gradedWeight).toBe(17);
    expect(s.gradedCount).toBe(3);
    expect(s.outstanding).toBe(83);
    expect(s.outstandingCount).toBe(5);
    expect(s.earned).toBeCloseTo(13.2);
    expect(s.lost).toBeCloseTo(3.8);
    expect(s.average).toBeCloseTo(77.647, 3);
    expect(s.gradePercent).toBeCloseTo(13.2);
    expect(s.bestCase).toBeCloseTo(96.2);
    // Same average on the rest: (13.2 + 83 * 0.77647) / 100
    expect(s.atCurrentAverage).toBeCloseTo(77.647, 3);
  });

  it("with everything graded, nothing is outstanding and best case equals the grade", () => {
    const items = advancedMl().map((i) => ({ ...i, score: 50, maxScore: 100 }));
    const s = summarizeGrades(items);
    expect(s.outstanding).toBe(0);
    expect(s.gradePercent).toBeCloseTo(50);
    expect(s.bestCase).toBeCloseTo(50);
    expect(s.average).toBeCloseTo(50);
  });
});

describe("summarizeGrades: weights that do not total 100", () => {
  it("leaves unallocated weight out of what can still be earned", () => {
    const s = summarizeGrades([item(1, 40, 50), item(2, 20, null)]);
    expect(s).toMatchObject({ total: 60, basis: 100, unallocated: 40, outstanding: 20 });
    expect(s.earned).toBeCloseTo(20);
    expect(s.bestCase).toBeCloseTo(40); // 20 earned + 20 available
  });

  it("measures against the total when weights exceed 100", () => {
    const s = summarizeGrades([item(1, 80, 100), item(2, 40, null)]);
    expect(s).toMatchObject({ total: 120, basis: 120, unallocated: 0 });
    expect(s.gradePercent).toBeCloseTo((80 / 120) * 100);
    expect(s.bestCase).toBeCloseTo(100); // it can never exceed 100%
  });

  it("tolerates floating-point weights", () => {
    const s = summarizeGrades([item(1, 33.3, null), item(2, 33.3, null), item(3, 33.4, null)]);
    expect(s.total).toBe(100);
    expect(s.unallocated).toBe(0);
  });

  it("handles no assessments at all", () => {
    const s = summarizeGrades([]);
    expect(s).toMatchObject({
      total: 0,
      basis: 100,
      unallocated: 100,
      outstanding: 0,
      average: null,
    });
    expect(s.bestCase).toBe(0);
  });

  it("counts zero-weight components as graded without changing the grade", () => {
    const s = summarizeGrades([item(1, 0, 90), item(2, 50, 80), item(3, 50, null)]);
    expect(s.gradedCount).toBe(2);
    expect(s.earned).toBeCloseTo(40);
    expect(s.average).toBeCloseTo(80);
  });

  it("does not treat a missing score as zero", () => {
    const s = summarizeGrades([item(1, 50, null), item(2, 50, null)]);
    expect(s.gradedCount).toBe(0);
    expect(s.earned).toBe(0);
    expect(s.outstanding).toBe(100);
  });
});

describe("targetStatus", () => {
  const partly = summarizeGrades(partlyGraded());

  it("has no target", () => {
    expect(targetStatus(partly, null)).toEqual({ kind: "none" });
    expect(targetStatus(partly, Number.NaN)).toEqual({ kind: "none" });
  });

  it("works out the average needed on what is left", () => {
    // (75 - 13.2) / 83 = 74.46%
    const r = targetStatus(partly, 75);
    expect(r.kind).toBe("needed");
    expect(r.kind === "needed" && r.average).toBeCloseTo(74.458, 3);
  });

  it("the needed average really does reach the target", () => {
    const r = targetStatus(partly, 75);
    if (r.kind !== "needed") throw new Error("expected needed");
    const all = Object.fromEntries(partlyGraded().map((i) => [i.id, r.average]));
    expect(projectGrade(partlyGraded(), all, null).grade).toBeCloseTo(75, 6);
  });

  it("needs 100% everywhere when the target equals the best case", () => {
    const r = targetStatus(partly, 96.2);
    expect(r.kind === "needed" && r.average).toBeCloseTo(100, 6);
  });

  it("is unreachable just past the best case", () => {
    const r = targetStatus(partly, 96.3);
    expect(r.kind).toBe("unreachable");
    expect(r.kind === "unreachable" && r.bestCase).toBeCloseTo(96.2);
  });

  it("is secured once earned points meet the target", () => {
    const r = targetStatus(partly, 10);
    expect(r.kind).toBe("secured");
    expect(r.kind === "secured" && r.margin).toBeCloseTo(3.2);
    expect(targetStatus(partly, 13.2).kind).toBe("secured"); // exactly met
    expect(targetStatus(partly, 0).kind).toBe("secured");
  });

  it("with nothing graded it needs the target itself as the average", () => {
    const r = targetStatus(summarizeGrades(advancedMl()), 70);
    expect(r.kind === "needed" && r.average).toBeCloseTo(70);
  });

  it("is finished when nothing is left and the target was missed", () => {
    const done = summarizeGrades(advancedMl().map((i) => ({ ...i, score: 60, maxScore: 100 })));
    const r = targetStatus(done, 70);
    expect(r).toMatchObject({ kind: "finished" });
    expect(r.kind === "finished" && r.final).toBeCloseTo(60);
    expect(r.kind === "finished" && r.short).toBeCloseTo(10);
    expect(targetStatus(done, 60).kind).toBe("secured");
  });

  it("cannot count on weight that was never allocated", () => {
    // 60% allocated, 40% not: best case is 60%, so 70% is out of reach.
    const s = summarizeGrades([item(1, 60, null)]);
    expect(targetStatus(s, 70).kind).toBe("unreachable");
    expect(targetStatus(s, 60).kind).toBe("needed");
  });

  it("uses the total as the basis when weights exceed 100", () => {
    const s = summarizeGrades([item(1, 60, null), item(2, 60, null)]);
    const r = targetStatus(s, 50); // 50% of 120 points = 60 points, from 120 available
    expect(r.kind === "needed" && r.average).toBeCloseTo(50);
  });
});

describe("projectGrade", () => {
  it("keeps graded scores and applies one assumed score to the rest", () => {
    const p = projectGrade(partlyGraded(), {}, 80);
    // 13.2 + 83 * 0.8
    expect(p.grade).toBeCloseTo(79.6);
    expect(p).toMatchObject({ assumed: 5, unfilled: 0 });
  });

  it("lets a component override the fallback", () => {
    const items = partlyGraded();
    const finalA = items.find((i) => i.name === "Final Exam (Part A)")!;
    const p = projectGrade(items, { [finalA.id]: 100 }, 80);
    // 13.2 + 66 * 0.8 + 17 * 1.0
    expect(p.grade).toBeCloseTo(83);
  });

  it("counts a component with no assumption as zero and says so", () => {
    const p = projectGrade(partlyGraded(), {}, null);
    expect(p.grade).toBeCloseTo(13.2);
    expect(p).toMatchObject({ assumed: 0, unfilled: 5 });
    const some = projectGrade(partlyGraded(), { 4: 50 }, null); // 17 weight at 50%
    expect(some.grade).toBeCloseTo(13.2 + 8.5);
    expect(some).toMatchObject({ assumed: 1, unfilled: 4 });
  });

  it("does not let an assumption override a graded score", () => {
    const items = partlyGraded();
    const p = projectGrade(items, { 1: 0, 2: 0, 3: 0 }, 0);
    expect(p.grade).toBeCloseTo(13.2);
  });

  it("clamps assumptions to 0-100 and ignores non-numbers", () => {
    const items = [item(1, 50, null), item(2, 50, null)];
    expect(projectGrade(items, { 1: 250, 2: -40 }, null).grade).toBeCloseTo(50);
    const bad = projectGrade(items, { 1: Number.NaN }, 100);
    expect(bad.grade).toBeCloseTo(50); // NaN skipped; item 2 uses the fallback
    expect(bad.unfilled).toBe(1);
  });

  it("gives 100% at most, even when weights exceed 100", () => {
    const items = [item(1, 80, null), item(2, 80, null)];
    expect(projectGrade(items, {}, 100).grade).toBeCloseTo(100);
  });

  it("with everything graded, ignores assumptions entirely", () => {
    const items = advancedMl().map((i) => ({ ...i, score: 70, maxScore: 100 }));
    expect(projectGrade(items, {}, 0).grade).toBeCloseTo(70);
  });
});

describe("formatPercent", () => {
  it("rounds to one decimal without a trailing zero", () => {
    expect(formatPercent(74.4578)).toBe("74.5%");
    expect(formatPercent(75)).toBe("75%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(79.96)).toBe("80%");
  });
});
