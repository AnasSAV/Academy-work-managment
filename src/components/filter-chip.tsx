import Link from "next/link";
import { cn } from "@/lib/utils";

/** A link styled as a toggle chip; used for URL-based filters. */
export function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "hover:bg-muted text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}
