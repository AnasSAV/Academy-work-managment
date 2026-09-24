import type { Metadata } from "next";
import { getDb } from "@/db";
import { countAttachmentsByOwner, listAttachments } from "@/db/attachments";
import { listPastPapers } from "@/db/past-papers";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { DeletePastPaperButton } from "@/components/delete-buttons";
import { PastPaperDialog } from "@/components/past-paper-dialog";
import { Badge } from "@/components/ui/badge";
import { meanProgress, pastPaperProgress, toPercent } from "@/lib/progress";
import { scorePercent } from "@/lib/assessments";
import { countLabel, formatDate, formatMinutes } from "@/lib/format";
import { loadModuleOr404 } from "../load-module";

export async function generateMetadata(
  props: PageProps<"/modules/[id]/papers">,
): Promise<Metadata> {
  const { module: mod } = await loadModuleOr404(props.params);
  return { title: `${mod.name} · Past papers` };
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

export default async function PastPapersPage(props: PageProps<"/modules/[id]/papers">) {
  const { module: mod } = await loadModuleOr404(props.params);
  const db = getDb();
  const papers = listPastPapers(db, mod.id);
  const fileCounts = countAttachmentsByOwner(
    db,
    "past_paper",
    papers.map((p) => p.id),
  );

  const attempted = papers.filter((p) => p.attempted);
  const scored = attempted
    .map((p) => scorePercent(p.score, p.maxScore))
    .filter((v): v is number => v !== null);
  const average = scored.length > 0 ? meanProgress(scored) : null;
  const contribution = pastPaperProgress(papers);

  return (
    <section aria-labelledby="papers-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="papers-heading" className="text-lg font-medium">
          Past papers
        </h2>
        <PastPaperDialog moduleId={mod.id} />
      </div>

      {papers.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          No past papers yet. Log each paper you have, then record how it went.
        </p>
      ) : (
        <div role="status" className="rounded-lg border p-3 text-sm">
          <p>
            {attempted.length} of {papers.length} attempted
            {average !== null && ` · average score ${pct(average)}`}
          </p>
          {contribution !== null && (
            <p className="text-muted-foreground">
              Counts as {toPercent(contribution)}% towards this module&apos;s readiness (attempted
              share × average score).
            </p>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {papers.map((p) => {
          const percent = scorePercent(p.score, p.maxScore);
          const files = fileCounts.get(p.id) ?? 0;
          const attached = listAttachments(db, "past_paper", p.id);
          const hasPaper = attached.some((f) => f.kind === "past_paper");
          return (
            <li key={p.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium break-words">
                    {p.title}
                    {p.year ? (
                      <span className="text-muted-foreground font-normal"> ({p.year})</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={p.attempted ? "default" : "outline"}>
                      {p.attempted ? "Attempted" : "Not attempted"}
                    </Badge>
                    {attached.some((f) => f.kind === "marking_scheme") && (
                      <Badge variant="secondary">Marking scheme</Badge>
                    )}
                  </div>
                </div>
                {percent !== null && (
                  <p
                    className="text-xl font-semibold tabular-nums"
                    aria-label={`Score ${pct(percent)}`}
                  >
                    {pct(percent)}
                  </p>
                )}
                <PastPaperDialog moduleId={mod.id} paper={p} />
                <DeletePastPaperButton
                  id={p.id}
                  title={p.title}
                  impact={[countLabel(files, "file")]}
                />
              </div>

              {p.attempted && (
                <p className="text-muted-foreground text-sm">
                  {[
                    p.score !== null ? `${p.score} / ${p.maxScore}` : "No score recorded",
                    p.minutesTaken !== null ? formatMinutes(p.minutesTaken) : null,
                    p.attemptedAt ? formatDate(p.attemptedAt) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {p.notes && <p className="text-sm whitespace-pre-line">{p.notes}</p>}

              <details>
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
                  Files ({files})
                </summary>
                <div className="pt-3">
                  <AttachmentsPanel
                    ownerType="past_paper"
                    ownerId={p.id}
                    kinds={["past_paper", "marking_scheme", "other"]}
                    defaultKind={hasPaper ? "marking_scheme" : "past_paper"}
                    heading="Files"
                    description="The paper itself and its marking scheme."
                  />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
