import Link from "next/link";
import { getDb } from "@/db";
import { loadSemesterDashboard } from "@/db/dashboard-queries";
import { listNav } from "@/db/queries";
import { getSettings } from "@/db/settings";
import { todayISO } from "@/lib/dates";
import { HEAT_LABELS, heatLevel, pickCurrentSemester } from "@/lib/dashboard";
import { formatDateRange, pluralize } from "@/lib/format";
import { toPercent } from "@/lib/progress";
import { FilterChip } from "@/components/filter-chip";
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
  const semesters = listNav(db);

  if (semesters.length === 0) {
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

  const requested = Number(single(query.semester));
  const semester =
    semesters.find((s) => s.id === requested) ?? pickCurrentSemester(semesters, todayISO())!;
  const data = loadSemesterDashboard(db, semester, getSettings(db));
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

      {semesters.length > 1 && (
        <nav aria-label="Semester" className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 text-xs">Semester</span>
          {semesters.map((s) => (
            <FilterChip key={s.id} href={`/?semester=${s.id}`} active={s.id === semester.id}>
              {s.name}
            </FilterChip>
          ))}
        </nav>
      )}

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
