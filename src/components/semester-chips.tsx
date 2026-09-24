import { FilterChip } from "@/components/filter-chip";

/** Switch between semesters on a page. Only shown when there is more than one. */
export function SemesterChips({
  semesters,
  currentId,
  basePath,
  params = {},
}: {
  semesters: { id: number; name: string }[];
  currentId: number;
  basePath: string;
  /** Other query parameters to keep when switching. */
  params?: Record<string, string | null | undefined>;
}) {
  if (semesters.length < 2) return null;
  const href = (id: number) => {
    const q = new URLSearchParams({ semester: String(id) });
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return `${basePath}?${q.toString()}`;
  };
  return (
    <nav aria-label="Semester" className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground mr-1 text-xs">Semester</span>
      {semesters.map((s) => (
        <FilterChip key={s.id} href={href(s.id)} active={s.id === currentId}>
          {s.name}
        </FilterChip>
      ))}
    </nav>
  );
}
