import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { selectSemester } from "@/db/queries";
import { getSettings } from "@/db/settings";
import { loadStudy, type StudyChapter } from "@/db/study-queries";
import { todayISO } from "@/lib/dates";
import { toPercent } from "@/lib/progress";
import { BOARD_LABELS, BOARD_STATUSES } from "@/lib/study";
import { AdvanceButton } from "@/components/board-actions";
import { ConfidenceDots } from "@/components/confidence";
import { FilterChip } from "@/components/filter-chip";
import { SemesterChips } from "@/components/semester-chips";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/progress-bar";

export const metadata: Metadata = { title: "Board" };

const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function revisionBadge(c: StudyChapter) {
  const r = c.revision;
  if (!r) return null;
  if (r.state === "overdue") return { text: `Revision overdue ${-r.daysUntil}d`, urgent: true };
  if (r.state === "today") return { text: "Revise today", urgent: true };
  if (r.state === "soon") return { text: `Revise in ${r.daysUntil}d`, urgent: false };
  return null;
}

export default async function BoardPage(props: PageProps<"/board">) {
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
        <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
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

  const study = loadStudy(db, current, getSettings(db), today);
  const moduleOptions = [...new Map(study.chapters.map((c) => [c.moduleId, c])).values()];
  const moduleId = Number(single(query.module));
  const activeModule = moduleOptions.find((m) => m.moduleId === moduleId)?.moduleId ?? null;
  const shown = study.chapters.filter((c) => activeModule === null || c.moduleId === activeModule);

  const href = (m: number | null) => {
    const q = new URLSearchParams({ semester: String(current.id) });
    if (m) q.set("module", String(m));
    return `/board?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
        <p className="text-muted-foreground text-sm">
          Every chapter in {current.name}, by how far along it is. A card moves when you tick things
          off, so its column always matches the chapter.
        </p>
      </header>

      <div className="space-y-2">
        <SemesterChips
          semesters={semesters}
          currentId={current.id}
          basePath="/board"
          params={{ module: activeModule ? String(activeModule) : null }}
        />
        {moduleOptions.length > 1 && (
          <nav aria-label="Module" className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-1 text-xs">Module</span>
            <FilterChip href={href(null)} active={activeModule === null}>
              All
            </FilterChip>
            {moduleOptions.map((m) => (
              <FilterChip
                key={m.moduleId}
                href={href(m.moduleId)}
                active={activeModule === m.moduleId}
              >
                <span
                  aria-hidden
                  className="mr-1.5 inline-block size-2 rounded-full align-middle"
                  style={{ background: m.moduleColor }}
                />
                {m.moduleName}
              </FilterChip>
            ))}
          </nav>
        )}
      </div>

      {study.chapters.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          This semester has no chapters yet. Add some on a module page.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOARD_STATUSES.map((status) => {
            const cards = shown.filter((c) => c.status === status);
            return (
              <section
                key={status}
                aria-labelledby={`col-${status}`}
                className="bg-muted/40 space-y-3 rounded-xl p-3"
              >
                <h2
                  id={`col-${status}`}
                  className="flex items-center justify-between px-1 text-sm font-medium"
                >
                  {BOARD_LABELS[status]}
                  <span className="bg-background rounded-full px-2 py-0.5 text-xs tabular-nums">
                    {cards.length}
                  </span>
                </h2>
                {cards.length === 0 ? (
                  <p className="text-muted-foreground px-1 py-4 text-center text-sm">
                    Nothing here
                  </p>
                ) : (
                  <ul aria-label={BOARD_LABELS[status]} className="space-y-2">
                    {cards.map((c) => {
                      const badge = revisionBadge(c);
                      return (
                        <li key={c.chapterId} className="bg-card space-y-2.5 rounded-lg border p-3">
                          <div className="space-y-1">
                            <Link
                              href={`/chapters/${c.chapterId}`}
                              className="block text-sm font-medium break-words hover:underline"
                            >
                              {c.title}
                            </Link>
                            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-full"
                                style={{ background: c.moduleColor }}
                              />
                              {c.moduleName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <ProgressBar
                              value={c.progress}
                              label={`${c.title} progress`}
                              color={c.moduleColor}
                            />
                            <span className="w-9 text-right text-xs tabular-nums">
                              {toPercent(c.progress)}%
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ConfidenceDots value={c.confidence} />
                            {badge && (
                              <Badge variant={badge.urgent ? "destructive" : "outline"}>
                                {badge.text}
                              </Badge>
                            )}
                          </div>
                          <AdvanceButton
                            chapterId={c.chapterId}
                            title={c.title}
                            status={c.status}
                            learnedTypeId={c.learnedTypeId}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
