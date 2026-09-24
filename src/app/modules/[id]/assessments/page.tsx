import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { moveAssessmentAction } from "@/actions/assessments";
import { getDb } from "@/db";
import { listAssessments, listTags } from "@/db/assessments";
import { countAttachmentsByOwner } from "@/db/attachments";
import { AssessmentDialog } from "@/components/assessment-dialog";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { DeleteAssessmentButton } from "@/components/delete-buttons";
import { FilterChip } from "@/components/filter-chip";
import { MoveButtons } from "@/components/move-buttons";
import { DeleteTagButton, TagDialog } from "@/components/tag-controls";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  WORK_MODE_LABELS,
  filterAssessments,
  parseWorkMode,
  scorePercent,
  weightByWorkMode,
  weightSummary,
  type AssessmentStatus,
  type WorkMode,
} from "@/lib/assessments";
import { daysBetween, todayISO } from "@/lib/dates";
import { countLabel, formatDate } from "@/lib/format";
import { loadModuleOr404 } from "../load-module";

export async function generateMetadata(
  props: PageProps<"/modules/[id]/assessments">,
): Promise<Metadata> {
  const { module: mod } = await loadModuleOr404(props.params);
  return { title: `${mod.name} · Assessments` };
}

const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

function dueLabel(dueDate: string, status: AssessmentStatus, today: string) {
  if (status === "submitted" || status === "graded") return null;
  const days = daysBetween(today, dueDate);
  if (days < 0)
    return { text: `Overdue by ${-days} ${days === -1 ? "day" : "days"}`, urgent: true };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days <= 7) return { text: `Due in ${days} ${days === 1 ? "day" : "days"}`, urgent: false };
  return null;
}

export default async function AssessmentsPage(props: PageProps<"/modules/[id]/assessments">) {
  const { module: mod } = await loadModuleOr404(props.params);
  const query = await props.searchParams;
  const db = getDb();

  const all = listAssessments(db, mod.id);
  const tags = listTags(db, mod.id);
  const fileCounts = countAttachmentsByOwner(
    db,
    "assessment",
    all.map((a) => a.id),
  );

  const mode = parseWorkMode(single(query.mode));
  const tagParam = Number(single(query.tag));
  const tag = tags.find((t) => t.id === tagParam) ?? null;
  const shown = filterAssessments(all, { mode, tagId: tag?.id ?? null });
  const filtered = mode !== null || tag !== null;

  const summary = weightSummary(all);
  const byMode = weightByWorkMode(all);
  const today = todayISO();
  const tagOptions = tags.map((t) => ({ id: t.id, name: t.name, description: t.description }));

  const href = (m: WorkMode | null, t: number | null) => {
    const params = new URLSearchParams();
    if (m) params.set("mode", m);
    if (t) params.set("tag", String(t));
    const qs = params.toString();
    return `/modules/${mod.id}/assessments${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="assessments-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="assessments-heading" className="text-lg font-medium">
            Assessments
          </h2>
          <AssessmentDialog moduleId={mod.id} tags={tagOptions} />
        </div>

        <div
          role="status"
          className={
            summary.state === "under" || summary.state === "over"
              ? "flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
              : "flex gap-2 rounded-lg border p-3 text-sm"
          }
        >
          {summary.state === "complete" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
          ) : summary.state === "empty" ? null : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          )}
          <div className="space-y-1">
            <p>
              {summary.state === "empty" &&
                "No assessments yet. Add each graded component with its weight."}
              {summary.state === "complete" && `Weights total ${pct(summary.total)}.`}
              {summary.state === "under" &&
                `Weights total ${pct(summary.total)}: ${pct(summary.remaining)} is not accounted for. They should add up to 100%.`}
              {summary.state === "over" &&
                `Weights total ${pct(summary.total)}: ${pct(-summary.remaining)} over. They should add up to 100%.`}
            </p>
            {all.length > 0 && (
              <p className="text-muted-foreground">
                Individual {pct(byMode.individual)} · Group {pct(byMode.group)} · Unspecified{" "}
                {pct(byMode.unspecified)}
              </p>
            )}
          </div>
        </div>

        {all.length > 0 && (
          <div className="space-y-2" aria-label="Filters">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground w-20 text-xs">Work mode</span>
              <FilterChip href={href(null, tag?.id ?? null)} active={mode === null}>
                All
              </FilterChip>
              {(Object.keys(WORK_MODE_LABELS) as WorkMode[]).map((m) => (
                <FilterChip key={m} href={href(m, tag?.id ?? null)} active={mode === m}>
                  {WORK_MODE_LABELS[m]}
                </FilterChip>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground w-20 text-xs">Tag</span>
                <FilterChip href={href(mode, null)} active={tag === null}>
                  All
                </FilterChip>
                {tags.map((t) => (
                  <FilterChip key={t.id} href={href(mode, t.id)} active={tag?.id === t.id}>
                    {t.name}
                  </FilterChip>
                ))}
              </div>
            )}
            {filtered && (
              <p className="text-muted-foreground text-xs" aria-live="polite">
                Showing {shown.length} of {all.length} · weight {pct(weightSummary(shown).total)}{" "}
                <Link href={href(null, null)} className="underline">
                  Clear filters
                </Link>
              </p>
            )}
          </div>
        )}

        {shown.length === 0 && all.length > 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Nothing matches these filters.
          </p>
        )}

        <ul className="space-y-3">
          {shown.map((a) => {
            const position = all.findIndex((x) => x.id === a.id);
            const percent = scorePercent(a.score, a.maxScore);
            const due = a.dueDate ? dueLabel(a.dueDate, a.status, today) : null;
            const files = fileCounts.get(a.id) ?? 0;
            return (
              <li key={a.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium break-words">{a.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">
                        {WORK_MODE_LABELS[a.workMode]}
                        {a.workMode === "group" && a.groupSize ? ` · ${a.groupSize} people` : ""}
                      </Badge>
                      <Badge variant={a.status === "graded" ? "default" : "outline"}>
                        {STATUS_LABELS[a.status]}
                      </Badge>
                      {due && (
                        <Badge variant={due.urgent ? "destructive" : "outline"}>{due.text}</Badge>
                      )}
                      {a.tags.map((t) => (
                        <Badge key={t.id} variant="outline" title={t.description ?? undefined}>
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p
                    className="text-xl font-semibold tabular-nums"
                    aria-label={`Weight ${pct(a.weight)}`}
                  >
                    {pct(a.weight)}
                  </p>
                  <MoveButtons
                    label={a.name}
                    onMove={moveAssessmentAction.bind(null, a.id)}
                    isFirst={position === 0}
                    isLast={position === all.length - 1}
                  />
                  <AssessmentDialog
                    moduleId={mod.id}
                    tags={tagOptions}
                    assessment={{ ...a, tagIds: a.tags.map((t) => t.id) }}
                  />
                  <DeleteAssessmentButton
                    id={a.id}
                    name={a.name}
                    impact={[countLabel(files, "file")]}
                  />
                </div>

                <p className="text-muted-foreground text-sm">
                  {[
                    a.lecturer,
                    a.dueDate ? `due ${formatDate(a.dueDate)}` : null,
                    a.score !== null
                      ? `scored ${a.score} / ${a.maxScore}${percent !== null ? ` (${pct(percent)})` : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No lecturer, due date or score yet"}
                </p>
                {a.groupMembers && (
                  <p className="text-muted-foreground text-sm">Group: {a.groupMembers}</p>
                )}
                {a.notes && <p className="text-sm whitespace-pre-line">{a.notes}</p>}

                <details className="group">
                  <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
                    Files ({files})
                  </summary>
                  <div className="pt-3">
                    <AttachmentsPanel
                      ownerType="assessment"
                      ownerId={a.id}
                      kinds={["other", "notes"]}
                      defaultKind="other"
                      heading="Files"
                      description="Briefs, rubrics or your submission."
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="tags-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 id="tags-heading" className="text-lg font-medium">
              Tags
            </h2>
            <p className="text-muted-foreground text-sm">
              Your own labels for this module, such as <span className="font-mono">*</span> or
              &quot;online&quot;. Describe what each one means.
            </p>
          </div>
          <TagDialog moduleId={mod.id} />
        </div>
        {tags.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            No tags yet. Add one here, or type new tags when adding an assessment.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {tags.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <Badge variant="outline">{t.name}</Badge>
                <span className="text-muted-foreground min-w-0 flex-1">
                  {t.description ?? "No description"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t.usage} {t.usage === 1 ? "assessment" : "assessments"}
                </span>
                <TagDialog moduleId={mod.id} tag={t} />
                <DeleteTagButton id={t.id} name={t.name} usage={t.usage} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
