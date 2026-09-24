import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import { listChapters, listModuleSummaries, listNav } from "@/db/queries";
import {
  NotFoundError,
  addChapters,
  createModule,
  createSemester,
  deleteChapter,
  deleteModule,
  deleteSemester,
  getModuleDeleteImpact,
  getSemesterDeleteImpact,
  moveChapter,
  moveModule,
  moveSemester,
  renameChapter,
  updateModule,
  updateSemester,
} from "@/db/services";
import { activityTypes, assessments, chapterActivities, chapters, modules } from "@/db/schema";
import { parseInput } from "@/lib/validation/parse";
import {
  chapterLinesSchema,
  chapterTitleSchema,
  moduleSchema,
  semesterSchema,
} from "@/lib/validation/schemas";

let db: Db;

const moduleInput = (name: string) => {
  const parsed = parseInput(moduleSchema, { name, color: "#3b82f6" });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
};

beforeEach(() => {
  db = createDatabase(":memory:");
});

describe("validation", () => {
  it("trims names and turns blank optional fields into null", () => {
    const r = parseInput(moduleSchema, {
      name: "  Networks  ",
      color: "#10b981",
      code: "",
      credits: "  ",
      targetGrade: "",
      examDate: "",
    });
    expect(r).toMatchObject({
      ok: true,
      data: { name: "Networks", code: null, credits: null, targetGrade: null, examDate: null },
    });
  });

  it("parses numbers from form strings and enforces ranges", () => {
    const ok = parseInput(moduleSchema, { name: "M", color: "#000000", targetGrade: "85.5" });
    expect(ok).toMatchObject({ ok: true, data: { targetGrade: 85.5 } });

    const tooHigh = parseInput(moduleSchema, { name: "M", color: "#000000", targetGrade: "120" });
    expect(tooHigh).toMatchObject({ ok: false });
    const notNumber = parseInput(moduleSchema, { name: "M", color: "#000000", credits: "abc" });
    expect(notNumber).toMatchObject({ ok: false, fieldErrors: { credits: expect.any(String) } });
  });

  it("reports field errors keyed by field name", () => {
    const r = parseInput(moduleSchema, { name: "", color: "blue" });
    expect(r).toMatchObject({
      ok: false,
      fieldErrors: { name: "Name is required", color: expect.stringContaining("hex") },
    });
  });

  it("rejects an end date before the start date", () => {
    const bad = parseInput(semesterSchema, {
      name: "S",
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });
    expect(bad).toMatchObject({ ok: false, fieldErrors: { endDate: expect.any(String) } });
    expect(parseInput(semesterSchema, { name: "S", startDate: "2026-02-31" })).toMatchObject({
      ok: false,
    });
    expect(
      parseInput(semesterSchema, { name: "S", startDate: "2026-01-01", endDate: "2026-01-01" }).ok,
    ).toBe(true);
  });

  it("splits chapter lines, dropping blanks and trimming", () => {
    const r = parseInput(chapterLinesSchema, { lines: " One \r\n\r\n Two\n   \nThree " });
    expect(r).toMatchObject({ ok: true, data: { lines: ["One", "Two", "Three"] } });
    expect(parseInput(chapterLinesSchema, { lines: " \n " }).ok).toBe(false);
    expect(parseInput(chapterLinesSchema, {}).ok).toBe(false);
    expect(parseInput(chapterTitleSchema, { title: "   " }).ok).toBe(false);
  });
});

describe("semesters and modules", () => {
  it("appends new semesters and modules in order", () => {
    const a = createSemester(db, { name: "A", startDate: null, endDate: null });
    const b = createSemester(db, { name: "B", startDate: null, endDate: null });
    expect([a.position, b.position]).toEqual([0, 1]);

    const m1 = createModule(db, a.id, moduleInput("M1"));
    const m2 = createModule(db, a.id, moduleInput("M2"));
    const other = createModule(db, b.id, moduleInput("Other"));
    expect([m1.position, m2.position, other.position]).toEqual([0, 1, 0]);
  });

  it("creates the built-in activity types with every new module", () => {
    const s = createSemester(db, { name: "S", startDate: null, endDate: null });
    const m = createModule(db, s.id, moduleInput("M"));
    const types = db.select().from(activityTypes).all();
    expect(types.filter((t) => t.moduleId === m.id)).toHaveLength(4);
  });

  it("throws NotFoundError for missing parents and rows", () => {
    expect(() => createModule(db, 999, moduleInput("M"))).toThrow(NotFoundError);
    expect(() => updateModule(db, 999, moduleInput("M"))).toThrow(NotFoundError);
    expect(() => updateSemester(db, 999, { name: "x", startDate: null, endDate: null })).toThrow(
      NotFoundError,
    );
    expect(() => deleteSemester(db, 999)).toThrow(NotFoundError);
    expect(() => addChapters(db, 999, ["x"])).toThrow(NotFoundError);
  });

  it("updates a module without touching its position or semester", () => {
    const s = createSemester(db, { name: "S", startDate: null, endDate: null });
    createModule(db, s.id, moduleInput("First"));
    const second = createModule(db, s.id, moduleInput("Second"));
    const updated = updateModule(db, second.id, { ...moduleInput("Renamed"), credits: 15 });
    expect(updated).toMatchObject({
      name: "Renamed",
      credits: 15,
      position: 1,
      semesterId: s.id,
    });
  });

  it("moves modules within their own semester only", () => {
    const s1 = createSemester(db, { name: "S1", startDate: null, endDate: null });
    const s2 = createSemester(db, { name: "S2", startDate: null, endDate: null });
    const a = createModule(db, s1.id, moduleInput("A"));
    const b = createModule(db, s1.id, moduleInput("B"));
    const c = createModule(db, s1.id, moduleInput("C"));
    createModule(db, s2.id, moduleInput("Z"));

    expect(moveModule(db, c.id, "up")).toBe(true);
    expect(listModuleSummaries(db, s1.id).map((m) => m.name)).toEqual(["A", "C", "B"]);
    expect(moveModule(db, a.id, "up")).toBe(false); // already first
    expect(moveModule(db, b.id, "down")).toBe(false); // already last
    expect(listNav(db)[1].modules.map((m) => m.name)).toEqual(["Z"]);
  });

  it("moves semesters", () => {
    createSemester(db, { name: "A", startDate: null, endDate: null });
    const b = createSemester(db, { name: "B", startDate: null, endDate: null });
    moveSemester(db, b.id, "up");
    expect(listNav(db).map((s) => s.name)).toEqual(["B", "A"]);
  });

  it("repairs duplicate positions when moving", () => {
    const s = createSemester(db, { name: "S", startDate: null, endDate: null });
    const a = createModule(db, s.id, moduleInput("A"));
    const b = createModule(db, s.id, moduleInput("B"));
    db.update(modules).set({ position: 5 }).run();
    moveModule(db, b.id, "up");
    expect(listModuleSummaries(db, s.id).map((m) => [m.name, m.position])).toEqual([
      ["B", 0],
      ["A", 1],
    ]);
    expect(a.id).toBeLessThan(b.id);
  });
});

describe("chapters", () => {
  function setup() {
    const s = createSemester(db, { name: "S", startDate: null, endDate: null });
    const m = createModule(db, s.id, moduleInput("M"));
    return { s, m };
  }

  it("adds several chapters in order, continuing after existing ones", () => {
    const { m } = setup();
    addChapters(db, m.id, ["One", "Two"]);
    addChapters(db, m.id, ["Three"]);
    expect(listChapters(db, m.id).map((c) => [c.title, c.position])).toEqual([
      ["One", 0],
      ["Two", 1],
      ["Three", 2],
    ]);
  });

  it("renames, moves and deletes chapters", () => {
    const { m } = setup();
    const [one, two, three] = addChapters(db, m.id, ["One", "Two", "Three"]);
    renameChapter(db, two.id, "Deux");
    moveChapter(db, three.id, "up");
    expect(listChapters(db, m.id).map((c) => c.title)).toEqual(["One", "Three", "Deux"]);
    deleteChapter(db, one.id);
    expect(listChapters(db, m.id).map((c) => c.title)).toEqual(["Three", "Deux"]);
    expect(() => deleteChapter(db, one.id)).toThrow(NotFoundError);
  });

  it("reports each module's own chapter count in the semester summary", () => {
    const { s, m } = setup();
    const other = createModule(db, s.id, moduleInput("Other"));
    const empty = createModule(db, s.id, moduleInput("Empty"));
    addChapters(db, m.id, ["A", "B", "C"]);
    addChapters(db, other.id, ["X"]);
    const counts = Object.fromEntries(
      listModuleSummaries(db, s.id).map((x) => [x.name, x.chapterCount]),
    );
    expect(counts).toEqual({ M: 3, Other: 1, Empty: 0 });
    expect(empty.id).toBeGreaterThan(other.id);
  });

  it("keeps chapters of different modules independent", () => {
    const { s, m } = setup();
    const other = createModule(db, s.id, moduleInput("Other"));
    const [a] = addChapters(db, m.id, ["A", "B"]);
    addChapters(db, other.id, ["X", "Y"]);
    expect(moveChapter(db, a.id, "down")).toBe(true);
    expect(listChapters(db, other.id).map((c) => c.title)).toEqual(["X", "Y"]);
  });
});

describe("delete impact and cascades", () => {
  it("counts what a delete would remove, then removes it", () => {
    const s = createSemester(db, { name: "S", startDate: null, endDate: null });
    const m = createModule(db, s.id, moduleInput("M"));
    const [c1] = addChapters(db, m.id, ["One", "Two"]);
    const type = db.select().from(activityTypes).get()!;
    db.insert(chapterActivities)
      .values({ chapterId: c1.id, activityTypeId: type.id, done: true })
      .run();
    db.insert(assessments).values({ moduleId: m.id, name: "A", weight: 10 }).run();

    expect(getSemesterDeleteImpact(db, s.id)).toEqual({
      modules: 1,
      chapters: 2,
      assessments: 1,
      pastPapers: 0,
    });
    expect(getModuleDeleteImpact(db, m.id)).toEqual({
      chapters: 2,
      assessments: 1,
      pastPapers: 0,
      activityRecords: 1,
    });

    deleteModule(db, m.id);
    expect(db.select().from(chapters).all()).toHaveLength(0);
    expect(db.select().from(chapterActivities).all()).toHaveLength(0);
    expect(db.select().from(assessments).all()).toHaveLength(0);
    expect(listNav(db)).toHaveLength(1); // the semester itself remains
  });
});
