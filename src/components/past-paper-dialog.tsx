"use client";

import { Pencil, Plus } from "lucide-react";
import { createPastPaperAction, updatePastPaperAction } from "@/actions/past-papers";
import { CheckboxField, Field, FormDialog } from "@/components/form-dialog";

export interface PastPaperFormValues {
  id: number;
  title: string;
  year: number | null;
  attempted: boolean;
  score: number | null;
  maxScore: number | null;
  minutesTaken: number | null;
  attemptedAt: string | null;
  notes: string | null;
}

interface PastPaperDialogProps {
  moduleId: number;
  /** Pass a paper to edit it; omit to add one. */
  paper?: PastPaperFormValues;
}

export function PastPaperDialog({ moduleId, paper }: PastPaperDialogProps) {
  return (
    <FormDialog
      title={paper ? "Edit past paper" : "Add past paper"}
      triggerLabel={
        paper ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Add past paper
          </>
        )
      }
      triggerVariant={paper ? "ghost" : "default"}
      triggerSize={paper ? "icon-xs" : "default"}
      triggerAriaLabel={paper ? `Edit ${paper.title}` : undefined}
      submitLabel={paper ? "Save changes" : "Add past paper"}
      successMessage={paper ? "Past paper updated" : "Past paper added"}
      className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
      action={(formData) =>
        paper
          ? updatePastPaperAction(paper.id, formData)
          : createPastPaperAction(moduleId, formData)
      }
    >
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field
          name="title"
          label="Title"
          defaultValue={paper?.title}
          placeholder="e.g. 2024 Final exam"
          required
          autoFocus
        />
        <Field name="year" label="Year" type="number" defaultValue={paper?.year ?? ""} />
      </div>
      <CheckboxField
        name="attempted"
        label="I have attempted this paper"
        defaultChecked={paper?.attempted}
        hint="Recording a score also marks it attempted."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="score"
          label="Score"
          type="number"
          min="0"
          step="any"
          defaultValue={paper?.score ?? ""}
        />
        <Field
          name="maxScore"
          label="Out of"
          type="number"
          min="0"
          step="any"
          defaultValue={paper?.maxScore ?? ""}
          hint="Blank means 100."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="minutesTaken"
          label="Time taken (minutes)"
          type="number"
          min="0"
          defaultValue={paper?.minutesTaken ?? ""}
        />
        <Field
          name="attemptedAt"
          label="Date attempted"
          type="date"
          defaultValue={paper?.attemptedAt ?? ""}
        />
      </div>
      <Field name="notes" label="Notes" multiline defaultValue={paper?.notes ?? ""} />
    </FormDialog>
  );
}
