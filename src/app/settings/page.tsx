import type { Metadata } from "next";
import { getDb } from "@/db";
import { getSettings } from "@/db/settings";
import { SettingsDialog } from "@/components/settings-dialog";
import { DEFAULT_ACTIVITY_TYPES } from "@/lib/defaults";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  const settings = getSettings(getDb());
  const chapterPercent = Math.round(settings.readinessChapterWeight * 1000) / 10;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          How progress is calculated. Activity weights are set per module, on each module page.
        </p>
      </header>

      <section aria-labelledby="formulas-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="formulas-heading" className="text-lg font-medium">
            Formulas
          </h2>
          <SettingsDialog
            readinessChapterPercent={chapterPercent}
            reviseAfterDays={settings.reviseAfterDays}
          />
        </div>
        <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground">Chapters share of readiness</dt>
            <dd>
              {chapterPercent}% chapters, {Math.round((100 - chapterPercent) * 10) / 10}% past
              papers
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Revise after</dt>
            <dd>{settings.reviseAfterDays} days</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="how-heading" className="space-y-3">
        <h2 id="how-heading" className="text-lg font-medium">
          How progress is calculated
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <strong>Chapter progress</strong> is a weighted average of its activities. Default
            weights:{" "}
            {DEFAULT_ACTIVITY_TYPES.map((t) => `${t.label.toLowerCase()} ${t.weight}`).join(", ")}.
            Weights are relative, so custom activities simply share the total. A ticked activity
            counts as complete; an unticked one that tracks counts earns done ÷ total.
          </li>
          <li>
            <strong>Module chapter progress</strong> is the plain average of its chapters.
          </li>
          <li>
            <strong>Past papers</strong> score as coverage (attempted ÷ logged) × the average score
            of the papers you have scored. An attempt with no score counts towards coverage only.
          </li>
          <li>
            <strong>Readiness</strong> blends chapters and past papers using the split above. With
            no past papers logged it is chapters alone, so it is not dragged down before you start.
          </li>
        </ul>
      </section>
    </div>
  );
}
