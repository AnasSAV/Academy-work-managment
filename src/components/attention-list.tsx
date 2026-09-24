import Link from "next/link";
import type { StudyChapter } from "@/db/study-queries";
import { describeReason } from "@/lib/study";
import { Badge } from "@/components/ui/badge";
import { LogRevisionButton } from "@/components/board-actions";

/** Chapters that need attention, most urgent first, each with the reasons in words. */
export function AttentionList({
  chapters,
  emptyText,
}: {
  chapters: StudyChapter[];
  emptyText: string;
}) {
  if (chapters.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
        {emptyText}
      </p>
    );
  }
  return (
    <ul aria-label="Chapters needing attention" className="divide-y rounded-lg border">
      {chapters.map((c) => (
        <li
          key={c.chapterId}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm"
        >
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: c.moduleColor }}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p>
              <Link href={`/chapters/${c.chapterId}`} className="font-medium hover:underline">
                {c.title}
              </Link>{" "}
              <span className="text-muted-foreground">· {c.moduleName}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {c.attention?.reasons.map((reason) => (
                <Badge
                  key={reason.kind}
                  variant={reason.kind === "overdue" ? "destructive" : "outline"}
                >
                  {describeReason(reason)}
                </Badge>
              ))}
            </div>
          </div>
          {c.revision && <LogRevisionButton chapterId={c.chapterId} title={c.title} size="xs" />}
        </li>
      ))}
    </ul>
  );
}
