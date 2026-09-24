import { asc, eq } from "drizzle-orm";
import { daysBetween } from "@/lib/dates";
import {
  attention,
  boardStatus,
  datedItems,
  revisionDue,
  type Attention,
  type BoardStatus,
  type ChapterSignals,
  type DatedItem,
  type RevisionInfo,
} from "@/lib/study";
import { listAssessments } from "./assessments";
import type { Db } from "./index";
import { loadModuleProgress } from "./progress-queries";
import { modules, type Semester } from "./schema";
import type { AppSettings } from "./settings";

export interface StudyChapter {
  chapterId: number;
  title: string;
  moduleId: number;
  moduleName: string;
  moduleColor: string;
  /** 0 to 1. */
  progress: number;
  status: BoardStatus;
  confidence: number | null;
  lastReviewedAt: string | null;
  revision: RevisionInfo | null;
  attention: Attention | null;
  /** The module's Learned activity, so the board can tick it. */
  learnedTypeId: number | null;
}

export interface StudyData {
  chapters: StudyChapter[];
  /** Assessment due dates and exams for the semester, oldest first. */
  items: DatedItem[];
}

/**
 * Everything the board, calendar and review pages need for one semester. Built from the same
 * progress loader as the rest of the app, so a chapter's status and percentage always agree.
 */
export function loadStudy(
  db: Db,
  semester: Pick<Semester, "id">,
  settings: Pick<AppSettings, "readinessChapterWeight" | "reviseAfterDays">,
  today: string,
): StudyData {
  const moduleRows = db
    .select()
    .from(modules)
    .where(eq(modules.semesterId, semester.id))
    .orderBy(asc(modules.position), asc(modules.id))
    .all();
  const progress = loadModuleProgress(
    db,
    moduleRows.map((m) => m.id),
    settings,
  );

  const chapters: StudyChapter[] = [];
  for (const m of moduleRows) {
    const p = progress.get(m.id)!;
    const learnedType = p.types.find((t) => t.key === "learned") ?? null;
    const revisedType = p.types.find((t) => t.key === "revised") ?? null;
    const moduleStarted = p.chapters.some((c) => c.progress > 0);
    const examDays = m.examDate ? daysBetween(today, m.examDate) : null;
    const examInDays = examDays !== null && examDays >= 0 ? examDays : null;

    for (const c of p.chapters) {
      const learnedState = learnedType ? c.states.get(learnedType.id) : undefined;
      const revisedState = revisedType ? c.states.get(revisedType.id) : undefined;
      const signals: ChapterSignals = {
        progress: c.progress,
        learned: learnedState?.done ?? false,
        learnedAt: learnedState?.doneAt ?? null,
        revised: revisedState?.done ?? false,
        revisionCount: revisedState?.revisionCount ?? 0,
        confidence: c.chapter.confidence,
        lastReviewedAt: c.chapter.lastReviewedAt,
      };
      const revision = revisionDue(signals, settings.reviseAfterDays, today);
      chapters.push({
        chapterId: c.chapter.id,
        title: c.chapter.title,
        moduleId: m.id,
        moduleName: m.name,
        moduleColor: m.color,
        progress: c.progress,
        status: boardStatus(signals),
        confidence: c.chapter.confidence,
        lastReviewedAt: c.chapter.lastReviewedAt,
        revision,
        attention: attention({
          confidence: signals.confidence,
          progress: c.progress,
          revision,
          moduleStarted,
          examInDays,
        }),
        learnedTypeId: learnedType?.id ?? null,
      });
    }
  }

  const assessmentRows = moduleRows.flatMap((m) => listAssessments(db, m.id));
  return { chapters, items: datedItems(assessmentRows, moduleRows, today) };
}
