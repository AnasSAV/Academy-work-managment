import Link from "next/link";
import { getDb } from "@/db";
import { moduleCounts } from "@/db/queries";
import { loadModuleProgress } from "@/db/progress-queries";
import { getModuleDeleteImpact } from "@/db/services";
import { getSettings } from "@/db/settings";
import { DeleteModuleButton } from "@/components/delete-buttons";
import { ModuleDialog } from "@/components/module-dialog";
import { ModuleTabs } from "@/components/module-tabs";
import { ProgressBar } from "@/components/progress-bar";
import { countLabel, formatDate } from "@/lib/format";
import { toPercent } from "@/lib/progress";
import { loadModuleOr404 } from "./load-module";

/** Header, progress summary and tabs shared by every page of a module. */
export default async function ModuleLayout(props: LayoutProps<"/modules/[id]">) {
  const { module: mod, semester } = await loadModuleOr404(props.params);
  const db = getDb();
  const progress = loadModuleProgress(db, [mod.id], getSettings(db)).get(mod.id)!;
  const impact = getModuleDeleteImpact(db, mod.id);
  const counts = moduleCounts(db, mod.id);

  const details = [
    mod.code,
    mod.credits != null ? `${mod.credits} credits` : null,
    mod.targetGrade != null ? `target ${mod.targetGrade}%` : null,
    mod.examDate ? `exam ${formatDate(mod.examDate)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <nav aria-label="Breadcrumb" className="text-muted-foreground flex gap-1.5 text-sm">
          <Link href="/" className="hover:underline">
            Semesters
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/semesters/${semester.id}`} className="hover:underline">
            {semester.name}
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
              <span
                className="size-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: mod.color }}
                aria-hidden
              />
              {mod.name}
            </h1>
            {details.length > 0 && (
              <p className="text-muted-foreground text-sm">{details.join(" · ")}</p>
            )}
            {mod.lecturers && (
              <p className="text-muted-foreground text-sm">Lecturers: {mod.lecturers}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ModuleDialog existing={mod} semesterId={semester.id} defaultColor={mod.color} />
            <DeleteModuleButton
              id={mod.id}
              name={mod.name}
              impact={[
                countLabel(impact.chapters, "chapter"),
                countLabel(impact.activityRecords, "activity record"),
                countLabel(impact.assessments, "assessment"),
                countLabel(impact.pastPapers, "past paper"),
                countLabel(impact.files, "file"),
              ]}
            />
          </div>
        </div>
        {mod.notes && <p className="text-sm whitespace-pre-line">{mod.notes}</p>}

        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>Chapter progress</span>
              <span className="tabular-nums">{toPercent(progress.chapterProgress)}%</span>
            </div>
            <ProgressBar
              value={progress.chapterProgress}
              label="Chapter progress"
              color={mod.color}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>Readiness</span>
              <span className="tabular-nums">{toPercent(progress.readiness)}%</span>
            </div>
            <ProgressBar value={progress.readiness} label="Readiness" color={mod.color} />
            <p className="text-muted-foreground text-xs">
              {progress.pastPaperProgress === null
                ? "Based on chapters only. Past papers will count once you log some."
                : counts.chapters === 0
                  ? "Based on past papers only. Chapters will count once you add some."
                  : `Chapters and past papers (${toPercent(progress.pastPaperProgress)}%).`}
            </p>
          </div>
        </div>
      </header>

      <ModuleTabs moduleId={mod.id} counts={counts} />

      {props.children}
    </div>
  );
}
