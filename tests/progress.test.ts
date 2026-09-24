import { describe, expect, it } from "vitest";
import {
  activityCompletion,
  chapterProgress,
  meanProgress,
  moduleReadiness,
  pastPaperProgress,
  toPercent,
  type ActivityDef,
  type ActivityState,
} from "@/lib/progress";

// The default set: learned 40, questions 30 (tracks counts), notes 15, revised 15.
const LEARNED = 1;
const QUESTIONS = 2;
const NOTES = 3;
const REVISED = 4;
const defaults: ActivityDef[] = [
  { id: LEARNED, weight: 40, tracksCounts: false },
  { id: QUESTIONS, weight: 30, tracksCounts: true },
  { id: NOTES, weight: 15, tracksCounts: false },
  { id: REVISED, weight: 15, tracksCounts: false },
];

const done = (id: number): ActivityState => ({
  activityTypeId: id,
  done: true,
  countDone: null,
  countTotal: null,
});
const counts = (
  id: number,
  countDone: number | null,
  countTotal: number | null,
): ActivityState => ({
  activityTypeId: id,
  done: false,
  countDone,
  countTotal,
});

describe("activityCompletion", () => {
  const questions = defaults[1];

  it("is 0 with no state and 1 when ticked", () => {
    expect(activityCompletion(questions, undefined)).toBe(0);
    expect(activityCompletion(questions, done(QUESTIONS))).toBe(1);
  });

  it("uses done / total for count-tracking activities that are not ticked", () => {
    expect(activityCompletion(questions, counts(QUESTIONS, 12, 40))).toBeCloseTo(0.3);
  });

  it("caps at 1 and ignores nonsense counts", () => {
    expect(activityCompletion(questions, counts(QUESTIONS, 50, 40))).toBe(1);
    expect(activityCompletion(questions, counts(QUESTIONS, null, 40))).toBe(0);
    expect(activityCompletion(questions, counts(QUESTIONS, 5, 0))).toBe(0);
    expect(activityCompletion(questions, counts(QUESTIONS, 5, null))).toBe(0);
  });

  it("ignores counts on activities that do not track them", () => {
    expect(activityCompletion(defaults[0], counts(LEARNED, 5, 10))).toBe(0);
  });

  it("lets a tick win over partial counts", () => {
    expect(activityCompletion(questions, { ...counts(QUESTIONS, 1, 10), done: true })).toBe(1);
  });
});

describe("chapterProgress", () => {
  it("is 0 for an untouched chapter", () => {
    expect(chapterProgress(defaults, [])).toBe(0);
  });

  it("is 1 when everything is done", () => {
    expect(
      chapterProgress(
        defaults,
        defaults.map((d) => done(d.id)),
      ),
    ).toBe(1);
  });

  it("applies the default 40/30/15/15 weights", () => {
    expect(chapterProgress(defaults, [done(LEARNED)])).toBeCloseTo(0.4);
    expect(chapterProgress(defaults, [done(LEARNED), done(NOTES)])).toBeCloseTo(0.55);
    expect(chapterProgress(defaults, [done(LEARNED), done(NOTES), done(REVISED)])).toBeCloseTo(0.7);
  });

  it("gives partial credit for question counts", () => {
    // learned 0.40 + questions 20/40 * 0.30 = 0.15
    expect(chapterProgress(defaults, [done(LEARNED), counts(QUESTIONS, 20, 40)])).toBeCloseTo(0.55);
  });

  it("re-normalises weights that do not sum to 100", () => {
    const halves: ActivityDef[] = [
      { id: 1, weight: 1, tracksCounts: false },
      { id: 2, weight: 1, tracksCounts: false },
    ];
    expect(chapterProgress(halves, [done(1)])).toBeCloseTo(0.5);
  });

  it("includes custom activities in the average", () => {
    const withCustom: ActivityDef[] = [...defaults, { id: 9, weight: 100, tracksCounts: false }];
    // total weight 200: custom done = 100/200
    expect(chapterProgress(withCustom, [done(9)])).toBeCloseTo(0.5);
  });

  it("ignores states for activity types that no longer exist", () => {
    expect(chapterProgress(defaults, [done(999)])).toBe(0);
  });

  it("is 0 when there are no activity types or all weights are 0", () => {
    expect(chapterProgress([], [done(1)])).toBe(0);
    expect(chapterProgress([{ id: 1, weight: 0, tracksCounts: false }], [done(1)])).toBe(0);
  });

  it("treats negative weights as 0", () => {
    const defs: ActivityDef[] = [
      { id: 1, weight: -50, tracksCounts: false },
      { id: 2, weight: 10, tracksCounts: false },
    ];
    expect(chapterProgress(defs, [done(2)])).toBe(1);
  });
});

describe("meanProgress and toPercent", () => {
  it("averages and handles empty input", () => {
    expect(meanProgress([])).toBe(0);
    expect(meanProgress([0, 0.5, 1])).toBeCloseTo(0.5);
  });

  it("rounds and clamps", () => {
    expect(toPercent(0.456)).toBe(46);
    expect(toPercent(1.4)).toBe(100);
    expect(toPercent(-1)).toBe(0);
  });
});

describe("pastPaperProgress", () => {
  it("is null when no papers are logged", () => {
    expect(pastPaperProgress([])).toBeNull();
  });

  it("is 0 when papers are logged but none attempted", () => {
    expect(pastPaperProgress([{ attempted: false, score: null, maxScore: null }])).toBe(0);
  });

  it("multiplies coverage by mean score of scored attempts", () => {
    const papers = [
      { attempted: true, score: 80, maxScore: 100 },
      { attempted: true, score: 60, maxScore: 100 },
      { attempted: false, score: null, maxScore: null },
      { attempted: false, score: null, maxScore: null },
    ];
    // coverage 2/4 = 0.5, mean score 0.7
    expect(pastPaperProgress(papers)).toBeCloseTo(0.35);
  });

  it("scores against each paper's own maximum", () => {
    const papers = [
      { attempted: true, score: 45, maxScore: 50 },
      { attempted: true, score: 30, maxScore: 60 },
    ];
    expect(pastPaperProgress(papers)).toBeCloseTo((0.9 + 0.5) / 2);
  });

  it("counts an unscored attempt as coverage only", () => {
    expect(pastPaperProgress([{ attempted: true, score: null, maxScore: null }])).toBe(1);
    const mixed = [
      { attempted: true, score: null, maxScore: null },
      { attempted: true, score: 50, maxScore: 100 },
    ];
    expect(pastPaperProgress(mixed)).toBeCloseTo(0.5);
  });

  it("caps an over-full score at 1 and ignores a zero maximum", () => {
    expect(pastPaperProgress([{ attempted: true, score: 120, maxScore: 100 }])).toBe(1);
    expect(pastPaperProgress([{ attempted: true, score: 5, maxScore: 0 }])).toBe(1);
  });
});

describe("moduleReadiness", () => {
  it("blends chapters 70% and past papers 30% by default", () => {
    expect(
      moduleReadiness({ chapters: 0.8, hasChapters: true, pastPapers: 0.5, chapterWeight: 0.7 }),
    ).toBeCloseTo(0.7 * 0.8 + 0.3 * 0.5);
  });

  it("uses chapters alone when there are no past papers", () => {
    expect(
      moduleReadiness({ chapters: 0.8, hasChapters: true, pastPapers: null, chapterWeight: 0.7 }),
    ).toBeCloseTo(0.8);
  });

  it("uses past papers alone when there are no chapters", () => {
    expect(
      moduleReadiness({ chapters: 0, hasChapters: false, pastPapers: 0.6, chapterWeight: 0.7 }),
    ).toBeCloseTo(0.6);
  });

  it("is 0 when the module has neither", () => {
    expect(
      moduleReadiness({ chapters: 0, hasChapters: false, pastPapers: null, chapterWeight: 0.7 }),
    ).toBe(0);
  });

  it("respects a custom split and clamps a bad one", () => {
    const base = { chapters: 1, hasChapters: true, pastPapers: 0 };
    expect(moduleReadiness({ ...base, chapterWeight: 0.5 })).toBeCloseTo(0.5);
    expect(moduleReadiness({ ...base, chapterWeight: 3 })).toBe(1);
    expect(moduleReadiness({ ...base, chapterWeight: -1 })).toBe(0);
  });
});
