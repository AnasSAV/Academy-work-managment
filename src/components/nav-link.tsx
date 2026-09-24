"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A link that marks itself as the current page. */
export function NavLink({ href, className, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active && "bg-muted font-medium",
        className,
      )}
      {...props}
    />
  );
}
