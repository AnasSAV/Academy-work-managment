import { asc, desc, eq, sql } from "drizzle-orm";
import { normalizePastPaper } from "@/lib/assessments";
import type { PastPaperInput } from "@/lib/validation/schemas";
import { attachmentsForOwners, deleteAttachmentsForOwners } from "./attachments";
import { NotFoundError } from "./errors";
import type { Db } from "./index";
import { modules, pastPapers } from "./schema";

export function listPastPapers(db: Db, moduleId: number) {
  // Newest year first; papers without a year go last.
  return db
    .select()
    .from(pastPapers)
    .where(eq(pastPapers.moduleId, moduleId))
    .orderBy(sql`${pastPapers.year} IS NULL`, desc(pastPapers.year), asc(pastPapers.id))
    .all();
}

function columnsFrom(input: PastPaperInput) {
  const n = normalizePastPaper(input);
  return {
    title: n.title,
    year: n.year,
    attempted: n.attempted,
    score: n.score,
    maxScore: n.maxScore,
    minutesTaken: n.minutesTaken,
    attemptedAt: n.attemptedAt,
    notes: n.notes,
  };
}

export function createPastPaper(db: Db, moduleId: number, input: PastPaperInput) {
  if (!db.select().from(modules).where(eq(modules.id, moduleId)).get()) {
    throw new NotFoundError("Module");
  }
  return db
    .insert(pastPapers)
    .values({ ...columnsFrom(input), moduleId })
    .returning()
    .get();
}

export function updatePastPaper(db: Db, id: number, input: PastPaperInput) {
  const row = db
    .update(pastPapers)
    .set(columnsFrom(input))
    .where(eq(pastPapers.id, id))
    .returning()
    .get();
  if (!row) throw new NotFoundError("Past paper");
  return row;
}

/** Delete a past paper and its file rows; the returned `files` must then be removed from disk. */
export function deletePastPaper(db: Db, id: number) {
  const row = db.select().from(pastPapers).where(eq(pastPapers.id, id)).get();
  if (!row) throw new NotFoundError("Past paper");
  const files = db.transaction((tx) => {
    const paths = deleteAttachmentsForOwners(tx as unknown as Db, [{ type: "past_paper", id }]);
    tx.delete(pastPapers).where(eq(pastPapers.id, id)).run();
    return paths;
  });
  return { pastPaper: row, files };
}

export function getPastPaperDeleteImpact(db: Db, id: number) {
  return { files: attachmentsForOwners(db, [{ type: "past_paper", id }]).length };
}
