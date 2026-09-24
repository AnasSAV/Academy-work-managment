"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ModuleTabsProps {
  moduleId: number;
  counts: { chapters: number; assessments: number; pastPapers: number };
}

/** Sub-navigation for a module: chapters, assessments and past papers. */
export function ModuleTabs({ moduleId, counts }: ModuleTabsProps) {
  const pathname = usePathname();
  const base = `/modules/${moduleId}`;
  const tabs = [
    { href: base, label: "Chapters", count: counts.chapters },
    { href: `${base}/assessments`, label: "Assessments", count: counts.assessments },
    { href: `${base}/papers`, label: "Past papers", count: counts.pastPapers },
  ];

  return (
    <nav aria-label="Module sections" className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
            <span className="bg-muted rounded-full px-1.5 text-xs tabular-nums">{tab.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
