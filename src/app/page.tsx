import Link from "next/link";
import { getDb } from "@/db";
import { loadSemesterDashboard } from "@/db/dashboard-queries";
import { selectSemester } from "@/db/queries";
import { loadStudy } from "@/db/study-queries";
import { getSettings } from "@/db/settings";
import { todayISO } from "@/lib/dates";
import { HEAT_LABELS, heatLevel } from "@/lib/dashboard";
import { upcomingItems } from "@/lib/study";
import { formatDateRange, pluralize } from "@/lib/format";
import { toPercent } from "@/lib/progress";
import { AttentionList } from "@/components/attention-list";
import { DeadlineList } from "@/components/deadline-list";
import { SemesterChips } from "@/components/semester-chips";
import { SemesterDialog } from "@/components/semester-dialog";
import { StarterDataButton } from "@/components/starter-data-button";
import { BarList } from "@/components/viz/bar-list";
import { ChartCard, StatTile, TableView } from "@/components/viz/chart-card";
import { Heatmap, HeatLegend, type HeatRow } from "@/components/viz/heatmap";
import { ProgressRing } from "@/components/viz/progress-ring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Dashboard(props: PageProps<"/">) {
  const query = await props.searchParams;
  const db = getDb();
  const today = todayISO();
  const requested = Number(single(query.semester));
  const { semesters, current } = selectSemester(
    db,
    Number.isInteger(requested) ? requested : null,
    today,
  );

  if (!current) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Card>
          <CardHeader>
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>
              Start from your Semester 07 setup (six modules and the Computer Networks and Security
              chapters), or create an empty semester.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <StarterDataButton />
            <SemesterDialog />
          </CardContent>
        </Card>
      </div>
    );
  }

  const semester = current;
  const settings = getSettings(db);
  const data = loadSemesterDashboard(db, semester, settings);
  const study = loadStudy(db, semester, settings, today);
  const upcoming = upcomingItems(study.items).slice(0, 5);
  const attention = study.chapters
    .filter((c) => c.attention)
    .sort((a, b) => b.attention!.score - a.attention!.score)
    .slice(0, 5);
  const { totals } = data;
  const dates = formatDateRange(semester.startDate, semester.endDate);

  const heatRows: HeatRow[] = data.modules.map(({ module: m, progress }) => ({
    key: m.id,
    label: m.name,
    color: m.color,
    href: `/modules/${m.id}`,
    cells: progress.chapters.map(({ chapter, progress: p, states }) => {
      const done = progress.types.filter((t) => states.get(t.id)?.done).map((t) => t.label);
      return {
        key: chapter.id,
        title: chapter.title,
        progress: p,
        href: `/chapters/${chapter.id}`,
        detail: done.length > 0 ? `Done: ${done.join(", ")}` : "Nothing ticked yet",
      };
    }),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {[semester.name, dates, pluralize(data.modules.length, "module")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/semesters/${semester.id}`}
            className="hover:bg-muted rounded-lg border px-2.5 py-1.5 text-sm"
          >
            Manage semester
          </Link>
          <SemesterDialog />
        </div>
      </header>

      <SemesterChips semesters={semesters} currentId={semester.id} basePath="/" />

      <section
        aria-labelledby="completion-heading"
        className="bg-card flex flex-wrap items-center gap-x-10 gap-y-6 rounded-xl border p-5"
      >
        <ProgressRing value={data.completion} label="Semester completion" />
        <div className="min-w-64 flex-1 space-y-4">
          <div className="space-y-1">
            <h2 id="completion-heading" className="text-base font-medium">
              Semester completion
            </h2>
            <p className="text-muted-foreground text-sm">
              The average readiness of your modules. Each module blends its chapters and past
              papers.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Chapters complete"
              value={`${totals.chaptersComplete} of ${totals.chapters}`}
            />
            <StatTile
              label="Past papers attempted"
              value={`${totals.papersAttempted} of ${totals.papersTotal}`}
            />
            <StatTile
              label="Components graded"
              value={`${totals.assessmentsGraded} of ${totals.assessmentsTotal}`}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="upcoming-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="upcoming-heading" className="text-base font-medium">
              Coming up
            </h2>
            <Link href="/calendar" className="text-muted-foreground text-sm hover:underline">
              Calendar
            </Link>
          </div>
          <DeadlineList
            items={upcoming}
            ariaLabel="Coming up"
            emptyText="No upcoming deadlines or exams. Add a due date to an assessment, or an exam date to a module."
          />
        </section>
        <section aria-labelledby="attention-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="attention-heading" className="text-base font-medium">
              Needs attention
            </h2>
            <Link href="/review" className="text-muted-foreground text-sm hover:underline">
              Review
            </Link>
          </div>
          <AttentionList
            chapters={attention}
            emptyText="All clear. Nothing needs attention right now."
          />
        </section>
      </div>

      {data.modules.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          This semester has no modules yet.{" "}
          <Link href={`/semesters/${semester.id}`} className="underline">
            Add one
          </Link>{" "}
          to see progress here.
        </p>
      ) : (
        <>
          <ChartCard
            title="Module readiness"
            description="Chapters and past papers combined, using the split in Settings."
            footer={
              <TableView
                caption="Module readiness"
                columns={[
                  "Module",
                  "Readiness",
                  "Chapters",
                  "Past papers",
                  "Chapters complete",
                  "Papers attempted",
                  "Components graded",
                ]}
                rows={data.modules.map((r) => [
                  r.module.name,
                  `${toPercent(r.progress.readiness)}%`,
                  `${toPercent(r.progress.chapterProgress)}%`,
                  r.progress.pastPaperProgress === null
                    ? "none logged"
                    : `${toPercent(r.progress.pastPaperProgress)}%`,
                  `${r.chaptersComplete} of ${r.progress.chapters.length}`,
                  `${r.papers.attempted} of ${r.papers.total}`,
                  `${r.assessments.graded} of ${r.assessments.total}`,
                ])}
              />
            }
          >
            <BarList
              ariaLabel="Readiness by module"
              rows={data.modules.map((r) => ({
                key: r.module.id,
                label: r.module.name,
                value: r.progress.readiness,
                color: r.module.color,
                dot: true,
                href: `/modules/${r.module.id}`,
                sub: `Chapters ${toPercent(r.progress.chapterProgress)}% · Past papers ${
                  r.progress.pastPaperProgress === null
                    ? "none yet"
                    : `${toPercent(r.progress.pastPaperProgress)}%`
                }`,
                detail: `${r.chaptersComplete} of ${r.progress.chapters.length} chapters complete`,
              }))}
            />
          </ChartCard>

          <ChartCard
            title="Chapter progress"
            description="One square per chapter. Darker means further along. Click a square to open the chapter."
            footer={
              <TableView
                caption="Chapter progress by module"
                columns={["Module", "Chapter", "Progress", "Stage"]}
                rows={data.modules.flatMap((r) =>
                  r.progress.chapters.map((c) => [
                    r.module.name,
                    c.chapter.title,
                    `${toPercent(c.progress)}%`,
                    HEAT_LABELS[heatLevel(c.progress)],
                  ]),
                )}
              />
            }
          >
            <Heatmap rows={heatRows} />
            <HeatLegend />
          </ChartCard>
        </>
      )}
    </div>
  );
}
