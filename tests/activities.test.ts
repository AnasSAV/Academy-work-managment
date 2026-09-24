import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import {
  adjustRevision,
  createActivityType,
  deleteActivityType,
  getActivityTypeDeleteImpact,
  listActivityTypes,
  setActivityCounts,
  setActivityDone,
  updateActivityType,
  updateChapterDetails,
} from "@/db/activities";
import { NotFoundError, RuleError } from "@/db/errors";
import { loadModuleProgress } from "@/db/progress-queries";
import { chapterActivities, chapters, pastPapers, settings as settingsTable } from "@/db/schema";
import { addChapters, createModule, createSemester, deleteChapter } from "@/db/services";
import { getSettings, updateSettings } from "@/db/settings";
import { parseInput } from "@/lib/validation/parse";
import {
  activityCountsSchema,
  activityTypeSchema,
  chapterDetailsSchema,
  moduleSchema,
  settingsSchema,
} from "@/lib/validation/schemas";

const TODAY = "2026-03-10";
const LATER = "2026-03-20";

let db: Db;
let moduleId: number;
let otherModuleId: number;
let chapterId: number;
let otherChapterId: number;
let type: Record<"learned" | "questions" | "notes" | "revised", number>;

function parsed<T>(r: { ok: true; data: T } | { ok: false; error: string }) {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

beforeEach(() => {
  db = createDatabase(":memory:");
  const semester = createSemester(db, { name: "S", startDate: null, endDate: null });
  const input = (name: string) => parsed(parseInput(moduleSchema, { name, color: "#3b82f6" }));
  moduleId = createModule(db, semester.id, input("M")).id;
  otherModuleId = createModule(db, semester.id, input("Other")).id;
  chapterId = addChapters(db, moduleId, ["Chapter"])[0].id;
  otherChapterId = addChapters(db, otherModuleId, ["Other chapter"])[0].id;
  const byKey = Object.fromEntries(listActivityTypes(db, moduleId).map((t) => [t.key, t.id]));
  type = byKey as typeof type;
});

const row = (activityTypeId = type.learned) =>
  db
    .select()
    .from(chapterActivities)
    .where(eq(chapterActivities.chapterId, chapterId))
    .all()
    .find((r) => r.activityTypeId === activityTypeId);
const chapter = () => db.select().from(chapters).where(eq(chapters.id, chapterId)).get()!;

describe("setActivityDone", () => {
  it("creates the row on first tick and stamps the date", () => {
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    expect(row()).toMatchObject({ done: true, doneAt: TODAY });
  });

  it("keeps the original date when ticked again and clears it on untick", () => {
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    setActivityDone(db, chapterId, type.learned, true, LATER);
    expect(row()?.doneAt).toBe(TODAY);
    setActivityDone(db, chapterId, type.learned, false, LATER);
    expect(row()).toMatchObject({ done: false, doneAt: null });
  });

  it("updates one row per chapter and activity, never duplicates", () => {
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    setActivityDone(db, chapterId, type.learned, false, TODAY);
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    expect(db.select().from(chapterActivities).all()).toHaveLength(1);
  });

  it("rejects an activity from another module", () => {
    const foreign = listActivityTypes(db, otherModuleId)[0].id;
    expect(() => setActivityDone(db, chapterId, foreign, true, TODAY)).toThrow(NotFoundError);
    expect(() => setActivityDone(db, 999, type.learned, true, TODAY)).toThrow(NotFoundError);
    expect(db.select().from(chapterActivities).all()).toHaveLength(0);
  });

  it("ticking Revised logs a first revision and stamps last reviewed; unticking resets it", () => {
    setActivityDone(db, chapterId, type.revised, true, TODAY);
    expect(row(type.revised)).toMatchObject({ done: true, revisionCount: 1 });
    expect(chapter().lastReviewedAt).toBe(TODAY);

    setActivityDone(db, chapterId, type.revised, false, LATER);
    expect(row(type.revised)).toMatchObject({ done: false, revisionCount: 0, doneAt: null });
    expect(chapter().lastReviewedAt).toBe(TODAY); // history is kept
  });

  it("ticking other activities does not touch last reviewed", () => {
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    expect(chapter().lastReviewedAt).toBeNull();
  });
});

describe("adjustRevision", () => {
  it("counts repeated revisions and stamps the latest date", () => {
    adjustRevision(db, chapterId, 1, TODAY);
    adjustRevision(db, chapterId, 1, LATER);
    expect(row(type.revised)).toMatchObject({ done: true, revisionCount: 2, doneAt: LATER });
    expect(chapter().lastReviewedAt).toBe(LATER);
  });

  it("undoing down to zero unticks Revised and never goes negative", () => {
    adjustRevision(db, chapterId, 1, TODAY);
    adjustRevision(db, chapterId, -1, LATER);
    expect(row(type.revised)).toMatchObject({ done: false, revisionCount: 0, doneAt: null });
    adjustRevision(db, chapterId, -1, LATER);
    expect(row(type.revised)?.revisionCount).toBe(0);
  });

  it("undoing one of several keeps it ticked and does not move last reviewed", () => {
    adjustRevision(db, chapterId, 1, TODAY);
    adjustRevision(db, chapterId, 1, LATER);
    adjustRevision(db, chapterId, -1, "2026-04-01");
    expect(row(type.revised)).toMatchObject({ done: true, revisionCount: 1 });
    expect(chapter().lastReviewedAt).toBe(LATER);
  });
});

describe("setActivityCounts", () => {
  it("records counts and ticks the activity when the total is reached", () => {
    setActivityCounts(db, chapterId, type.questions, { countDone: 5, countTotal: 20 }, TODAY);
    expect(row(type.questions)).toMatchObject({ countDone: 5, countTotal: 20, done: false });

    setActivityCounts(db, chapterId, type.questions, { countDone: 20, countTotal: 20 }, LATER);
    expect(row(type.questions)).toMatchObject({ done: true, doneAt: LATER });
  });

  it("unticks again if the total is raised", () => {
    setActivityCounts(db, chapterId, type.questions, { countDone: 20, countTotal: 20 }, TODAY);
    setActivityCounts(db, chapterId, type.questions, { countDone: 20, countTotal: 30 }, LATER);
    expect(row(type.questions)).toMatchObject({ done: false, doneAt: null });
  });

  it("leaves a manual tick alone when counts are cleared", () => {
    setActivityDone(db, chapterId, type.questions, true, TODAY);
    setActivityCounts(db, chapterId, type.questions, { countDone: null, countTotal: null }, LATER);
    expect(row(type.questions)).toMatchObject({ done: true, countDone: null, countTotal: null });
  });

  it("rejects counts on an activity that does not track them", () => {
    expect(() =>
      setActivityCounts(db, chapterId, type.learned, { countDone: 1, countTotal: 2 }, TODAY),
    ).toThrow(RuleError);
  });

  it("validates counts input", () => {
    expect(parseInput(activityCountsSchema, { countDone: "5", countTotal: "20" })).toMatchObject({
      ok: true,
      data: { countDone: 5, countTotal: 20 },
    });
    expect(parseInput(activityCountsSchema, { countDone: "25", countTotal: "20" }).ok).toBe(false);
    expect(parseInput(activityCountsSchema, { countDone: "-1", countTotal: "" }).ok).toBe(false);
    expect(parseInput(activityCountsSchema, { countDone: "1.5", countTotal: "" }).ok).toBe(false);
    expect(parseInput(activityCountsSchema, { countDone: "", countTotal: "" })).toMatchObject({
      ok: true,
      data: { countDone: null, countTotal: null },
    });
  });
});

describe("chapter details", () => {
  it("saves confidence, date, note and link", () => {
    const input = parsed(
      parseInput(chapterDetailsSchema, {
        confidence: "4",
        lastReviewedAt: "2026-03-01",
        note: "  revise TCP  ",
        onenoteUrl: "onenote:https://d.docs.live.net/x",
      }),
    );
    updateChapterDetails(db, chapterId, input);
    expect(chapter()).toMatchObject({
      confidence: 4,
      lastReviewedAt: "2026-03-01",
      note: "revise TCP",
      onenoteUrl: "onenote:https://d.docs.live.net/x",
    });
  });

  it("clears fields when blank", () => {
    updateChapterDetails(db, chapterId, {
      confidence: 3,
      lastReviewedAt: "2026-03-01",
      note: "x",
      onenoteUrl: "https://example.com",
    });
    const blank = parsed(
      parseInput(chapterDetailsSchema, {
        confidence: "",
        lastReviewedAt: "",
        note: "",
        onenoteUrl: "",
      }),
    );
    updateChapterDetails(db, chapterId, blank);
    expect(chapter()).toMatchObject({
      confidence: null,
      lastReviewedAt: null,
      note: null,
      onenoteUrl: null,
    });
  });

  it("rejects bad confidence and unsafe links", () => {
    const check = (v: Record<string, string>) => parseInput(chapterDetailsSchema, v);
    expect(check({ confidence: "0" }).ok).toBe(false);
    expect(check({ confidence: "6" }).ok).toBe(false);
    expect(check({ confidence: "2.5" }).ok).toBe(false);
    expect(check({ onenoteUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(check({ onenoteUrl: "ftp://x" }).ok).toBe(false);
    expect(check({ onenoteUrl: "example.com" }).ok).toBe(false);
    expect(check({ onenoteUrl: "http://example.com" }).ok).toBe(true);
    expect(check({ lastReviewedAt: "2026-13-40" }).ok).toBe(false);
  });
});

describe("activity types", () => {
  const input = (v: Record<string, string>) => parsed(parseInput(activityTypeSchema, v));

  it("adds a custom activity at the end", () => {
    const created = createActivityType(db, moduleId, input({ label: "Flashcards", weight: "10" }));
    expect(created).toMatchObject({ key: null, weight: 10, tracksCounts: false, position: 4 });
    expect(listActivityTypes(db, moduleId)).toHaveLength(5);
    expect(listActivityTypes(db, otherModuleId)).toHaveLength(4);
  });

  it("reads the count-tracking checkbox", () => {
    const yes = createActivityType(
      db,
      moduleId,
      input({ label: "Labs", weight: "5", tracksCounts: "on" }),
    );
    expect(yes.tracksCounts).toBe(true);
  });

  it("rejects duplicate names within a module, case-insensitively", () => {
    expect(() =>
      createActivityType(db, moduleId, input({ label: "learned", weight: "1" })),
    ).toThrow(RuleError);
    expect(() =>
      createActivityType(db, otherModuleId, input({ label: "Flashcards", weight: "1" })),
    ).not.toThrow();
  });

  it("validates weight", () => {
    expect(parseInput(activityTypeSchema, { label: "x", weight: "-1" }).ok).toBe(false);
    expect(parseInput(activityTypeSchema, { label: "x", weight: "" }).ok).toBe(false);
    expect(parseInput(activityTypeSchema, { label: "", weight: "5" }).ok).toBe(false);
  });

  it("lets built-ins change name and weight but not their count tracking", () => {
    const updated = updateActivityType(
      db,
      type.learned,
      input({ label: "Lectures", weight: "50", tracksCounts: "on" }),
    );
    expect(updated).toMatchObject({
      label: "Lectures",
      weight: 50,
      key: "learned",
      tracksCounts: false,
    });
  });

  it("refuses to delete a built-in but deletes a custom one with its records", () => {
    expect(() => deleteActivityType(db, type.learned)).toThrow(RuleError);

    const custom = createActivityType(db, moduleId, input({ label: "Flashcards", weight: "10" }));
    setActivityDone(db, chapterId, custom.id, true, TODAY);
    expect(getActivityTypeDeleteImpact(db, custom.id)).toEqual({ activityRecords: 1 });
    deleteActivityType(db, custom.id);
    expect(db.select().from(chapterActivities).all()).toHaveLength(0);
    expect(() => deleteActivityType(db, custom.id)).toThrow(NotFoundError);
  });
});

describe("loadModuleProgress", () => {
  const settings = { readinessChapterWeight: 0.7 };

  it("is 0 for a fresh module and reflects ticks with the default weights", () => {
    expect(loadModuleProgress(db, [moduleId], settings).get(moduleId)).toMatchObject({
      chapterProgress: 0,
      readiness: 0,
    });
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    const p = loadModuleProgress(db, [moduleId], settings).get(moduleId)!;
    expect(p.chapters[0].progress).toBeCloseTo(0.4);
    expect(p.chapterProgress).toBeCloseTo(0.4);
    expect(p.pastPaperProgress).toBeNull();
    expect(p.readiness).toBeCloseTo(0.4);
  });

  it("averages chapters and keeps modules separate", () => {
    const second = addChapters(db, moduleId, ["Second"])[0];
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    setActivityDone(db, chapterId, type.notes, true, TODAY);
    setActivityDone(db, chapterId, type.questions, true, TODAY);
    setActivityDone(db, chapterId, type.revised, true, TODAY); // chapter 1 = 100%
    expect(second.id).not.toBe(chapterId);

    const all = loadModuleProgress(db, [moduleId, otherModuleId], settings);
    expect(all.get(moduleId)!.chapterProgress).toBeCloseTo(0.5);
    expect(all.get(otherModuleId)!.chapterProgress).toBe(0);
    expect(otherChapterId).toBeGreaterThan(0);
  });

  it("reflects question counts, custom activities and weight changes", () => {
    setActivityCounts(db, chapterId, type.questions, { countDone: 10, countTotal: 20 }, TODAY);
    expect(
      loadModuleProgress(db, [moduleId], settings).get(moduleId)!.chapters[0].progress,
    ).toBeCloseTo(0.15);

    // Give "Learned" zero weight: questions 15/(30+15+15) = 0.25 of the remaining total.
    updateActivityType(db, type.learned, {
      label: "Learned",
      weight: 0,
      tracksCounts: false,
    });
    expect(
      loadModuleProgress(db, [moduleId], settings).get(moduleId)!.chapters[0].progress,
    ).toBeCloseTo(15 / 60);
  });

  it("blends past papers into readiness", () => {
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    setActivityDone(db, chapterId, type.notes, true, TODAY);
    setActivityDone(db, chapterId, type.questions, true, TODAY);
    setActivityDone(db, chapterId, type.revised, true, TODAY); // chapters = 1
    db.insert(pastPapers)
      .values({ moduleId, title: "2024", attempted: true, score: 50, maxScore: 100 })
      .run();
    db.insert(pastPapers).values({ moduleId, title: "2023", attempted: false }).run();

    const p = loadModuleProgress(db, [moduleId], settings).get(moduleId)!;
    expect(p.pastPaperProgress).toBeCloseTo(0.25); // coverage 1/2 x score 0.5
    expect(p.readiness).toBeCloseTo(0.7 * 1 + 0.3 * 0.25);
  });

  it("drops progress when a chapter is deleted", () => {
    setActivityDone(db, chapterId, type.learned, true, TODAY);
    deleteChapter(db, chapterId);
    const p = loadModuleProgress(db, [moduleId], settings).get(moduleId)!;
    expect(p.chapters).toHaveLength(0);
    expect(p.readiness).toBe(0);
  });

  it("handles no modules", () => {
    expect(loadModuleProgress(db, [], settings).size).toBe(0);
  });
});

describe("settings", () => {
  it("returns defaults, then stored overrides", () => {
    expect(getSettings(db)).toEqual({ readinessChapterWeight: 0.7, reviseAfterDays: 14 });
    updateSettings(db, { readinessChapterWeight: 0.5 });
    expect(getSettings(db)).toEqual({ readinessChapterWeight: 0.5, reviseAfterDays: 14 });
    updateSettings(db, { reviseAfterDays: 7 });
    updateSettings(db, { readinessChapterWeight: 0.6 });
    expect(getSettings(db)).toEqual({ readinessChapterWeight: 0.6, reviseAfterDays: 7 });
  });

  it("converts the form's percentage to a fraction and validates ranges", () => {
    expect(
      parseInput(settingsSchema, { readinessChapterPercent: "60", reviseAfterDays: "10" }),
    ).toMatchObject({ ok: true, data: { readinessChapterWeight: 0.6, reviseAfterDays: 10 } });
    expect(
      parseInput(settingsSchema, { readinessChapterPercent: "101", reviseAfterDays: "10" }).ok,
    ).toBe(false);
    expect(
      parseInput(settingsSchema, { readinessChapterPercent: "60", reviseAfterDays: "0" }).ok,
    ).toBe(false);
    expect(
      parseInput(settingsSchema, { readinessChapterPercent: "", reviseAfterDays: "10" }).ok,
    ).toBe(false);
  });

  it("ignores corrupt, non-numeric and unknown stored values", () => {
    db.insert(settingsTable)
      .values([
        { key: "reviseAfterDays", value: "not json" },
        { key: "readinessChapterWeight", value: '"high"' },
        { key: "somethingElse", value: "5" },
      ])
      .run();
    expect(getSettings(db)).toEqual({ readinessChapterWeight: 0.7, reviseAfterDays: 14 });
  });
});
