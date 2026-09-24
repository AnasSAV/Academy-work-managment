import type { Metadata } from "next";
import Link from "next/link";
import { moveChapterAction } from "@/actions/chapters";
import { countLabel, pluralize } from "@/lib/format";
import { toPercent } from "@/lib/progress";
import { getDb } from "@/db";
import { activityRecordCounts, chapterActivityCounts, chapterAttachmentCounts } from "@/db/queries";
import { loadModuleProgress } from "@/db/progress-queries";
import { listAttachments } from "@/db/attachments";
import { getSettings } from "@/db/settings";
import { loadModuleOr404 } from "./load-module";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { ActivityCheckbox } from "@/components/activity-controls";
import { ActivityTypeDialog, DeleteActivityTypeButton } from "@/components/activity-type-controls";
import { AddChaptersForm, RenameChapterDialog } from "@/components/chapter-controls";
import { ConfidenceDots } from "@/components/confidence";
import { DeleteChapterButton } from "@/components/delete-buttons";
import { MoveButtons } from "@/components/move-buttons";
import { ProgressBar } from "@/components/progress-bar";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata(props: PageProps<"/modules/[id]">): Promise<Metadata> {
  const { module: mod } = await loadModuleOr404(props.params);
  return { title: mod.name };
}

export default async function ModulePage(props: PageProps<"/modules/[id]">) {
  const { module: mod } = await loadModuleOr404(props.params);
  const db = getDb();
  const progress = loadModuleProgress(db, [mod.id], getSettings(db)).get(mod.id)!;
  const activityCounts = chapterActivityCounts(db, mod.id);
  const chapterFiles = chapterAttachmentCounts(db, mod.id);
  const typeRecordCounts = activityRecordCounts(db, mod.id);
  const hasOutline = listAttachments(db, "module", mod.id).some((f) => f.kind === "outline");
  const totalWeight = progress.types.reduce((sum, t) => sum + Math.max(0, t.weight), 0);

  return (
    <div className="space-y-8">
      <section aria-labelledby="chapters-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="chapters-heading" className="text-lg font-medium">
            Chapters
          </h2>
          <span className="text-muted-foreground text-sm">
            {pluralize(progress.chapters.length, "chapter")}
          </span>
        </div>

        {progress.chapters.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No chapters yet. Add the first one below.
          </p>
        ) : (
          <ol className="divide-y rounded-lg border">
            {progress.chapters.map(({ chapter, progress: chapterPct, states }, i) => (
              <li key={chapter.id} className="space-y-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-6 shrink-0 text-right text-sm tabular-nums">
                    {i + 1}
                  </span>
                  <Link
                    href={`/chapters/${chapter.id}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {chapter.title}
                  </Link>
                  <ProgressBar
                    value={chapterPct}
                    label={`${chapter.title} progress`}
                    color={mod.color}
                    className="hidden w-24 sm:block"
                  />
                  <span className="w-10 text-right text-xs tabular-nums">
                    {toPercent(chapterPct)}%
                  </span>
                  <MoveButtons
                    label={chapter.title}
                    onMove={moveChapterAction.bind(null, chapter.id)}
                    isFirst={i === 0}
                    isLast={i === progress.chapters.length - 1}
                  />
                  <RenameChapterDialog id={chapter.id} title={chapter.title} />
                  <DeleteChapterButton
                    id={chapter.id}
                    title={chapter.title}
                    impact={[
                      countLabel(activityCounts.get(chapter.id) ?? 0, "activity record"),
                      countLabel(chapterFiles.get(chapter.id) ?? 0, "file"),
                    ]}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-8">
                  {progress.types.map((type) => (
                    <ActivityCheckbox
                      key={type.id}
                      compact
                      chapterId={chapter.id}
                      activityTypeId={type.id}
                      label={type.label}
                      done={states.get(type.id)?.done ?? false}
                    />
                  ))}
                  <ConfidenceDots value={chapter.confidence} className="ml-1" />
                </div>
              </li>
            ))}
          </ol>
        )}

        <AddChaptersForm moduleId={mod.id} />
      </section>

      <AttachmentsPanel
        ownerType="module"
        ownerId={mod.id}
        kinds={["outline", "slides", "notes", "past_paper", "marking_scheme", "other"]}
        defaultKind={hasOutline ? "other" : "outline"}
        description="The module outline, slides, notes and other material. PDFs and images open in the app."
      />

      <section aria-labelledby="activities-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 id="activities-heading" className="text-lg font-medium">
              Activities
            </h2>
            <p className="text-muted-foreground text-sm">
              What you tick off for each chapter. A chapter&apos;s progress is the weighted average
              of these.
            </p>
          </div>
          <ActivityTypeDialog moduleId={mod.id} />
        </div>
        <ul className="divide-y rounded-lg border">
          {progress.types.map((type) => (
            <li key={type.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{type.label}</span>
              {type.key && <Badge variant="secondary">built in</Badge>}
              {type.tracksCounts && <Badge variant="outline">counts</Badge>}
              <span className="text-muted-foreground w-36 shrink-0 text-right whitespace-nowrap tabular-nums">
                weight {type.weight} · {totalWeight > 0 ? toPercent(type.weight / totalWeight) : 0}%
              </span>
              <ActivityTypeDialog
                moduleId={mod.id}
                activity={{
                  id: type.id,
                  label: type.label,
                  weight: type.weight,
                  tracksCounts: type.tracksCounts,
                  builtIn: type.key !== null,
                }}
              />
              {type.key ? (
                <span className="size-6" aria-hidden />
              ) : (
                <DeleteActivityTypeButton
                  id={type.id}
                  label={type.label}
                  records={typeRecordCounts.get(type.id) ?? 0}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
