import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getChapter } from "@/db/queries";
import { loadModuleProgress } from "@/db/progress-queries";
import { getSettings } from "@/db/settings";
import { daysBetween, todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { toPercent } from "@/lib/progress";
import {
  ChapterDetailsDialog,
  CountsForm,
  RevisionControls,
  ActivityCheckbox,
} from "@/components/activity-controls";
import { ConfidenceDots } from "@/components/confidence";
import { ProgressBar } from "@/components/progress-bar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function loadChapter(params: PageProps<"/chapters/[id]">["params"]) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const found = getChapter(getDb(), id);
  if (!found) notFound();
  return found;
}

export async function generateMetadata(props: PageProps<"/chapters/[id]">): Promise<Metadata> {
  const { chapter } = await loadChapter(props.params);
  return { title: chapter.title };
}

function reviewedAgo(lastReviewedAt: string, today: string) {
  const days = daysBetween(lastReviewedAt, today);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default async function ChapterPage(props: PageProps<"/chapters/[id]">) {
  const { chapter, module: mod, semester } = await loadChapter(props.params);
  const db = getDb();
  const progress = loadModuleProgress(db, [mod.id], getSettings(db)).get(mod.id)!;
  const index = progress.chapters.findIndex((c) => c.chapter.id === chapter.id);
  const current = progress.chapters[index];
  const prev = progress.chapters[index - 1]?.chapter;
  const next = progress.chapters[index + 1]?.chapter;
  const today = todayISO();

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground flex flex-wrap gap-1.5 text-sm"
        >
          <Link href="/" className="hover:underline">
            Semesters
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/semesters/${semester.id}`} className="hover:underline">
            {semester.name}
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/modules/${mod.id}`} className="hover:underline">
            {mod.name}
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <span
              className="size-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: mod.color }}
              aria-hidden
            />
            {chapter.title}
          </h1>
          <div className="flex gap-1">
            {prev ? (
              <Link
                href={`/chapters/${prev.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ChevronLeft /> Previous
              </Link>
            ) : null}
            {next ? (
              <Link
                href={`/chapters/${next.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Next <ChevronRight />
              </Link>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>Chapter progress</span>
            <span className="tabular-nums">{toPercent(current.progress)}%</span>
          </div>
          <ProgressBar value={current.progress} label="Chapter progress" color={mod.color} />
        </div>
      </header>

      <section aria-labelledby="activities-heading" className="space-y-3">
        <h2 id="activities-heading" className="text-lg font-medium">
          Activities
        </h2>
        <ul className="divide-y rounded-lg border">
          {progress.types.map((type) => {
            const state = current.states.get(type.id);
            return (
              <li key={type.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                <div className="min-w-40 flex-1 space-y-0.5">
                  <ActivityCheckbox
                    chapterId={chapter.id}
                    activityTypeId={type.id}
                    label={type.label}
                    done={state?.done ?? false}
                  />
                  {state?.done && state.doneAt && (
                    <p className="text-muted-foreground pl-1 text-xs">
                      Done {formatDate(state.doneAt)}
                    </p>
                  )}
                </div>
                {type.tracksCounts && (
                  <CountsForm
                    chapterId={chapter.id}
                    activityTypeId={type.id}
                    countDone={state?.countDone ?? null}
                    countTotal={state?.countTotal ?? null}
                  />
                )}
                {type.key === "revised" && (
                  <RevisionControls chapterId={chapter.id} count={state?.revisionCount ?? 0} />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="details-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="details-heading" className="text-lg font-medium">
            Details
          </h2>
          <ChapterDetailsDialog chapter={chapter} />
        </div>
        <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground">Confidence</dt>
            <dd className="flex items-center gap-2">
              <ConfidenceDots value={chapter.confidence} />
              {chapter.confidence ? `${chapter.confidence} of 5` : "Not rated"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Last reviewed</dt>
            <dd>
              {chapter.lastReviewedAt
                ? `${formatDate(chapter.lastReviewedAt)} (${reviewedAgo(chapter.lastReviewedAt, today)})`
                : "Never"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">OneNote</dt>
            <dd>
              {chapter.onenoteUrl ? (
                <a
                  href={chapter.onenoteUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open in OneNote <ExternalLink />
                </a>
              ) : (
                "No link"
              )}
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">Note</dt>
            <dd className="whitespace-pre-line">{chapter.note ?? "No note"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
