"use client";

import { Pencil } from "lucide-react";
import { updateSettingsAction } from "@/actions/settings";
import { Field, FormDialog } from "@/components/form-dialog";

interface SettingsDialogProps {
  readinessChapterPercent: number;
  reviseAfterDays: number;
}

export function SettingsDialog({ readinessChapterPercent, reviseAfterDays }: SettingsDialogProps) {
  return (
    <FormDialog
      title="Edit formula settings"
      triggerLabel={
        <>
          <Pencil /> Edit
        </>
      }
      triggerVariant="outline"
      successMessage="Settings saved"
      action={updateSettingsAction}
    >
      <Field
        name="readinessChapterPercent"
        label="Chapters share of readiness (%)"
        type="number"
        min="0"
        max="100"
        step="any"
        defaultValue={readinessChapterPercent}
        hint="The rest comes from past papers."
        required
      />
      <Field
        name="reviseAfterDays"
        label="Revise after (days)"
        type="number"
        min="1"
        max="365"
        defaultValue={reviseAfterDays}
        hint="A chapter counts as due for revision after this many days without review."
        required
      />
    </FormDialog>
  );
}
