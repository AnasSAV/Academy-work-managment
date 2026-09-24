import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { NotFoundError } from "./errors";
import type { Db } from "./index";
import {
  assessments,
  attachments,
  chapters,
  modules,
  pastPapers,
  semesters,
  type Attachment,
} from "./schema";

export type OwnerType = Attachment["ownerType"];
export type OwnerRef = { type: OwnerType; id: number };

/** Where an attachment's owner lives in the app, for labels and links. */
export function describeOwner(
  db: Db,
  type: OwnerType,
  id: number,
): { label: string; href: string } | null {
  switch (type) {
    case "semester": {
      const s = db.select().from(semesters).where(eq(semesters.id, id)).get();
      return s ? { label: s.name, href: `/semesters/${s.id}` } : null;
    }
    case "module": {
      const m = db.select().from(modules).where(eq(modules.id, id)).get();
      return m ? { label: m.name, href: `/modules/${m.id}` } : null;
    }
    case "chapter": {
      const c = db.select().from(chapters).where(eq(chapters.id, id)).get();
      return c ? { label: c.title, href: `/chapters/${c.id}` } : null;
    }
    case "assessment": {
      const a = db.select().from(assessments).where(eq(assessments.id, id)).get();
      return a ? { label: a.name, href: `/modules/${a.moduleId}` } : null;
    }
    case "past_paper": {
      const p = db.select().from(pastPapers).where(eq(pastPapers.id, id)).get();
      return p ? { label: p.title, href: `/modules/${p.moduleId}` } : null;
    }
  }
}

export function ownerExists(db: Db, type: OwnerType, id: number): boolean {
  return describeOwner(db, type, id) !== null;
}

export function createAttachment(db: Db, values: typeof attachments.$inferInsert) {
  if (!ownerExists(db, values.ownerType, values.ownerId)) throw new NotFoundError("Owner");
  return db.insert(attachments).values(values).returning().get();
}

export function getAttachment(db: Db, id: number) {
  return db.select().from(attachments).where(eq(attachments.id, id)).get();
}

export function listAttachments(db: Db, ownerType: OwnerType, ownerId: number) {
  return db
    .select()
    .from(attachments)
    .where(and(eq(attachments.ownerType, ownerType), eq(attachments.ownerId, ownerId)))
    .orderBy(asc(attachments.kind), desc(attachments.createdAt), desc(attachments.id))
    .all();
}

/** Delete one attachment row. The caller removes the file (see `deleteStored`). */
export function deleteAttachment(db: Db, id: number): Attachment {
  const row = getAttachment(db, id);
  if (!row) throw new NotFoundError("File");
  db.delete(attachments).where(eq(attachments.id, id)).run();
  return row;
}

// ---- owner subtrees -----------------------------------------------------------------------------

function ownersUnderModules(db: Db, moduleIds: number[]): OwnerRef[] {
  if (moduleIds.length === 0) return [];
  const ids = (rows: { id: number }[]) => rows.map((r) => r.id);
  return [
    ...moduleIds.map((id) => ({ type: "module" as const, id })),
    ...ids(
      db
        .select({ id: chapters.id })
        .from(chapters)
        .where(inArray(chapters.moduleId, moduleIds))
        .all(),
    ).map((id) => ({ type: "chapter" as const, id })),
    ...ids(
      db
        .select({ id: assessments.id })
        .from(assessments)
        .where(inArray(assessments.moduleId, moduleIds))
        .all(),
    ).map((id) => ({ type: "assessment" as const, id })),
    ...ids(
      db
        .select({ id: pastPapers.id })
        .from(pastPapers)
        .where(inArray(pastPapers.moduleId, moduleIds))
        .all(),
    ).map((id) => ({ type: "past_paper" as const, id })),
  ];
}

/** The semester and everything that would be deleted with it. */
export function ownersUnderSemester(db: Db, semesterId: number): OwnerRef[] {
  const moduleIds = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.semesterId, semesterId))
    .all()
    .map((m) => m.id);
  return [{ type: "semester", id: semesterId }, ...ownersUnderModules(db, moduleIds)];
}

export function ownersUnderModule(db: Db, moduleId: number): OwnerRef[] {
  return ownersUnderModules(db, [moduleId]);
}

export function attachmentsForOwners(db: Db, owners: OwnerRef[]): Attachment[] {
  if (owners.length === 0) return [];
  const byType = new Map<OwnerType, number[]>();
  for (const o of owners) byType.set(o.type, [...(byType.get(o.type) ?? []), o.id]);
  const conditions = [...byType].map(([type, ids]) =>
    and(eq(attachments.ownerType, type), inArray(attachments.ownerId, ids)),
  );
  return db
    .select()
    .from(attachments)
    .where(or(...conditions))
    .all();
}

/** Delete the attachment rows of these owners and return the stored paths to remove from disk. */
export function deleteAttachmentsForOwners(db: Db, owners: OwnerRef[]): string[] {
  const rows = attachmentsForOwners(db, owners);
  if (rows.length > 0) {
    db.delete(attachments)
      .where(
        inArray(
          attachments.id,
          rows.map((r) => r.id),
        ),
      )
      .run();
  }
  return rows.map((r) => r.path);
}
