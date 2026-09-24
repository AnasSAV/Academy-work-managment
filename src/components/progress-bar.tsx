import { toPercent } from "@/lib/progress";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** 0 to 1. */
  value: number;
  /** Accessible name, e.g. "Chapter progress". */
  label: string;
  color?: string;
  className?: string;
}

export function ProgressBar({ value, label, color, className }: ProgressBarProps) {
  const percent = toPercent(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("bg-muted h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${percent}%`, backgroundColor: color ?? "var(--primary)" }}
      />
    </div>
  );
}
