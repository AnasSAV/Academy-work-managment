import { count } from "drizzle-orm";
import { databasePath } from "@/db/config";
import { getDb, schema } from "@/db";

// Read from the database on every request; never prerender at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDb();
  const semesters = db.select().from(schema.semesters).orderBy(schema.semesters.position).all();
  const modules = db.select().from(schema.modules).orderBy(schema.modules.position).all();
  const chapterCounts = new Map(
    db
      .select({ moduleId: schema.chapters.moduleId, n: count() })
      .from(schema.chapters)
      .groupBy(schema.chapters.moduleId)
      .all()
      .map((r) => [r.moduleId, r.n]),
  );
  const [{ n: assessmentCount }] = db.select({ n: count() }).from(schema.assessments).all();
  const chapterTotal = [...chapterCounts.values()].reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Academy Work Management</h1>
        <p className="text-muted-foreground">
          Local-first tracker for semesters, modules, chapters, past papers and assessments.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Database status</h2>
        <p className="text-muted-foreground text-sm break-all">
          Connected: <span className="font-mono">{databasePath}</span>
        </p>
        <p className="text-sm">
          {semesters.length} semester(s), {modules.length} module(s), {chapterTotal} chapter(s),{" "}
          {assessmentCount} assessment(s)
        </p>

        {modules.length === 0 ? (
          <p className="text-sm">
            The database is empty. Run <code className="font-mono">npm run db:seed</code> to create
            Semester 07, then refresh.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {modules.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                  aria-hidden
                />
                <span>{m.name}</span>
                <span className="text-muted-foreground ml-auto">
                  {chapterCounts.get(m.id) ?? 0} chapters
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-sm">
        This is a temporary status view. Editing screens arrive in the next milestone.
      </p>
    </main>
  );
}
