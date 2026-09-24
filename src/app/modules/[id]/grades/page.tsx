import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { listAssessments } from "@/db/assessments";
import { STATUS_LABELS, weightSummary } from "@/lib/assessments";
import {
  formatPercent,
  itemPercent,
  summarizeGrades,
  targetStatus,
  type GradeItem,
} from "@/lib/grades";
import { TargetMessage } from "@/components/target-message";
import { ChartCard, StatTile, TableView } from "@/components/viz/chart-card";
import { StackedBar } from "@/components/viz/stacked-bar";
import { WhatIfCalculator } from "@/components/what-if-calculator";
import { loadModuleOr404 } from "../load-module";

export async function generateMetadata(
  props: PageProps<"/modules/[id]/grades">,
): Promise<Metadata> {
  const { module: mod } = await loadModuleOr404(props.params);
  return { title: `${mod.name} · Grades` };
}

const points = (n: number) => `${Math.round(n * 100) / 100}`;

export default async function GradesPage(props: PageProps<"/modules/[id]/grades">) {
  const { module: mod } = await loadModuleOr404(props.params);
  const assessments = listAssessments(getDb(), mod.id);

  if (assessments.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        No assessments yet. Add them on the{" "}
        <Link href={`/modules/${mod.id}/assessments`} className="underline">
          Assessments tab
        </Link>{" "}
        to see your grade here.
      </p>
    );
  }

  const items: GradeItem[] = assessments.map((a) => ({
    id: a.id,
    name: a.name,
    weight: a.weight,
    score: a.score,
    maxScore: a.maxScore,
  }));
  const summary = summarizeGrades(items);
  const status = targetStatus(summary, mod.targetGrade);
  const weights = weightSummary(items);

  const segments = [
    {
      key: "earned",
      label: "Earned so far",
      value: summary.earned,
      color: "var(--viz-ramp-4)",
      detail: `${summary.gradedCount} graded ${summary.gradedCount === 1 ? "component" : "components"}`,
    },
    {
      key: "lost",
      label: "Dropped on graded work",
      value: summary.lost,
      color: "var(--viz-axis)",
      detail: "Marks lost on components already graded",
    },
    {
      key: "available",
      label: "Still to be graded",
      value: summary.outstanding,
      color: "var(--viz-ramp-2)",
      detail: `${summary.outstandingCount} ${summary.outstandingCount === 1 ? "component" : "components"} left`,
    },
    {
      key: "unallocated",
      label: "Not allocated to any component",
      value: summary.unallocated,
      color: "var(--viz-grid)",
      detail: "Cannot be earned until you add an assessment for it",
    },
  ].map((s) => ({ ...s, valueText: `${points(s.value)} of ${points(summary.basis)}` }));

  return (
    <div className="space-y-6">
      {(weights.state === "under" || weights.state === "over") && (
        <div
          role="status"
          className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <p>
            Weights total {formatPercent(weights.total)}, not 100%.{" "}
            {weights.state === "under"
              ? `${formatPercent(weights.remaining)} of the grade is not allocated, so it cannot be earned.`
              : `The grade is measured out of ${formatPercent(weights.total)} so it cannot pass 100%.`}{" "}
            <Link href={`/modules/${mod.id}/assessments`} className="underline">
              Fix the weights
            </Link>
            .
          </p>
        </div>
      )}

      <section aria-labelledby="standing-heading" className="space-y-4">
        <h2 id="standing-heading" className="text-lg font-medium">
          Where you stand
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Grade so far"
            value={formatPercent(summary.gradePercent)}
            detail={`${points(summary.earned)} of ${points(summary.basis)} points earned`}
          />
          <StatTile
            label="Average on graded work"
            value={summary.average === null ? "None yet" : formatPercent(summary.average)}
            detail={
              summary.gradedCount === 0
                ? "Nothing is graded yet"
                : `${summary.gradedCount} ${summary.gradedCount === 1 ? "component" : "components"}, ${formatPercent(summary.gradedWeight)} of the grade`
            }
          />
          <StatTile
            label="Still to come"
            value={formatPercent(summary.outstanding)}
            detail={`${summary.outstandingCount} ${summary.outstandingCount === 1 ? "component" : "components"} left to grade`}
          />
          <StatTile
            label="Best possible"
            value={formatPercent(summary.bestCase)}
            detail={
              summary.atCurrentAverage === null
                ? "With full marks on everything left"
                : `At your current pace: ${formatPercent(summary.atCurrentAverage)}`
            }
          />
        </div>
        <div className="bg-card space-y-3 rounded-xl border p-5">
          <h3 className="text-sm font-medium">
            {mod.targetGrade !== null ? `Target: ${formatPercent(mod.targetGrade)}` : "Target"}
          </h3>
          <TargetMessage status={status} target={mod.targetGrade} summary={summary} />
          {mod.targetGrade === null && (
            <p className="text-muted-foreground text-xs">
              Set a target grade in this module&apos;s Edit dialog, or try one in the calculator
              below.
            </p>
          )}
        </div>
      </section>

      <ChartCard
        title="Where the points stand"
        description="The whole module grade as one bar."
        footer={
          <TableView
            caption="Module grade points"
            columns={["Part", "Points"]}
            rows={segments.map((s) => [s.label, s.valueText])}
          />
        }
      >
        <StackedBar
          segments={segments}
          whole={summary.basis}
          marker={
            mod.targetGrade !== null
              ? {
                  value: (mod.targetGrade / 100) * summary.basis,
                  label: `Target ${formatPercent(mod.targetGrade)}`,
                }
              : null
          }
          ariaLabel={`Module grade: ${segments
            .filter((s) => s.value > 0)
            .map((s) => `${s.label} ${s.valueText}`)
            .join(", ")}`}
        />
      </ChartCard>

      <section aria-labelledby="breakdown-heading" className="space-y-3">
        <h2 id="breakdown-heading" className="text-lg font-medium">
          Component by component
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <caption className="sr-only">
              Every assessment with its weight, status, score and points
            </caption>
            <thead>
              <tr className="text-muted-foreground border-b">
                <th scope="col" className="px-3 py-2 font-medium">
                  Component
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Weight
                </th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Score
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const pct = itemPercent(a);
                return (
                  <tr key={a.id} className="border-b last:border-0">
                    <th scope="row" className="px-3 py-2 font-normal">
                      {a.name}
                    </th>
                    <td className="px-3 py-2 tabular-nums">{formatPercent(a.weight)}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">{STATUS_LABELS[a.status]}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {pct === null
                        ? "not graded"
                        : `${a.score} / ${a.maxScore} (${formatPercent(pct)})`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pct === null
                        ? `up to ${points(a.weight)}`
                        : `${points((a.weight * pct) / 100)} of ${points(a.weight)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ChartCard
        title="What if?"
        description="Try scores on the work that is left. Nothing here is saved."
      >
        <WhatIfCalculator items={items} initialTarget={mod.targetGrade} />
      </ChartCard>
    </div>
  );
}
