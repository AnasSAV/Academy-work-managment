import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  RotateCcw,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { selectSemester } from "@/db/queries";
import { getSettings } from "@/db/settings";
import { loadStudy } from "@/db/study-queries";
import { monthGrid, monthKey, monthLabel, parseMonth, shiftMonth, WEEKDAYS } from "@/lib/calendar";
import { daysBetween, relativeDays, todayISO } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { itemHref } from "@/components/deadline-list";
import { FilterChip } from "@/components/filter-chip";
import { SemesterChips } from "@/components/semester-chips";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Calendar" };

const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

interface CalendarEvent {
  key: string;
  kind: "assessment" | "exam" | "revision";
  date: string;
  title: string;
  moduleName: string;
  moduleColor: string;
  href: string;
  finished: boolean;
  overdue: boolean;
}

const KIND_LABEL = { assessment: "Due", exam: "Exam", revision: "Revise" } as const;

function EventIcon({ event }: { event: CalendarEvent }) {
  const cls = "size-3.5 shrink-0";
  if (event.overdue) return <AlertTriangle className={cn(cls, "text-amber-600")} aria-hidden />;
  if (event.kind === "exam") return <GraduationCap className={cls} aria-hidden />;
  if (event.kind === "revision") return <RotateCcw className={cls} aria-hidden />;
  return <ClipboardList className={cls} aria-hidden />;
}

export default async function CalendarPage(props: PageProps<"/calendar">) {
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
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
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

  const month = parseMonth(single(query.month), today);
  const showRevision = single(query.revision) === "1";
  const weeks = monthGrid(month);
  const first = weeks[0][0].date;
  const last = weeks.at(-1)!.at(-1)!.date;

  const study = loadStudy(db, current, getSettings(db), today);
  const events: CalendarEvent[] = study.items.map((i) => ({
    key: i.key,
    kind: i.kind,
    date: i.date,
    title: i.title,
    moduleName: i.moduleName,
    moduleColor: i.moduleColor,
    href: itemHref(i),
    finished: i.finished,
    overdue: i.kind === "assessment" && !i.finished && i.days < 0,
  }));
  if (showRevision) {
    for (const c of study.chapters) {
      if (!c.revision) continue;
      events.push({
        key: `revision-${c.chapterId}`,
        kind: "revision",
        date: c.revision.dueDate,
        title: c.title,
        moduleName: c.moduleName,
        moduleColor: c.moduleColor,
        href: `/chapters/${c.chapterId}`,
        finished: false,
        overdue: c.revision.state === "overdue",
      });
    }
  }
  const inRange = events.filter((e) => e.date >= first && e.date <= last);
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of inRange) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const monthEvents = inRange
    .filter((e) => e.date.startsWith(monthKey(month)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  const agendaDays = [...new Set(monthEvents.map((e) => e.date))];

  const link = (m: { year: number; month: number } | null) => {
    const q = new URLSearchParams({ semester: String(current.id) });
    if (m) q.set("month", monthKey(m));
    if (showRevision) q.set("revision", "1");
    return `/calendar?${q.toString()}`;
  };
  const revisionToggle = (() => {
    const q = new URLSearchParams({ semester: String(current.id), month: monthKey(month) });
    if (!showRevision) q.set("revision", "1");
    return `/calendar?${q.toString()}`;
  })();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground text-sm">
          Assessment due dates and exams for {current.name}. Set an exam date on a module, and a due
          date on an assessment, to see them here.
        </p>
      </header>

      <div className="space-y-2">
        <SemesterChips
          semesters={semesters}
          currentId={current.id}
          basePath="/calendar"
          params={{ month: monthKey(month), revision: showRevision ? "1" : null }}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 text-xs">Show</span>
          <FilterChip href={revisionToggle} active={showRevision}>
            Revision reminders
          </FilterChip>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <div className="flex gap-1">
          <Link
            href={link(shiftMonth(month, -1))}
            aria-label="Previous month"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeft />
          </Link>
          <Link href={link(null)} className={buttonVariants({ variant: "outline" })}>
            Today
          </Link>
          <Link
            href={link(shiftMonth(month, 1))}
            aria-label="Next month"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRight />
          </Link>
        </div>
      </div>

      <div className="bg-card hidden overflow-hidden rounded-xl border sm:block">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{monthLabel(month)}</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="text-muted-foreground border-b px-2 py-2 text-left text-xs font-medium"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].date}>
                {week.map((day) => {
                  const list = byDate.get(day.date) ?? [];
                  const isToday = day.date === today;
                  return (
                    <td
                      key={day.date}
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "h-28 border-r border-b p-1.5 align-top last:border-r-0",
                        !day.inMonth && "bg-muted/40",
                      )}
                    >
                      <p
                        className={cn(
                          "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                          !day.inMonth && "text-muted-foreground",
                          isToday && "bg-foreground text-background font-semibold",
                        )}
                      >
                        {Number(day.date.slice(8))}
                      </p>
                      <ul className="space-y-1">
                        {list.slice(0, 3).map((e) => (
                          <li key={e.key}>
                            <Link
                              href={e.href}
                              title={`${KIND_LABEL[e.kind]}: ${e.title} (${e.moduleName})`}
                              className={cn(
                                "hover:bg-muted flex items-center gap-1 rounded px-1 py-0.5 text-xs",
                                e.finished && "text-muted-foreground line-through",
                              )}
                            >
                              <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-full"
                                style={{ background: e.moduleColor }}
                              />
                              <EventIcon event={e} />
                              <span className="truncate">
                                <span className="sr-only">{KIND_LABEL[e.kind]}: </span>
                                {e.title}
                              </span>
                            </Link>
                          </li>
                        ))}
                        {list.length > 3 && (
                          <li className="text-muted-foreground px-1 text-xs">
                            +{list.length - 3} more (see the list below)
                          </li>
                        )}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label="Key" className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <ClipboardList className="size-3.5" aria-hidden /> Assessment due
        </li>
        <li className="flex items-center gap-1.5">
          <GraduationCap className="size-3.5" aria-hidden /> Exam
        </li>
        {showRevision && (
          <li className="flex items-center gap-1.5">
            <RotateCcw className="size-3.5" aria-hidden /> Revision due
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <AlertTriangle className="size-3.5 text-amber-600" aria-hidden /> Overdue
        </li>
        <li className="line-through">Finished</li>
      </ul>

      <section aria-labelledby="agenda-heading" className="space-y-3">
        <h2 id="agenda-heading" className="text-lg font-medium">
          {monthLabel(month)} in a list
        </h2>
        {agendaDays.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Nothing dated this month.
          </p>
        ) : (
          <ol className="divide-y rounded-lg border">
            {agendaDays.map((date) => (
              <li key={date} className="space-y-1.5 px-3 py-2.5">
                <h3 className="text-sm font-medium">
                  {formatDate(date)}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {relativeDays(daysBetween(today, date))}
                  </span>
                </h3>
                <ul className="space-y-1">
                  {monthEvents
                    .filter((e) => e.date === date)
                    .map((e) => (
                      <li key={e.key}>
                        <Link
                          href={e.href}
                          className={cn(
                            "flex items-center gap-2 text-sm hover:underline",
                            e.finished && "text-muted-foreground line-through",
                          )}
                        >
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: e.moduleColor }}
                          />
                          <EventIcon event={e} />
                          <span>
                            <span className="text-muted-foreground">{KIND_LABEL[e.kind]}: </span>
                            {e.title}
                            {e.kind !== "exam" && (
                              <span className="text-muted-foreground"> · {e.moduleName}</span>
                            )}
                            {e.overdue && <span className="font-medium"> (overdue)</span>}
                            {e.finished && <span className="sr-only"> (finished)</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
