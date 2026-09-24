import { asc, eq, inArray } from "drizzle-orm";
import { chapterProgress, meanProgress, moduleReadiness, pastPaperProgress } from "@/lib/progress";
import type { Db } from "./index";
import {
  activityTypes,
  chapterActivities,
  chapters,
  pastPapers,
  type ActivityType,
  type Chapter,
  type ChapterActivity,
} from "./schema";
import type { AppSettings } from "./settings";

export interface ChapterWithProgress {
  chapter: Chapter;
  /** 0 to 1. */
  progress: number;
  /** Activity rows by activity type id; a missing entry means "not done". */
  states: Map<number, ChapterActivity>;
}

export interface ModuleProgress {
  types: ActivityType[];
  chapters: ChapterWithProgress[];
  /** Mean of chapter progress, 0 to 1. */
  chapterProgress: number;
  /** null when no past papers are logged. */
  pastPaperProgress: number | null;
  readiness: number;
}

/** Load activity, chapter and past-paper data for the given modules and compute their progress. */
export function loadModuleProgress(
  db: Db,
  moduleIds: number[],
  settings: Pick<AppSettings, "readinessChapterWeight">,
): Map<number, ModuleProgress> {
  const result = new Map<number, ModuleProgress>();
  if (moduleIds.length === 0) return result;

  const types = db
    .select()
    .from(activityTypes)
    .where(inArray(activityTypes.moduleId, moduleIds))
    .orderBy(asc(activityTypes.position), asc(activityTypes.id))
    .all();
  const chapterRows = db
    .select()
    .from(chapters)
    .where(inArray(chapters.moduleId, moduleIds))
    .orderBy(asc(chapters.position), asc(chapters.id))
    .all();
  const activityRows = db
    .select({ activity: chapterActivities })
    .from(chapterActivities)
    .innerJoin(chapters, eq(chapters.id, chapterActivities.chapterId))
    .where(inArray(chapters.moduleId, moduleIds))
    .all()
    .map((r) => r.activity);
  const paperRows = db
    .select()
    .from(pastPapers)
    .where(inArray(pastPapers.moduleId, moduleIds))
    .all();

  for (const moduleId of moduleIds) {
    const moduleTypes = types.filter((t) => t.moduleId === moduleId);
    const chapterList = chapterRows
      .filter((c) => c.moduleId === moduleId)
      .map((chapter): ChapterWithProgress => {
        const states = new Map(
          activityRows.filter((a) => a.chapterId === chapter.id).map((a) => [a.activityTypeId, a]),
        );
        return {
          chapter,
          states,
          progress: chapterProgress(moduleTypes, [...states.values()]),
        };
      });

    const chapters = meanProgress(chapterList.map((c) => c.progress));
    const papers = pastPaperProgress(paperRows.filter((p) => p.moduleId === moduleId));
    result.set(moduleId, {
      types: moduleTypes,
      chapters: chapterList,
      chapterProgress: chapters,
      pastPaperProgress: papers,
      readiness: moduleReadiness({
        chapters,
        hasChapters: chapterList.length > 0,
        pastPapers: papers,
        chapterWeight: settings.readinessChapterWeight,
      }),
    });
  }
  return result;
}
