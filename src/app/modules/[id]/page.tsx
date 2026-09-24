import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { moveChapterAction } from "@/actions/chapters";
import { countLabel, formatDate, pluralize } from "@/lib/format";
import { getDb } from "@/db";
import { chapterActivityCounts, getModule, listChapters } from "@/db/queries";
import { getModuleDeleteImpact } from "@/db/services";
import { AddChaptersForm, RenameChapterDialog } from "@/components/chapter-controls";
import { DeleteChapterButton, DeleteModuleButton } from "@/components/delete-buttons";
import { ModuleDialog } from "@/components/module-dialog";
import { MoveButtons } from "@/components/move-buttons";

async function loadModule(params: PageProps<"/modules/[id]">["params"]) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const found = getModule(getDb(), id);
  if (!found) notFound();
  return found;
}

export async function generateMetadata(props: PageProps<"/modules/[id]">): Promise<Metadata> {
  const { module: mod } = await loadModule(props.params);
  return { title: mod.name };
}

export default async function ModulePage(props: PageProps<"/modules/[id]">) {
  const { module: mod, semester } = await loadModule(props.params);
  const db = getDb();
  const chapters = listChapters(db, mod.id);
  const activityCounts = chapterActivityCounts(db, mod.id);
  const impact = getModuleDeleteImpact(db, mod.id);

  const details = [
    mod.code,
    mod.credits != null ? `${mod.credits} credits` : null,
    mod.targetGrade != null ? `target ${mod.targetGrade}%` : null,
    mod.examDate ? `exam ${formatDate(mod.examDate)}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-muted-foreground flex gap-1.5 text-sm">
          <Link href="/" className="hover:underline">
            Semesters
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/semesters/${semester.id}`} className="hover:underline">
            {semester.name}
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
              <span
                className="size-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: mod.color }}
                aria-hidden
              />
              {mod.name}
            </h1>
            {details.length > 0 && (
              <p className="text-muted-foreground text-sm">{details.join(" · ")}</p>
            )}
            {mod.lecturers && (
              <p className="text-muted-foreground text-sm">Lecturers: {mod.lecturers}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ModuleDialog existing={mod} semesterId={semester.id} defaultColor={mod.color} />
            <DeleteModuleButton
              id={mod.id}
              name={mod.name}
              impact={[
                countLabel(impact.chapters, "chapter"),
                countLabel(impact.activityRecords, "activity record"),
                countLabel(impact.assessments, "assessment"),
                countLabel(impact.pastPapers, "past paper"),
              ]}
            />
          </div>
        </div>
        {mod.notes && <p className="text-sm whitespace-pre-line">{mod.notes}</p>}
      </header>

      <section aria-labelledby="chapters-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="chapters-heading" className="text-lg font-medium">
            Chapters
          </h2>
          <span className="text-muted-foreground text-sm">
            {pluralize(chapters.length, "chapter")}
          </span>
        </div>

        {chapters.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No chapters yet. Add the first one below.
          </p>
        ) : (
          <ol className="divide-y rounded-lg border">
            {chapters.map((chapter, i) => (
              <li key={chapter.id} className="flex items-center gap-2 px-3 py-2">
                <span className="text-muted-foreground w-6 shrink-0 text-right text-sm tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                <MoveButtons
                  label={chapter.title}
                  onMove={moveChapterAction.bind(null, chapter.id)}
                  isFirst={i === 0}
                  isLast={i === chapters.length - 1}
                />
                <RenameChapterDialog id={chapter.id} title={chapter.title} />
                <DeleteChapterButton
                  id={chapter.id}
                  title={chapter.title}
                  impact={[countLabel(activityCounts.get(chapter.id) ?? 0, "activity record")]}
                />
              </li>
            ))}
          </ol>
        )}

        <AddChaptersForm moduleId={mod.id} />
      </section>
    </div>
  );
}
