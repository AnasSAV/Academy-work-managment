import { asc, eq, inArray } from "drizzle-orm";
import {
  activityBreakdown,
  heatLevel,
  paperTrend,
  weightByStatus,
  type ActivityBar,
  type TrendPoint,
  type WeightBreakdown,
} from "@/lib/dashboard";
import { meanProgress } from "@/lib/progress";
import { listAssessments } from "./assessments";
import type { Db } from "./index";
import { listPastPapers } from "./past-papers";
import { loadModuleProgress, type ModuleProgress } from "./progress-queries";
import { assessments, modules, pastPapers, type Module, type Semester } from "./schema";
import type { AppSettings } from "./settings";

export interface DashboardModule {
  module: Module;
  progress: ModuleProgress;
  /** Chapters whose progress is 100%. */
  chaptersComplete: number;
  papers: { attempted: number; total: number };
  assessments: { graded: number; total: number };
}

export interface SemesterDashboard {
  semester: Semester;
  modules: DashboardModule[];
  /** Mean readiness across the semester's modules, 0 to 1. */
  completion: number;
  totals: {
    chapters: number;
    chaptersComplete: number;
    papersAttempted: number;
    papersTotal: number;
    assessmentsGraded: number;
    assessmentsTotal: number;
  };
}

export function loadSemesterDashboard(
  db: Db,
  semester: Semester,
  settings: Pick<AppSettings, "readinessChapterWeight">,
): SemesterDashboard {
  const moduleRows = db
    .select()
    .from(modules)
    .where(eq(modules.semesterId, semester.id))
    .orderBy(asc(modules.position), asc(modules.id))
    .all();
  const ids = moduleRows.map((m) => m.id);
  const progress = loadModuleProgress(db, ids, settings);

  const papers = ids.length
    ? db.select().from(pastPapers).where(inArray(pastPapers.moduleId, ids)).all()
    : [];
  const assessmentRows = ids.length
    ? db.select().from(assessments).where(inArray(assessments.moduleId, ids)).all()
    : [];

  const rows: DashboardModule[] = moduleRows.map((module) => {
    const p = progress.get(module.id)!;
    const modulePapers = papers.filter((x) => x.moduleId === module.id);
    const moduleAssessments = assessmentRows.filter((x) => x.moduleId === module.id);
    return {
      module,
      progress: p,
      chaptersComplete: p.chapters.filter((c) => heatLevel(c.progress) === 4).length,
      papers: {
        attempted: modulePapers.filter((x) => x.attempted).length,
        total: modulePapers.length,
      },
      assessments: {
        graded: moduleAssessments.filter((x) => x.status === "graded").length,
        total: moduleAssessments.length,
      },
    };
  });

  const sum = (pick: (r: DashboardModule) => number) => rows.reduce((n, r) => n + pick(r), 0);
  return {
    semester,
    modules: rows,
    completion: meanProgress(rows.map((r) => r.progress.readiness)),
    totals: {
      chapters: sum((r) => r.progress.chapters.length),
      chaptersComplete: sum((r) => r.chaptersComplete),
      papersAttempted: sum((r) => r.papers.attempted),
      papersTotal: sum((r) => r.papers.total),
      assessmentsGraded: sum((r) => r.assessments.graded),
      assessmentsTotal: sum((r) => r.assessments.total),
    },
  };
}

export interface ModuleInsights {
  progress: ModuleProgress;
  activityBars: ActivityBar[];
  trend: TrendPoint[];
  paperCount: number;
  weights: WeightBreakdown;
  assessmentCount: number;
}

/** Everything the module Insights tab draws. */
export function loadModuleInsights(
  db: Db,
  moduleId: number,
  settings: Pick<AppSettings, "readinessChapterWeight">,
): ModuleInsights {
  const progress = loadModuleProgress(db, [moduleId], settings).get(moduleId)!;
  const papers = listPastPapers(db, moduleId);
  const items = listAssessments(db, moduleId);
  return {
    progress,
    activityBars: activityBreakdown(progress.types, progress.chapters),
    trend: paperTrend(papers),
    paperCount: papers.length,
    weights: weightByStatus(items),
    assessmentCount: items.length,
  };
}
