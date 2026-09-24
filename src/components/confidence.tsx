import { cn } from "@/lib/utils";

/** Five dots showing a 1-5 confidence rating, or a dash when unrated. */
export function ConfidenceDots({ value, className }: { value: number | null; className?: string }) {
  const label = value ? `Confidence ${value} of 5` : "Confidence not rated";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "size-1.5 rounded-full",
            value && n <= value ? "bg-foreground/70" : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}
