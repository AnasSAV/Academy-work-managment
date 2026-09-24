import { AlertTriangle, ClipboardList, GraduationCap } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { relativeDays } from "@/lib/dates";
import type { DatedItem } from "@/lib/study";
import { cn } from "@/lib/utils";

/** Where a dated item lives in the app. */
export function itemHref(item: Pick<DatedItem, "kind" | "moduleId">): string {
  return item.kind === "exam"
    ? `/modules/${item.moduleId}`
    : `/modules/${item.moduleId}/assessments`;
}

/**
 * Deadlines and exams as a list. Overdue work is marked with an icon and words, not just colour.
 * The module colour is a small dot beside the text.
 */
export function DeadlineList({
  items,
  emptyText,
  ariaLabel,
}: {
  items: DatedItem[];
  emptyText: string;
  ariaLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
        {emptyText}
      </p>
    );
  }
  return (
    <ul aria-label={ariaLabel} className="divide-y rounded-lg border">
      {items.map((item) => {
        const overdue = item.kind === "assessment" && item.days < 0;
        const Icon = overdue ? AlertTriangle : item.kind === "exam" ? GraduationCap : ClipboardList;
        return (
          <li
            key={item.key}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: item.moduleColor }}
            />
            <Icon
              className={cn(
                "size-4 shrink-0",
                overdue ? "text-amber-600" : "text-muted-foreground",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <Link href={itemHref(item)} className="font-medium break-words hover:underline">
                {item.title}
              </Link>
              <p className="text-muted-foreground text-xs">
                {item.kind === "exam" ? "Exam" : "Due"} {formatDate(item.date)}
                {item.kind === "assessment" ? ` · ${item.moduleName}` : ""}
                {item.weight !== null
                  ? ` · ${Math.round(item.weight * 100) / 100}% of the grade`
                  : ""}
              </p>
            </div>
            <span className={cn("text-sm whitespace-nowrap", overdue && "font-medium")}>
              {overdue
                ? `Overdue by ${-item.days} ${item.days === -1 ? "day" : "days"}`
                : relativeDays(item.days)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
