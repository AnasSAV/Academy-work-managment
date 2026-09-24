import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import {
  adjustRevision,
  completeChapter,
  listActivityTypes,
  setActivityDone,
  updateChapterDetails,
} from "@/db/activities";
import { createAssessment } from "@/db/assessments";
import { NotFoundError } from "@/db/errors";
import { chapterActivities, chapters } from "@/db/schema";
import { loadStudy } from "@/db/study-queries";
import { addChapters, createModule, createSemester, updateModule } from "@/db/services";
import { parseInput } from "@/lib/validation/parse";
import { assessmentSchema, moduleSchema } from "@/lib/validation/schemas";

const TODAY = "2026-03-10";
const settings = { readinessChapterWeight: 0.7, reviseAfterDays: 14 };

function parsed<T>(r: { ok: true; data: T } | { ok: false; error: string }) {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

let db: Db;
let semester: { id: number };
let modA: number;
let modB: number;
let a: { id: number }[]; // chapters of module A

const typeId = (moduleId: number, key: string) =>
  listActivityTypes(db, moduleId).find((t) => t.key === key)!.id;

beforeEach(() => {
  db = createDatabase(":memory:");
  semester = createSemester(db, { name: "S", startDate: null, endDate: null });
  const input = (name: string) => parsed(parseInput(moduleSchema, { name, color: "#2a78d6" }));
  const moduleA = createModule(db, semester.id, input("Alpha"));
  modA = moduleA.id;
  modB = createModule(db, semester.id, input("Beta")).id;
  updateModule(db, modA, { ...input("Alpha"), examDate: "2026-03-20" }); // 10 days away
  a = addChapters(db, modA, ["a1", "a2", "a3", "a4", "a5"]);
  addChapters(db, modB, ["b1"]);
});

const study = () => loadStudy(db, semester, settings, TODAY);
const chapter = (title: string) => study().chapters.find((c) => c.title === title)!;

describe("completeChapter", () => {
  it("ticks every activity, counts a first revision and stamps the review date", () => {
    completeChapter(db, a[0].id, TODAY);
    const rows = db
      .select()
      .from(chapterActivities)
      .where(eq(chapterActivities.chapterId, a[0].id))
      .all();
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.done && r.doneAt === TODAY)).toBe(true);
    expect(rows.find((r) => r.activityTypeId === typeId(modA, "revised"))?.revisionCount).toBe(1);
    expect(db.select().from(chapters).where(eq(chapters.id, a[0].id)).get()?.lastReviewedAt).toBe(
      TODAY,
    );
  });

  it("includes custom activities and is safe to repeat", () => {
    completeChapter(db, a[0].id, TODAY);
    completeChapter(db, a[0].id, "2026-03-11");
    const rows = db
      .select()
      .from(chapterActivities)
      .where(eq(chapterActivities.chapterId, a[0].id))
      .all();
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.doneAt === TODAY)).toBe(true); // original dates kept
    expect(rows.find((r) => r.activityTypeId === typeId(modA, "revised"))?.revisionCount).toBe(1);
  });

  it("does not touch other chapters, and rejects an unknown one", () => {
    completeChapter(db, a[0].id, TODAY);
    expect(
      db.select().from(chapterActivities).where(eq(chapterActivities.chapterId, a[1].id)).all(),
    ).toHaveLength(0);
    expect(() => completeChapter(db, 9999, TODAY)).toThrow(NotFoundError);
  });
});

describe("loadStudy", () => {
  beforeEach(() => {
    // a1: untouched. a2: learned a while ago and never reviewed. a3: learned and revised recently.
    // a4: completed. a5: shaky (confidence 1), learned two days ago.
    setActivityDone(db, a[1].id, typeId(modA, "learned"), true, "2026-02-01");
    setActivityDone(db, a[2].id, typeId(modA, "learned"), true, "2026-03-01");
    adjustRevision(db, a[2].id, 1, "2026-03-05");
    completeChapter(db, a[3].id, "2026-03-09");
    setActivityDone(db, a[4].id, typeId(modA, "learned"), true, "2026-03-08");
    updateChapterDetails(db, a[4].id, {
      confidence: 1,
      lastReviewedAt: null,
      note: null,
      onenoteUrl: null,
    });
  });

  it("derives each chapter's board column from what is ticked", () => {
    expect(chapter("a1").status).toBe("to_learn");
    expect(chapter("a2").status).toBe("learning");
    expect(chapter("a3").status).toBe("revising");
    expect(chapter("a4").status).toBe("done");
    expect(chapter("a5").status).toBe("learning");
    expect(chapter("b1").status).toBe("to_learn");
  });

  it("carries module details and the learned activity for the board", () => {
    expect(chapter("a2")).toMatchObject({
      moduleId: modA,
      moduleName: "Alpha",
      moduleColor: "#2a78d6",
      learnedTypeId: typeId(modA, "learned"),
    });
    expect(study().chapters.map((c) => c.title)).toEqual(["a1", "a2", "a3", "a4", "a5", "b1"]);
  });

  it("works out when each learned chapter is due for revision", () => {
    expect(chapter("a1").revision).toBeNull(); // not learned
    expect(chapter("b1").revision).toBeNull();
    // learned 2026-02-01, never reviewed: 14 days -> due 2026-02-15, 23 days ago
    expect(chapter("a2").revision).toMatchObject({
      dueDate: "2026-02-15",
      daysUntil: -23,
      state: "overdue",
    });
    // reviewed 2026-03-05, one revision: 14 x 1.5 = 21 days
    expect(chapter("a3").revision).toMatchObject({
      dueDate: "2026-03-26",
      intervalDays: 21,
      state: "later",
    });
    // completed 2026-03-09: reviewed that day, one revision: 21 days
    expect(chapter("a4").revision).toMatchObject({ dueDate: "2026-03-30", state: "later" });
    // confidence 1 on a 14-day base = 4 days from the day it was learned (2026-03-08)
    expect(chapter("a5").revision).toMatchObject({
      dueDate: "2026-03-12",
      intervalDays: 4,
      state: "soon",
    });
  });

  it("flags what needs attention and ranks it, with the exam raising the score", () => {
    expect(chapter("a3").attention).toBeNull();
    expect(chapter("a4").attention).toBeNull();

    // overdue 23 days (3 + capped 3 = 6) + exam in 10 days (+2)
    expect(chapter("a2").attention).toMatchObject({
      score: 8,
      reasons: [
        { kind: "overdue", days: 23 },
        { kind: "exam_soon", days: 10 },
      ],
    });
    // low confidence 1 (3) + exam (+2); not yet due, so no overdue reason
    expect(chapter("a5").attention).toMatchObject({
      score: 5,
      reasons: [
        { kind: "low_confidence", confidence: 1 },
        { kind: "exam_soon", days: 10 },
      ],
    });
    // untouched, in a module that has started and has an exam: 1 + 2
    expect(chapter("a1").attention).toMatchObject({
      score: 3,
      reasons: [{ kind: "untouched" }, { kind: "exam_soon", days: 10 }],
    });
  });

  it("does not flag an untouched chapter in a module nobody has started", () => {
    expect(chapter("b1").attention).toBeNull();
  });

  it("uses the revise-after setting", () => {
    const shorter = loadStudy(db, semester, { ...settings, reviseAfterDays: 7 }, TODAY);
    // reviewed 2026-03-05, one revision: 7 x 1.5 = 10.5 -> 11 days -> 2026-03-16
    expect(shorter.chapters.find((c) => c.title === "a3")!.revision?.dueDate).toBe("2026-03-16");
  });

  it("only counts an exam that has not happened yet", () => {
    updateModule(db, modA, {
      ...parsed(parseInput(moduleSchema, { name: "Alpha", color: "#2a78d6" })),
      examDate: "2026-03-01",
    });
    expect(chapter("a5").attention?.reasons).toEqual([{ kind: "low_confidence", confidence: 1 }]);
    expect(chapter("a5").attention?.score).toBe(3);
  });

  it("collects assessment due dates and exams, oldest first", () => {
    const add = (name: string, dueDate: string, status = "not_started") =>
      createAssessment(
        db,
        modA,
        parsed(
          parseInput(assessmentSchema, {
            name,
            weight: "10",
            dueDate,
            status,
            ...(status === "graded" ? { score: "5" } : {}),
          }),
        ),
      );
    add("Old", "2026-03-01");
    add("Report", "2026-03-15", "in_progress");
    add("Marked", "2026-03-12", "graded");
    createAssessment(
      db,
      modB,
      parsed(parseInput(assessmentSchema, { name: "Undated", weight: "5" })),
    );

    const items = study().items;
    expect(items.map((i) => [i.title, i.days, i.finished])).toEqual([
      ["Old", -9, false],
      ["Marked", 2, true],
      ["Report", 5, false],
      ["Alpha exam", 10, false],
    ]);
    expect(items.find((i) => i.title === "Old")).toMatchObject({
      moduleName: "Alpha",
      kind: "assessment",
    });
  });

  it("handles a semester with no modules", () => {
    const empty = createSemester(db, { name: "Empty", startDate: null, endDate: null });
    expect(loadStudy(db, empty, settings, TODAY)).toEqual({ chapters: [], items: [] });
  });
});
