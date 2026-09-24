import { AlertTriangle, CheckCircle2, Target } from "lucide-react";
import { formatPercent, type GradeSummary, type TargetStatus } from "@/lib/grades";

/**
 * A plain-language reading of a target status. Each state has an icon and words, so the meaning
 * never rests on colour alone. Usable from server and client components.
 */
export function TargetMessage({
  status,
  target,
  summary,
}: {
  status: TargetStatus;
  target: number | null;
  summary: GradeSummary;
}) {
  const t = target !== null ? formatPercent(target) : "";

  if (status.kind === "none") {
    return (
      <Message
        icon={<Target className="text-muted-foreground size-4" aria-hidden />}
        title="No target yet"
      >
        Enter a target grade to see what you need on the work that is left.
      </Message>
    );
  }

  if (status.kind === "secured") {
    return (
      <Message
        icon={<CheckCircle2 className="size-4 text-green-600" aria-hidden />}
        title="Target secured"
      >
        Your {formatPercent(summary.gradePercent)} so far already meets {t}
        {status.margin > 0.05 ? `, with ${formatPercent(status.margin)} to spare` : ""}, whatever
        the rest scores.
      </Message>
    );
  }

  if (status.kind === "needed") {
    return (
      <Message icon={<Target className="size-4" aria-hidden />} title={`To reach ${t}`}>
        You need an average of <strong>{formatPercent(status.average)}</strong> on the remaining{" "}
        {formatPercent(summary.outstanding)} of the grade ({summary.outstandingCount}{" "}
        {summary.outstandingCount === 1 ? "component" : "components"}).
      </Message>
    );
  }

  if (status.kind === "unreachable") {
    return (
      <Message
        icon={<AlertTriangle className="size-4 text-amber-600" aria-hidden />}
        title="Out of reach"
      >
        Full marks on everything left would give {formatPercent(status.bestCase)}, short of {t}.
        {summary.unallocated > 0.005
          ? ` ${formatPercent(summary.unallocated)} of the grade is not allocated to any component yet, so it cannot be earned.`
          : ""}
      </Message>
    );
  }

  return (
    <Message
      icon={<AlertTriangle className="size-4 text-amber-600" aria-hidden />}
      title="Target missed"
    >
      Everything is graded and the final grade is {formatPercent(status.final)}, which is{" "}
      {formatPercent(status.short)} short of {t}.
    </Message>
  );
}

function Message({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 text-sm">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-0.5">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
