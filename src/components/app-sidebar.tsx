import { CalendarDays, Columns3, LayoutDashboard, ListChecks, Settings } from "lucide-react";
import { getDb } from "@/db";
import { listNav } from "@/db/queries";
import { AppTools } from "@/components/app-tools";
import { NavLink } from "@/components/nav-link";
import { SidebarShell } from "@/components/sidebar-shell";

export function AppSidebar() {
  const semesters = listNav(getDb());
  const modules = semesters.flatMap((s) =>
    s.modules.map((m) => ({ id: m.id, name: m.name, semesterName: s.name })),
  );

  return (
    <SidebarShell>
      <nav aria-label="Main" className="flex flex-col gap-4 p-3">
        <div className="flex flex-col gap-0.5">
          <NavLink href="/">
            <LayoutDashboard className="size-4" aria-hidden />
            Dashboard
          </NavLink>
          <NavLink href="/board">
            <Columns3 className="size-4" aria-hidden />
            Board
          </NavLink>
          <NavLink href="/calendar">
            <CalendarDays className="size-4" aria-hidden />
            Calendar
          </NavLink>
          <NavLink href="/review">
            <ListChecks className="size-4" aria-hidden />
            Review
          </NavLink>
        </div>

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

        <div className="flex flex-col gap-0.5 border-t pt-3">
          <NavLink href="/settings" className="text-muted-foreground">
            <Settings className="size-4" aria-hidden />
            Settings
          </NavLink>
          <AppTools modules={modules} />
        </div>
      </nav>
    </SidebarShell>
  );
}
