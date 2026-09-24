import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { selectSemester } from "@/db/queries";
import { getSettings } from "@/db/settings";
import { loadStudy, type StudyChapter } from "@/db/study-queries";
import { relativeDays, todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { upcomingItems } from "@/lib/study";
import { AttentionList } from "@/components/attention-list";
import { LogRevisionButton } from "@/components/board-actions";
import { DeadlineList } from "@/components/deadline-list";
import { SemesterChips } from "@/components/semester-chips";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Review" };

const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function dueText(c: StudyChapter) {
  const r = c.revision!;
  if (r.state === "overdue")
    return `Overdue by ${-r.daysUntil} ${r.daysUntil === -1 ? "day" : "days"}`;
  if (r.state === "today") return "Due today";
  return relativeDays(r.daysUntil).replace("In", "Due in");
}

export default async function ReviewPage(props: PageProps<"/review">) {
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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No semesters yet. Add one from the{" "}
          <Link href="/" className="underline">
            dashboard
          </Link>
          .
        </p>
      </div>
    );
  }

  const settings = getSettings(db);
  const study = loadStudy(db, current, settings, today);

  const upcoming = upcomingItems(study.items);
  const exams = upcoming.filter((i) => i.kind === "exam");
  const deadlines = upcoming.filter((i) => i.kind === "assessment");
  const revisionDue = study.chapters
    .filter((c) => c.revision && c.revision.state !== "later")
    .sort((a, b) => a.revision!.daysUntil - b.revision!.daysUntil);
  const needsAttention = study.chapters
    .filter((c) => c.attention)
    .sort((a, b) => b.attention!.score - a.attention!.score);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-muted-foreground text-sm">
          What to do next in {current.name}: exams and deadlines coming up, chapters due for
          revision, and anything that needs attention.
        </p>
      </header>

      <SemesterChips semesters={semesters} currentId={current.id} basePath="/review" />

      <section aria-labelledby="exams-heading" className="space-y-3">
        <h2 id="exams-heading" className="text-lg font-medium">
          Exam countdown
        </h2>
        {exams.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            No upcoming exams. Set an exam date when you edit a module.
          </p>
        ) : (
          <ul aria-label="Upcoming exams" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((e) => (
              <li key={e.key} className="bg-card rounded-lg border p-4">
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ background: e.moduleColor }}
                  />
                  <Link href={`/modules/${e.moduleId}`} className="hover:underline">
                    {e.moduleName}
                  </Link>
                </p>
                <p className="mt-1 text-3xl font-semibold">
                  {e.days === 0 ? "Today" : `${e.days} ${e.days === 1 ? "day" : "days"}`}
                </p>
                <p className="text-muted-foreground text-xs">{formatDate(e.date)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="deadlines-heading" className="space-y-3">
        <h2 id="deadlines-heading" className="text-lg font-medium">
          Upcoming deadlines
        </h2>
        <DeadlineList
          items={deadlines}
          ariaLabel="Upcoming assessment deadlines"
          emptyText="Nothing due. Give an assessment a due date to see it here."
        />
      </section>

      <section aria-labelledby="revision-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="revision-heading" className="text-lg font-medium">
            Due for revision
          </h2>
          <p className="text-muted-foreground text-sm">
            Chapters you have learned, when they are due back. Shakier chapters come back sooner and
            each revision spaces the next one further out. The base interval is{" "}
            {settings.reviseAfterDays} days (
            <Link href="/settings" className="underline">
              change it in Settings
            </Link>
            ).
          </p>
        </div>
        {revisionDue.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
            Nothing is due for revision in the next week.
          </p>
        ) : (
          <ul aria-label="Chapters due for revision" className="divide-y rounded-lg border">
            {revisionDue.map((c) => (
              <li
                key={c.chapterId}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: c.moduleColor }}
                />
                <div className="min-w-0 flex-1">
                  <p>
                    <Link href={`/chapters/${c.chapterId}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>{" "}
                    <span className="text-muted-foreground">· {c.moduleName}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {c.lastReviewedAt
                      ? `Last reviewed ${formatDate(c.lastReviewedAt)}`
                      : "Not reviewed yet"}{" "}
                    · comes back every {c.revision!.intervalDays} days
                  </p>
                </div>
                <Badge variant={c.revision!.state === "soon" ? "outline" : "destructive"}>
                  {dueText(c)}
                </Badge>
                <LogRevisionButton chapterId={c.chapterId} title={c.title} size="xs" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="attention-heading" className="text-lg font-medium">
            Needs attention
          </h2>
          <p className="text-muted-foreground text-sm">
            Overdue revision, low confidence (1 or 2 of 5), and chapters not started in a module
            that is under way or has an exam within 30 days. A close exam moves things up the list.
          </p>
        </div>
        <AttentionList
          chapters={needsAttention}
          emptyText="All clear. Nothing needs attention right now."
        />
      </section>
    </div>
  );
}
