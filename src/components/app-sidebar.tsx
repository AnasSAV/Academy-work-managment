import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { getDb } from "@/db";
import { listNav } from "@/db/queries";
import { NavLink } from "@/components/nav-link";

export function AppSidebar() {
  const semesters = listNav(getDb());

  return (
    <aside className="bg-card border-b md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
      <nav aria-label="Main" className="flex flex-col gap-4 p-3">
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <GraduationCap className="size-5" aria-hidden />
          Academy Work
        </Link>

        {semesters.length === 0 && (
          <p className="text-muted-foreground px-2 text-sm">No semesters yet.</p>
        )}

        {semesters.map((semester) => (
          <div key={semester.id} className="flex flex-col gap-0.5">
            <NavLink href={`/semesters/${semester.id}`} className="font-medium">
              {semester.name}
            </NavLink>
            {semester.modules.map((m) => (
              <NavLink key={m.id} href={`/modules/${m.id}`} className="text-muted-foreground pl-4">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                  aria-hidden
                />
                <span className="truncate">{m.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
