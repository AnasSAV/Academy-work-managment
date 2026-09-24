"use client";

import { GraduationCap, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * The sidebar frame. From the medium breakpoint up it is a fixed column. On a phone it collapses
 * to a bar with a Menu button, and closes itself when you navigate.
 */
export function SidebarShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on: navigating elsewhere closes it, without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <aside className="bg-card border-b md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
      <div className="flex items-center justify-between p-3 md:pb-0">
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <GraduationCap className="size-5" aria-hidden />
          Academy Work
        </Link>
        <button
          type="button"
          onClick={() => setOpenOn(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="site-nav"
          className="hover:bg-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm md:hidden"
        >
          {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div id="site-nav" className={open ? "block" : "hidden md:block"}>
        {children}
      </div>
    </aside>
  );
}
