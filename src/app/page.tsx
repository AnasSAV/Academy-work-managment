import Link from "next/link";
import { getDb } from "@/db";
import { listSemesterSummaries } from "@/db/queries";
import { SemesterDialog } from "@/components/semester-dialog";
import { StarterDataButton } from "@/components/starter-data-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateRange, pluralize } from "@/lib/format";

export default function Home() {
  const semesters = listSemesterSummaries(getDb());

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Semesters</h1>
          <p className="text-muted-foreground text-sm">
            Local-first tracker for modules, chapters, past papers and assessments.
          </p>
        </div>
        {semesters.length > 0 && <SemesterDialog />}
      </header>

      {semesters.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>
              Start from your Semester 07 setup (six modules and the Computer Networks and Security
              chapters), or create an empty semester.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <StarterDataButton />
            <SemesterDialog />
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {semesters.map((semester) => (
            <li key={semester.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    <Link href={`/semesters/${semester.id}`} className="hover:underline">
                      {semester.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {[
                      formatDateRange(semester.startDate, semester.endDate),
                      pluralize(semester.moduleCount, "module"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm">
                    {semester.modules.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/modules/${m.id}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: m.color }}
                            aria-hidden
                          />
                          {m.name}
                        </Link>
                      </li>
                    ))}
                    {semester.modules.length === 0 && (
                      <li className="text-muted-foreground">No modules yet</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
