import { asc, count, eq, inArray } from "drizzle-orm";
import { normalizeAssessment } from "@/lib/assessments";
import type { AssessmentInput, TagInput } from "@/lib/validation/schemas";
import { attachmentsForOwners, deleteAttachmentsForOwners } from "./attachments";
import { NotFoundError, RuleError } from "./errors";
import type { Db } from "./index";
import { moveRow, nextPosition } from "./ordering";
import { assessmentTags, assessments, modules, tags, type Assessment, type Tag } from "./schema";

export interface AssessmentWithTags extends Assessment {
  tags: Tag[];
}

// ---- tags --------------------------------------------------------------------------------------

export interface TagWithUsage extends Tag {
  /** How many assessments use this tag. */
  usage: number;
}

export function listTags(db: Db, moduleId: number): TagWithUsage[] {
  const rows = db
    .select()
    .from(tags)
    .where(eq(tags.moduleId, moduleId))
    .orderBy(asc(tags.name), asc(tags.id))
    .all();
  const usage = new Map(
    db
      .select({ tagId: assessmentTags.tagId, n: count() })
      .from(assessmentTags)
      .innerJoin(tags, eq(tags.id, assessmentTags.tagId))
      .where(eq(tags.moduleId, moduleId))
      .groupBy(assessmentTags.tagId)
      .all()
      .map((r) => [r.tagId, r.n]),
  );
  return rows.map((t) => ({ ...t, usage: usage.get(t.id) ?? 0 }));
}

function assertTagNameFree(db: Db, moduleId: number, name: string, exceptId?: number) {
  const clash = db
    .select()
    .from(tags)
    .where(eq(tags.moduleId, moduleId))
    .all()
    .find((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== exceptId);
  if (clash) throw new RuleError(`A tag called "${clash.name}" already exists in this module`);
}

export function createTag(db: Db, moduleId: number, input: TagInput) {
  if (!db.select().from(modules).where(eq(modules.id, moduleId)).get()) {
    throw new NotFoundError("Module");
  }
  assertTagNameFree(db, moduleId, input.name);
  return db
    .insert(tags)
    .values({ moduleId, name: input.name, description: input.description })
    .returning()
    .get();
}

export function updateTag(db: Db, id: number, input: TagInput) {
  const tag = db.select().from(tags).where(eq(tags.id, id)).get();
  if (!tag) throw new NotFoundError("Tag");
  assertTagNameFree(db, tag.moduleId, input.name, id);
  return db
    .update(tags)
    .set({ name: input.name, description: input.description })
    .where(eq(tags.id, id))
    .returning()
    .get();
}

/** Removes the tag from every assessment that uses it; the assessments themselves stay. */
export function deleteTag(db: Db, id: number) {
  if (!db.select().from(tags).where(eq(tags.id, id)).get()) throw new NotFoundError("Tag");
  db.delete(tags).where(eq(tags.id, id)).run();
}

export function getTagDeleteImpact(db: Db, id: number) {
  return {
    assessments: db
      .select({ n: count() })
      .from(assessmentTags)
      .where(eq(assessmentTags.tagId, id))
      .get()!.n,
  };
}

/**
 * Turn ticked tag ids plus typed-in new names into a set of tag ids for a module. Ids must belong
 * to the module; new names reuse an existing tag with the same name (any case) or create one.
 */
function resolveTagIds(db: Db, moduleId: number, tagIds: number[], newNames: string[]): number[] {
  const moduleTags = db.select().from(tags).where(eq(tags.moduleId, moduleId)).all();
  const valid = new Set(moduleTags.map((t) => t.id));
  if (tagIds.some((id) => !valid.has(id)))
    throw new RuleError("One of the selected tags no longer exists");

  const ids = new Set(tagIds);
  const byName = new Map(moduleTags.map((t) => [t.name.toLowerCase(), t.id]));
  for (const name of newNames) {
    const key = name.toLowerCase();
    let id = byName.get(key);
    if (id === undefined) {
      id = db.insert(tags).values({ moduleId, name }).returning().get().id;
      byName.set(key, id);
    }
    ids.add(id);
  }
  return [...ids];
}

// ---- assessments -------------------------------------------------------------------------------

export function listAssessments(db: Db, moduleId: number): AssessmentWithTags[] {
  const rows = db
    .select()
    .from(assessments)
    .where(eq(assessments.moduleId, moduleId))
    .orderBy(asc(assessments.position), asc(assessments.id))
    .all();
  if (rows.length === 0) return [];

  const links = db
    .select({ assessmentId: assessmentTags.assessmentId, tag: tags })
    .from(assessmentTags)
    .innerJoin(tags, eq(tags.id, assessmentTags.tagId))
    .where(
      inArray(
        assessmentTags.assessmentId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(tags.name))
    .all();
  return rows.map((a) => ({
    ...a,
    tags: links.filter((l) => l.assessmentId === a.id).map((l) => l.tag),
  }));
}

function columnsFrom(input: AssessmentInput) {
  const n = normalizeAssessment(input);
  return {
    name: n.name,
    lecturer: n.lecturer,
    weight: n.weight,
    dueDate: n.dueDate,
    status: n.status,
    score: n.score,
    maxScore: n.maxScore,
    workMode: n.workMode,
    groupSize: n.groupSize,
    groupMembers: n.groupMembers,
    notes: n.notes,
  };
}

export function createAssessment(db: Db, moduleId: number, input: AssessmentInput) {
  if (!db.select().from(modules).where(eq(modules.id, moduleId)).get()) {
    throw new NotFoundError("Module");
  }
  return db.transaction((tx) => {
    const t = tx as unknown as Db;
    const row = tx
      .insert(assessments)
      .values({
        ...columnsFrom(input),
        moduleId,
        position: nextPosition(t, assessments, eq(assessments.moduleId, moduleId)),
      })
      .returning()
      .get();
    const tagIds = resolveTagIds(t, moduleId, input.tagIds, input.newTags);
    if (tagIds.length > 0) {
      tx.insert(assessmentTags)
        .values(tagIds.map((tagId) => ({ assessmentId: row.id, tagId })))
        .run();
    }
    return row;
  });
}

export function updateAssessment(db: Db, id: number, input: AssessmentInput) {
  const existing = db.select().from(assessments).where(eq(assessments.id, id)).get();
  if (!existing) throw new NotFoundError("Assessment");
  return db.transaction((tx) => {
    const t = tx as unknown as Db;
    const row = tx
      .update(assessments)
      .set(columnsFrom(input))
      .where(eq(assessments.id, id))
      .returning()
      .get();
    const tagIds = resolveTagIds(t, existing.moduleId, input.tagIds, input.newTags);
    tx.delete(assessmentTags).where(eq(assessmentTags.assessmentId, id)).run();
    if (tagIds.length > 0) {
      tx.insert(assessmentTags)
        .values(tagIds.map((tagId) => ({ assessmentId: id, tagId })))
        .run();
    }
    return row;
  });
}

/** Delete an assessment and its file rows; the returned `files` must then be removed from disk. */
export function deleteAssessment(db: Db, id: number) {
  const row = db.select().from(assessments).where(eq(assessments.id, id)).get();
  if (!row) throw new NotFoundError("Assessment");
  const files = db.transaction((tx) => {
    const paths = deleteAttachmentsForOwners(tx as unknown as Db, [{ type: "assessment", id }]);
    tx.delete(assessments).where(eq(assessments.id, id)).run();
    return paths;
  });
  return { assessment: row, files };
}

export function moveAssessment(db: Db, id: number, direction: "up" | "down") {
  const row = db.select().from(assessments).where(eq(assessments.id, id)).get();
  if (!row) throw new NotFoundError("Assessment");
  return moveRow(db, assessments, eq(assessments.moduleId, row.moduleId), id, direction);
}

export function getAssessmentDeleteImpact(db: Db, id: number) {
  return { files: attachmentsForOwners(db, [{ type: "assessment", id }]).length };
}
