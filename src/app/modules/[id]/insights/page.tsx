import type { Metadata } from "next";
import { getDb } from "@/db";
import { loadModuleInsights } from "@/db/dashboard-queries";
import { getSettings } from "@/db/settings";
import { STATUS_LABELS } from "@/lib/assessments";
import { formatDate, pluralize } from "@/lib/format";
import { toPercent } from "@/lib/progress";
import { BarList } from "@/components/viz/bar-list";
import { ChartCard, StatTile, TableView } from "@/components/viz/chart-card";
import { Donut, type DonutSegment } from "@/components/viz/donut";
import { LineChart } from "@/components/viz/line-chart";
import { loadModuleOr404 } from "../load-module";

export async function generateMetadata(
  props: PageProps<"/modules/[id]/insights">,
): Promise<Metadata> {
  const { module: mod } = await loadModuleOr404(props.params);
  return { title: `${mod.name} · Insights` };
}

const SEGMENT_COLORS: Record<string, string> = {
  graded: "var(--viz-ramp-4)",
  submitted: "var(--viz-ramp-3)",
  in_progress: "var(--viz-ramp-2)",
  not_started: "var(--viz-ramp-1)",
  unallocated: "var(--viz-axis)",
};

const SEGMENT_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  unallocated: "Not yet allocated",
};

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      {children}
    </p>
  );
}

export default async function InsightsPage(props: PageProps<"/modules/[id]/insights">) {
  const { module: mod } = await loadModuleOr404(props.params);
  const db = getDb();
  const insights = loadModuleInsights(db, mod.id, getSettings(db));
  const { activityBars, trend, weights } = insights;
  const chapterCount = insights.progress.chapters.length;

  const donutSegments: DonutSegment[] = weights.segments.map((s) => ({
    key: s.key,
    label: SEGMENT_LABELS[s.key],
    weight: s.weight,
    color: SEGMENT_COLORS[s.key],
  }));

  const linePoints = trend.map((t, i) => ({
    key: t.id,
    label: t.date
      ? (formatDate(t.date) ?? `#${i + 1}`).replace(/ \d{4}$/, "")
      : t.year
        ? String(t.year)
        : `#${i + 1}`,
    value: t.percent,
    title: t.title,
    detail: [t.date ? formatDate(t.date) : null, t.year ? `paper from ${t.year}` : null]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <div className="space-y-6">
      <ChartCard
        title="Activity progress"
        description={
          chapterCount === 0
            ? undefined
            : `How much of each activity is done across ${pluralize(chapterCount, "chapter")}. Partial question counts are included.`
        }
        footer={
          chapterCount > 0 && (
            <TableView
              caption="Activity progress across chapters"
              columns={["Activity", "Progress", "Chapters fully done"]}
              rows={activityBars.map((b) => [
                b.label,
                `${toPercent(b.value)}%`,
                `${b.doneChapters} of ${b.totalChapters}`,
              ])}
            />
          )
        }
      >
        {chapterCount === 0 ? (
          <Empty>Add chapters to see how each activity is progressing.</Empty>
        ) : (
          <BarList
            ariaLabel="Progress by activity"
            rows={activityBars.map((b) => ({
              key: b.typeId,
              label: b.label,
              value: b.value,
              color: mod.color,
              sub: `${b.doneChapters} of ${b.totalChapters} chapters done`,
            }))}
          />
        )}
      </ChartCard>

      <ChartCard
        title="Past-paper scores"
        description={
          trend.length >= 2
            ? "Score on each attempted paper, in the order you sat them."
            : undefined
        }
        footer={
          trend.length > 0 && (
            <TableView
              caption="Past-paper scores"
              columns={["Paper", "Date attempted", "Score"]}
              rows={trend.map((t) => [
                t.title,
                t.date ? (formatDate(t.date) ?? "") : "Not recorded",
                pct(t.percent),
              ])}
            />
          )
        }
      >
        {trend.length === 0 ? (
          <Empty>
            {insights.paperCount === 0
              ? "No past papers yet. Log a paper with its score to start a trend."
              : "None of your past papers has a score yet."}
          </Empty>
        ) : trend.length === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile label={trend[0].title} value={pct(trend[0].percent)} detail="Latest score" />
            <p className="text-muted-foreground self-center text-sm">
              Score a second paper to see how you are trending.
            </p>
          </div>
        ) : (
          <LineChart
            points={linePoints}
            target={mod.targetGrade}
            ariaLabel={`Past-paper scores: ${trend.map((t) => `${t.title} ${pct(t.percent)}`).join(", ")}`}
          />
        )}
      </ChartCard>

      <ChartCard
        title="Assessment weight"
        description="How much of the module grade is already graded, awaiting a grade, or still ahead."
        footer={
          insights.assessmentCount > 0 && (
            <TableView
              caption="Assessment weight by status"
              columns={["Status", "Weight"]}
              rows={weights.segments.map((s) => [SEGMENT_LABELS[s.key], pct(s.weight)])}
            />
          )
        }
      >
        {insights.assessmentCount === 0 ? (
          <Empty>Add assessments to see how the grade is split.</Empty>
        ) : (
          <>
            <Donut
              segments={donutSegments}
              whole={weights.whole}
              ariaLabel={`Assessment weight: ${weights.segments
                .filter((s) => s.weight > 0)
                .map((s) => `${SEGMENT_LABELS[s.key]} ${pct(s.weight)}`)
                .join(", ")}`}
              centerValue={`${toPercent(weights.gradedShare)}%`}
              centerLabel="graded"
            />
            {weights.total > 100 && (
              <p role="status" className="text-sm text-amber-700 dark:text-amber-500">
                Weights total {pct(weights.total)}, which is over 100%. Fix them on the Assessments
                tab.
              </p>
            )}
          </>
        )}
      </ChartCard>
    </div>
  );
}
