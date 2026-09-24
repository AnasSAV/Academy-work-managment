import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { moveModuleAction } from "@/actions/modules";
import { countLabel, formatDate, formatDateRange, pluralize } from "@/lib/format";
import { MODULE_COLORS } from "@/lib/defaults";
import { getDb } from "@/db";
import { getSemester, listModuleSummaries } from "@/db/queries";
import { loadModuleProgress } from "@/db/progress-queries";
import { getSemesterDeleteImpact } from "@/db/services";
import { getSettings } from "@/db/settings";
import { toPercent } from "@/lib/progress";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { DeleteSemesterButton } from "@/components/delete-buttons";
import { ModuleDialog } from "@/components/module-dialog";
import { ProgressBar } from "@/components/progress-bar";
import { MoveButtons } from "@/components/move-buttons";
import { SemesterDialog } from "@/components/semester-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function loadSemester(params: PageProps<"/semesters/[id]">["params"]) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const semester = getSemester(getDb(), id);
  if (!semester) notFound();
  return semester;
}

export async function generateMetadata(props: PageProps<"/semesters/[id]">): Promise<Metadata> {
  const semester = await loadSemester(props.params);
  return { title: semester.name };
}

export default async function SemesterPage(props: PageProps<"/semesters/[id]">) {
  const semester = await loadSemester(props.params);
  const db = getDb();
  const modules = listModuleSummaries(db, semester.id);
  const impact = getSemesterDeleteImpact(db, semester.id);
  const progress = loadModuleProgress(
    db,
    modules.map((m) => m.id),
    getSettings(db),
  );
  const dates = formatDateRange(semester.startDate, semester.endDate);
  const nextColor = MODULE_COLORS[modules.length % MODULE_COLORS.length];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link href="/" className="hover:underline">
            Semesters
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{semester.name}</h1>
            <p className="text-muted-foreground text-sm">
              {[dates, pluralize(modules.length, "module")].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SemesterDialog semester={semester} />
            <DeleteSemesterButton
              id={semester.id}
              name={semester.name}
              impact={[
                countLabel(impact.modules, "module"),
                countLabel(impact.chapters, "chapter"),
                countLabel(impact.assessments, "assessment"),
                countLabel(impact.pastPapers, "past paper"),
                countLabel(impact.files, "file"),
              ]}
            />
          </div>
        </div>
      </header>

      <section aria-labelledby="modules-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="modules-heading" className="text-lg font-medium">
            Modules
          </h2>
          <ModuleDialog semesterId={semester.id} defaultColor={nextColor} />
        </div>

        {modules.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No modules yet</CardTitle>
              <CardDescription>Add the modules you are taking this semester.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {modules.map((m, i) => {
              const details = [
                m.code,
                m.credits != null ? `${m.credits} credits` : null,
                m.targetGrade != null ? `target ${m.targetGrade}%` : null,
                m.examDate ? `exam ${formatDate(m.examDate)}` : null,
              ].filter(Boolean);
              return (
                <li key={m.id}>
                  <Card className="h-full border-l-4" style={{ borderLeftColor: m.color }}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle>
                          <Link href={`/modules/${m.id}`} className="hover:underline">
                            {m.name}
                          </Link>
                        </CardTitle>
                        <MoveButtons
                          label={m.name}
                          onMove={moveModuleAction.bind(null, m.id)}
                          isFirst={i === 0}
                          isLast={i === modules.length - 1}
                        />
                      </div>
                      <CardDescription>{pluralize(m.chapterCount, "chapter")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Readiness</span>
                          <span className="tabular-nums">
                            {toPercent(progress.get(m.id)?.readiness ?? 0)}%
                          </span>
                        </div>
                        <ProgressBar
                          value={progress.get(m.id)?.readiness ?? 0}
                          label={`${m.name} readiness`}
                          color={m.color}
                        />
                      </div>
                      {(details.length > 0 || m.lecturers) && (
                        <div className="text-muted-foreground space-y-1">
                          {details.length > 0 && <p>{details.join(" · ")}</p>}
                          {m.lecturers && <p>Lecturers: {m.lecturers}</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AttachmentsPanel
        ownerType="semester"
        ownerId={semester.id}
        kinds={["other", "notes", "slides"]}
        defaultKind="other"
        description="Timetables, handbooks and anything else for the whole semester."
      />
    </div>
  );
}
