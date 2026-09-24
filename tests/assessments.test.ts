import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import {
  createAssessment,
  createTag,
  deleteAssessment,
  deleteTag,
  getTagDeleteImpact,
  listAssessments,
  listTags,
  moveAssessment,
  updateAssessment,
  updateTag,
} from "@/db/assessments";
import { createAttachment, listAttachments } from "@/db/attachments";
import { NotFoundError, RuleError } from "@/db/errors";
import {
  createPastPaper,
  deletePastPaper,
  getPastPaperDeleteImpact,
  listPastPapers,
  updatePastPaper,
} from "@/db/past-papers";
import { loadModuleProgress } from "@/db/progress-queries";
import { assessmentTags, assessments, attachments, tags } from "@/db/schema";
import { createModule, createSemester, deleteModule } from "@/db/services";
import {
  filterAssessments,
  normalizeAssessment,
  normalizePastPaper,
  parseWorkMode,
  scorePercent,
  weightByWorkMode,
  weightSummary,
} from "@/lib/assessments";
import { ADVANCED_ML_ASSESSMENTS } from "@/lib/fixtures/advanced-ml";
import { deleteStored, saveUpload } from "@/lib/storage";
import { parseInput } from "@/lib/validation/parse";
import {
  assessmentSchema,
  moduleSchema,
  pastPaperSchema,
  tagSchema,
  type AssessmentInput,
} from "@/lib/validation/schemas";

let db: Db;
let moduleId: number;
let otherModuleId: number;

function parsed<T>(r: { ok: true; data: T } | { ok: false; error: string }) {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
const assessment = (fields: Record<string, unknown> = {}) =>
  parsed(parseInput(assessmentSchema, { name: "Quiz", weight: "10", ...fields }));
const paper = (fields: Record<string, unknown> = {}) =>
  parsed(parseInput(pastPaperSchema, { title: "2024 Final", ...fields }));

beforeEach(() => {
  db = createDatabase(":memory:");
  const semester = createSemester(db, { name: "S", startDate: null, endDate: null });
  const input = (name: string) => parsed(parseInput(moduleSchema, { name, color: "#3b82f6" }));
  moduleId = createModule(db, semester.id, input("M")).id;
  otherModuleId = createModule(db, semester.id, input("Other")).id;
});

// ---- pure rules --------------------------------------------------------------------------------

describe("assessment rules", () => {
  const base = {
    status: "in_progress" as const,
    score: null,
    workMode: "individual" as const,
    groupSize: 4,
    groupMembers: "A, B",
  };

  it("marks an assessment graded once it has a score", () => {
    expect(normalizeAssessment({ ...base, score: 8 }).status).toBe("graded");
    expect(normalizeAssessment(base).status).toBe("in_progress");
  });

  it("keeps group details only for group work", () => {
    expect(normalizeAssessment(base)).toMatchObject({ groupSize: null, groupMembers: null });
    expect(normalizeAssessment({ ...base, workMode: "unspecified" })).toMatchObject({
      groupSize: null,
    });
    expect(normalizeAssessment({ ...base, workMode: "group" })).toMatchObject({
      groupSize: 4,
      groupMembers: "A, B",
    });
  });

  it("computes score percentages safely", () => {
    expect(scorePercent(17, 20)).toBe(85);
    expect(scorePercent(1, 3)).toBeCloseTo(33.33, 2);
    expect(scorePercent(null, 20)).toBeNull();
    expect(scorePercent(5, 0)).toBeNull();
  });

  it("sums weights and reports whether they reach 100", () => {
    expect(weightSummary([])).toEqual({ total: 0, remaining: 100, state: "empty" });
    expect(weightSummary([{ weight: 60 }, { weight: 30 }])).toEqual({
      total: 90,
      remaining: 10,
      state: "under",
    });
    expect(weightSummary([{ weight: 60 }, { weight: 50 }])).toEqual({
      total: 110,
      remaining: -10,
      state: "over",
    });
    // floating point noise must not trigger a warning
    expect(weightSummary([{ weight: 33.3 }, { weight: 33.3 }, { weight: 33.4 }]).state).toBe(
      "complete",
    );
    expect(weightSummary([{ weight: 0.1 }, { weight: 0.2 }, { weight: 99.7 }]).state).toBe(
      "complete",
    );
  });

  it("uses the Advanced ML table as a fixture: eight components summing to 100", () => {
    const summary = weightSummary(ADVANCED_ML_ASSESSMENTS);
    expect(ADVANCED_ML_ASSESSMENTS).toHaveLength(8);
    expect(summary).toEqual({ total: 100, remaining: 0, state: "complete" });
  });

  it("totals weight by work mode and filters by mode and tag", () => {
    const items = [
      { weight: 10, workMode: "individual" as const, tags: [{ id: 1 }] },
      { weight: 20, workMode: "group" as const, tags: [{ id: 1 }, { id: 2 }] },
      { weight: 5, workMode: "group" as const, tags: [] },
      { weight: 65, workMode: "unspecified" as const, tags: [{ id: 2 }] },
    ];
    expect(weightByWorkMode(items)).toEqual({ individual: 10, group: 25, unspecified: 65 });
    expect(filterAssessments(items, {})).toHaveLength(4);
    expect(filterAssessments(items, { mode: "group" })).toHaveLength(2);
    expect(filterAssessments(items, { tagId: 2 })).toHaveLength(2);
    expect(filterAssessments(items, { mode: "group", tagId: 2 })).toHaveLength(1);
    expect(filterAssessments(items, { tagId: 99 })).toHaveLength(0);
    expect(parseWorkMode("group")).toBe("group");
    expect(parseWorkMode("nonsense")).toBeNull();
    expect(parseWorkMode(undefined)).toBeNull();
  });

  it("normalises past papers", () => {
    const empty = {
      attempted: false,
      score: null,
      maxScore: null,
      minutesTaken: null,
      attemptedAt: null,
    };
    // a score implies an attempt and defaults the maximum to 100
    expect(normalizePastPaper({ ...empty, score: 70 })).toMatchObject({
      attempted: true,
      score: 70,
      maxScore: 100,
    });
    // an explicit maximum is kept
    expect(normalizePastPaper({ ...empty, score: 30, maxScore: 50 }).maxScore).toBe(50);
    // not attempted: everything else is cleared
    expect(
      normalizePastPaper({ ...empty, minutesTaken: 90, attemptedAt: "2026-01-01", maxScore: 50 }),
    ).toEqual(empty);
    // attempted without a score keeps its time and date
    expect(
      normalizePastPaper({
        ...empty,
        attempted: true,
        minutesTaken: 90,
        attemptedAt: "2026-01-01",
      }),
    ).toMatchObject({ attempted: true, minutesTaken: 90, attemptedAt: "2026-01-01", score: null });
  });
});

// ---- validation --------------------------------------------------------------------------------

describe("assessment validation", () => {
  it("accepts a minimal assessment with sensible defaults", () => {
    expect(assessment()).toMatchObject({
      name: "Quiz",
      weight: 10,
      status: "not_started",
      workMode: "unspecified",
      maxScore: 100,
      score: null,
      tagIds: [],
      newTags: [],
    });
  });

  it("requires a name and a weight within 0-100", () => {
    expect(parseInput(assessmentSchema, { weight: "10" }).ok).toBe(false);
    expect(parseInput(assessmentSchema, { name: "x" })).toMatchObject({
      ok: false,
      fieldErrors: { weight: expect.any(String) },
    });
    expect(parseInput(assessmentSchema, { name: "x", weight: "101" }).ok).toBe(false);
    expect(parseInput(assessmentSchema, { name: "x", weight: "-1" }).ok).toBe(false);
    expect(parseInput(assessmentSchema, { name: "x", weight: "0" }).ok).toBe(true);
    expect(parseInput(assessmentSchema, { name: "x", weight: "16.5" }).ok).toBe(true);
  });

  it("checks score against the max score", () => {
    expect(
      parseInput(assessmentSchema, { name: "x", weight: "5", score: "21", maxScore: "20" }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { score: "Score cannot be more than the max score" },
    });
    expect(assessment({ score: "20", maxScore: "20" }).score).toBe(20);
    expect(parseInput(assessmentSchema, { name: "x", weight: "5", maxScore: "0" }).ok).toBe(false);
    expect(parseInput(assessmentSchema, { name: "x", weight: "5", score: "-1" }).ok).toBe(false);
    // default max is 100
    expect(parseInput(assessmentSchema, { name: "x", weight: "5", score: "101" }).ok).toBe(false);
  });

  it("requires a score for a graded component", () => {
    expect(
      parseInput(assessmentSchema, { name: "x", weight: "5", status: "graded" }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { score: "Enter the score for a graded component" },
    });
    expect(assessment({ status: "graded", score: "9" }).status).toBe("graded");
  });

  it("validates work mode, status and group size", () => {
    expect(parseInput(assessmentSchema, { name: "x", weight: "5", workMode: "team" }).ok).toBe(
      false,
    );
    expect(parseInput(assessmentSchema, { name: "x", weight: "5", status: "done" }).ok).toBe(false);
    expect(
      parseInput(assessmentSchema, { name: "x", weight: "5", workMode: "group", groupSize: "1" })
        .ok,
    ).toBe(false);
    expect(
      parseInput(assessmentSchema, { name: "x", weight: "5", workMode: "group", groupSize: "2.5" })
        .ok,
    ).toBe(false);
    expect(
      assessment({ workMode: "group", groupSize: "4", groupMembers: "A, B, C" }),
    ).toMatchObject({
      workMode: "group",
      groupSize: 4,
    });
  });

  it("reads one or several ticked tags, and comma-separated new ones", () => {
    const fd = new FormData();
    fd.set("name", "Quiz");
    fd.set("weight", "5");
    fd.append("tagIds", "3");
    expect(parsed(parseInput(assessmentSchema, fd)).tagIds).toEqual([3]);
    fd.append("tagIds", "7");
    fd.set("newTags", " online,  proctored ,, ");
    const both = parsed(parseInput(assessmentSchema, fd));
    expect(both.tagIds).toEqual([3, 7]);
    expect(both.newTags).toEqual(["online", "proctored"]);
    expect(parseInput(assessmentSchema, { name: "x", weight: "5", tagIds: ["abc"] }).ok).toBe(
      false,
    );
    expect(
      parseInput(assessmentSchema, { name: "x", weight: "5", newTags: "a".repeat(31) }).ok,
    ).toBe(false);
  });

  it("validates tags and past papers", () => {
    expect(parseInput(tagSchema, { name: " open book ", description: " allowed " })).toMatchObject({
      ok: true,
      data: { name: "open book", description: "allowed" },
    });
    expect(parseInput(tagSchema, { name: "a,b" }).ok).toBe(false);
    expect(parseInput(tagSchema, { name: "" }).ok).toBe(false);
    expect(parseInput(tagSchema, { name: "x", description: "d".repeat(201) }).ok).toBe(false);

    expect(
      paper({ year: "2024", attempted: "on", score: "70", maxScore: "100", minutesTaken: "150" }),
    ).toMatchObject({
      year: 2024,
      attempted: true,
      score: 70,
    });
    expect(parseInput(pastPaperSchema, { title: "" }).ok).toBe(false);
    expect(parseInput(pastPaperSchema, { title: "x", year: "1800" }).ok).toBe(false);
    expect(parseInput(pastPaperSchema, { title: "x", score: "70", maxScore: "50" }).ok).toBe(false);
    expect(parseInput(pastPaperSchema, { title: "x", minutesTaken: "-5" }).ok).toBe(false);
    expect(parseInput(pastPaperSchema, { title: "x", attemptedAt: "yesterday" }).ok).toBe(false);
  });
});

// ---- assessments and tags ----------------------------------------------------------------------

describe("assessments", () => {
  it("creates in order and lists them with their tags", () => {
    const a = createAssessment(
      db,
      moduleId,
      assessment({ name: "A", newTags: "online, proctored" }),
    );
    const b = createAssessment(db, moduleId, assessment({ name: "B" }));
    createAssessment(db, otherModuleId, assessment({ name: "Elsewhere" }));

    expect([a.position, b.position]).toEqual([0, 1]);
    const list = listAssessments(db, moduleId);
    expect(list.map((x) => x.name)).toEqual(["A", "B"]);
    expect(list[0].tags.map((t) => t.name)).toEqual(["online", "proctored"]);
    expect(list[1].tags).toEqual([]);
    expect(listAssessments(db, 9999)).toEqual([]);
  });

  it("applies the normalisation rules when saving", () => {
    const graded = createAssessment(
      db,
      moduleId,
      assessment({ status: "submitted", score: "18", maxScore: "20" }),
    );
    expect(graded).toMatchObject({ status: "graded", score: 18, maxScore: 20 });

    const notGroup = createAssessment(
      db,
      moduleId,
      assessment({ workMode: "individual", groupSize: "4", groupMembers: "x" }),
    );
    expect(notGroup).toMatchObject({ groupSize: null, groupMembers: null });

    const group = createAssessment(
      db,
      moduleId,
      assessment({ workMode: "group", groupSize: "4", groupMembers: "A, B" }),
    );
    expect(group).toMatchObject({ workMode: "group", groupSize: 4, groupMembers: "A, B" });
  });

  it("stores the Advanced ML table with the * marker as a described tag", () => {
    const star = createTag(
      db,
      moduleId,
      parsed(parseInput(tagSchema, { name: "*", description: "takes place in class" })),
    );
    for (const row of ADVANCED_ML_ASSESSMENTS) {
      createAssessment(
        db,
        moduleId,
        assessment({
          name: row.name,
          lecturer: row.lecturer,
          weight: String(row.weight),
          tagIds: row.starred ? [String(star.id)] : [],
        }),
      );
    }
    const list = listAssessments(db, moduleId);
    expect(list).toHaveLength(8);
    expect(list.filter((a) => a.tags.some((t) => t.name === "*"))).toHaveLength(4);
    expect(listTags(db, moduleId)).toEqual([
      expect.objectContaining({ name: "*", description: "takes place in class", usage: 4 }),
    ]);
    expect(weightSummary(list).state).toBe("complete");
  });

  it("updates fields and replaces the tag set", () => {
    const row = createAssessment(
      db,
      moduleId,
      assessment({ name: "A", newTags: "online, proctored" }),
    );
    const online = listTags(db, moduleId).find((t) => t.name === "online")!;

    const input: AssessmentInput = assessment({
      name: "A (renamed)",
      weight: "25",
      workMode: "group",
      groupSize: "3",
      tagIds: [String(online.id)],
      newTags: "open book",
    });
    updateAssessment(db, row.id, input);

    const [updated] = listAssessments(db, moduleId);
    expect(updated).toMatchObject({
      name: "A (renamed)",
      weight: 25,
      workMode: "group",
      groupSize: 3,
      position: 0,
    });
    expect(updated.tags.map((t) => t.name)).toEqual(["online", "open book"]);
    expect(() => updateAssessment(db, 999, input)).toThrow(NotFoundError);
  });

  it("reuses a tag with the same name in any case instead of duplicating it", () => {
    createAssessment(db, moduleId, assessment({ newTags: "Online" }));
    createAssessment(db, moduleId, assessment({ newTags: "online, ONLINE" }));
    expect(listTags(db, moduleId)).toHaveLength(1);
    expect(listTags(db, moduleId)[0].usage).toBe(2);
  });

  it("refuses tags from another module and unknown modules", () => {
    const foreign = createTag(db, otherModuleId, { name: "x", description: null });
    expect(() =>
      createAssessment(db, moduleId, assessment({ tagIds: [String(foreign.id)] })),
    ).toThrow(RuleError);
    expect(() => createAssessment(db, moduleId, assessment({ tagIds: ["9999"] }))).toThrow(
      RuleError,
    );
    expect(() => createAssessment(db, 9999, assessment())).toThrow(NotFoundError);
    expect(db.select().from(assessments).all()).toHaveLength(0); // the failed create rolled back
  });

  it("rolls back an assessment whose tags are invalid", () => {
    expect(() =>
      createAssessment(db, moduleId, assessment({ name: "Half", tagIds: ["9999"] })),
    ).toThrow();
    expect(listAssessments(db, moduleId)).toEqual([]);
  });

  it("reorders within a module", () => {
    const [a, b, c] = ["A", "B", "C"].map((name) =>
      createAssessment(db, moduleId, assessment({ name })),
    );
    moveAssessment(db, c.id, "up");
    expect(listAssessments(db, moduleId).map((x) => x.name)).toEqual(["A", "C", "B"]);
    expect(moveAssessment(db, a.id, "up")).toBe(false);
    expect(moveAssessment(db, b.id, "down")).toBe(false);
    expect(() => moveAssessment(db, 999, "up")).toThrow(NotFoundError);
  });
});

describe("tags", () => {
  it("creates, renames, describes and deletes", () => {
    const tag = createTag(db, moduleId, { name: "online", description: null });
    expect(
      updateTag(db, tag.id, { name: "Online exam", description: "taken via the portal" }),
    ).toMatchObject({
      name: "Online exam",
      description: "taken via the portal",
    });
    expect(() => updateTag(db, 999, { name: "x", description: null })).toThrow(NotFoundError);
    deleteTag(db, tag.id);
    expect(listTags(db, moduleId)).toEqual([]);
    expect(() => deleteTag(db, tag.id)).toThrow(NotFoundError);
  });

  it("keeps names unique per module, ignoring case, but not across modules", () => {
    const a = createTag(db, moduleId, { name: "Online", description: null });
    expect(() => createTag(db, moduleId, { name: "online", description: null })).toThrow(RuleError);
    expect(() => createTag(db, otherModuleId, { name: "online", description: null })).not.toThrow();
    const b = createTag(db, moduleId, { name: "Proctored", description: null });
    expect(() => updateTag(db, b.id, { name: "ONLINE", description: null })).toThrow(RuleError);
    // renaming to its own name in a different case is fine
    expect(() => updateTag(db, a.id, { name: "ONLINE", description: null })).not.toThrow();
  });

  it("deleting a tag unlinks it but keeps the assessments", () => {
    createAssessment(db, moduleId, assessment({ newTags: "online" }));
    const tag = listTags(db, moduleId)[0];
    expect(getTagDeleteImpact(db, tag.id)).toEqual({ assessments: 1 });
    deleteTag(db, tag.id);
    expect(db.select().from(assessmentTags).all()).toHaveLength(0);
    expect(db.select().from(assessments).all()).toHaveLength(1);
    expect(db.select().from(tags).all()).toHaveLength(0);
  });
});

// ---- past papers -------------------------------------------------------------------------------

describe("past papers", () => {
  it("lists newest year first, with undated papers last", () => {
    createPastPaper(db, moduleId, paper({ title: "old", year: "2021" }));
    createPastPaper(db, moduleId, paper({ title: "undated" }));
    createPastPaper(db, moduleId, paper({ title: "new", year: "2024" }));
    createPastPaper(db, otherModuleId, paper({ title: "elsewhere", year: "2030" }));
    expect(listPastPapers(db, moduleId).map((p) => p.title)).toEqual(["new", "old", "undated"]);
  });

  it("applies the normalisation rules when saving and updating", () => {
    const scored = createPastPaper(db, moduleId, paper({ score: "70" }));
    expect(scored).toMatchObject({ attempted: true, score: 70, maxScore: 100 });

    const unattempted = createPastPaper(
      db,
      moduleId,
      paper({ title: "x", minutesTaken: "90", attemptedAt: "2026-01-01" }),
    );
    expect(unattempted).toMatchObject({
      attempted: false,
      minutesTaken: null,
      attemptedAt: null,
      score: null,
    });

    const updated = updatePastPaper(
      db,
      unattempted.id,
      paper({
        title: "x",
        attempted: "on",
        score: "30",
        maxScore: "50",
        minutesTaken: "120",
        attemptedAt: "2026-02-02",
      }),
    );
    expect(updated).toMatchObject({
      attempted: true,
      score: 30,
      maxScore: 50,
      minutesTaken: 120,
      attemptedAt: "2026-02-02",
    });
    expect(() => updatePastPaper(db, 999, paper())).toThrow(NotFoundError);
    expect(() => createPastPaper(db, 9999, paper())).toThrow(NotFoundError);
  });

  it("feeds module readiness", () => {
    const settings = { readinessChapterWeight: 0.7 };
    expect(
      loadModuleProgress(db, [moduleId], settings).get(moduleId)!.pastPaperProgress,
    ).toBeNull();
    createPastPaper(db, moduleId, paper({ title: "a", score: "80", maxScore: "100" }));
    createPastPaper(db, moduleId, paper({ title: "b" }));
    // coverage 1/2 x score 0.8
    expect(
      loadModuleProgress(db, [moduleId], settings).get(moduleId)!.pastPaperProgress,
    ).toBeCloseTo(0.4);
  });
});

// ---- files -------------------------------------------------------------------------------------

describe("files on assessments and past papers", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
  function attach(
    ownerType: "assessment" | "past_paper",
    ownerId: number,
    kind: "past_paper" | "marking_scheme" | "other",
  ) {
    const saved = saveUpload(root, ownerType, ownerId, { name: "f.pdf", bytes: PDF });
    createAttachment(db, {
      ownerType,
      ownerId,
      kind,
      path: saved.path,
      originalName: "f.pdf",
      mime: saved.mime,
      size: saved.size,
    });
    return saved.path;
  }

  it("deleting an assessment removes its files and nothing else", () => {
    const a = createAssessment(db, moduleId, assessment({ name: "A" }));
    const b = createAssessment(db, moduleId, assessment({ name: "B" }));
    const pathA = attach("assessment", a.id, "other");
    const pathB = attach("assessment", b.id, "other");

    const { files } = deleteAssessment(db, a.id);
    expect(files).toEqual([pathA]);
    deleteStored(root, files);
    expect(fs.existsSync(path.join(root, pathA))).toBe(false);
    expect(fs.existsSync(path.join(root, pathB))).toBe(true);
    expect(listAttachments(db, "assessment", b.id)).toHaveLength(1);
    expect(() => deleteAssessment(db, a.id)).toThrow(NotFoundError);
  });

  it("deleting a past paper removes the paper and its marking scheme", () => {
    const p = createPastPaper(db, moduleId, paper());
    const paperFile = attach("past_paper", p.id, "past_paper");
    const scheme = attach("past_paper", p.id, "marking_scheme");
    expect(getPastPaperDeleteImpact(db, p.id)).toEqual({ files: 2 });

    const { files } = deletePastPaper(db, p.id);
    expect(files.sort()).toEqual([paperFile, scheme].sort());
    deleteStored(root, files);
    expect(fs.readdirSync(root)).toEqual([]);
    expect(db.select().from(attachments).all()).toHaveLength(0);
  });

  it("deleting a module removes its assessments' and past papers' rows, tags and files", () => {
    const a = createAssessment(db, moduleId, assessment({ newTags: "online" }));
    const p = createPastPaper(db, moduleId, paper());
    attach("assessment", a.id, "other");
    attach("past_paper", p.id, "past_paper");

    const { files } = deleteModule(db, moduleId);
    expect(files).toHaveLength(2);
    expect(db.select().from(assessments).all()).toHaveLength(0);
    expect(db.select().from(tags).all()).toHaveLength(0);
    expect(db.select().from(assessmentTags).all()).toHaveLength(0);
    expect(db.select().from(attachments).all()).toHaveLength(0);
  });
});
