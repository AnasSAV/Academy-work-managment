"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { createAssessmentAction, updateAssessmentAction } from "@/actions/assessments";
import { Field, FormDialog, SelectField } from "@/components/form-dialog";
import { Label } from "@/components/ui/label";
import { STATUS_LABELS, WORK_MODE_LABELS, type WorkMode } from "@/lib/assessments";

export interface AssessmentFormValues {
  id: number;
  name: string;
  lecturer: string | null;
  weight: number;
  dueDate: string | null;
  status: string;
  score: number | null;
  maxScore: number;
  workMode: WorkMode;
  groupSize: number | null;
  groupMembers: string | null;
  notes: string | null;
  tagIds: number[];
}

export interface TagOption {
  id: number;
  name: string;
  description: string | null;
}

interface AssessmentDialogProps {
  moduleId: number;
  tags: TagOption[];
  /** Pass an assessment to edit it; omit to add one. */
  assessment?: AssessmentFormValues;
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const MODE_OPTIONS = Object.entries(WORK_MODE_LABELS).map(([value, label]) => ({ value, label }));

function AssessmentFields({
  assessment,
  tags,
}: {
  assessment?: AssessmentFormValues;
  tags: TagOption[];
}) {
  const [mode, setMode] = useState<string>(assessment?.workMode ?? "unspecified");

  return (
    <>
      <Field
        name="name"
        label="Component name"
        defaultValue={assessment?.name}
        required
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <Field name="lecturer" label="Lecturer" defaultValue={assessment?.lecturer ?? ""} />
        <Field
          name="weight"
          label="Weight (%)"
          type="number"
          min="0"
          max="100"
          step="any"
          defaultValue={assessment?.weight ?? ""}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="dueDate"
          label="Due date"
          type="date"
          defaultValue={assessment?.dueDate ?? ""}
        />
        <SelectField
          name="status"
          label="Status"
          options={STATUS_OPTIONS}
          defaultValue={assessment?.status ?? "not_started"}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="score"
          label="Score"
          type="number"
          min="0"
          step="any"
          defaultValue={assessment?.score ?? ""}
          hint="Entering a score marks it graded."
        />
        <Field
          name="maxScore"
          label="Out of"
          type="number"
          min="0"
          step="any"
          defaultValue={assessment?.maxScore ?? 100}
        />
      </div>

      <SelectField
        name="workMode"
        label="Work mode"
        options={MODE_OPTIONS}
        defaultValue={mode}
        onValueChange={setMode}
      />
      {mode === "group" && (
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field
            name="groupSize"
            label="Group size"
            type="number"
            min="2"
            defaultValue={assessment?.groupSize ?? ""}
          />
          <Field
            name="groupMembers"
            label="Group members"
            defaultValue={assessment?.groupMembers ?? ""}
            hint="Optional note, e.g. names."
          />
        </div>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">Tags</legend>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {tags.map((tag) => (
              <Label
                key={tag.id}
                className="gap-1.5 font-normal"
                title={tag.description ?? undefined}
              >
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  defaultChecked={assessment?.tagIds.includes(tag.id)}
                  className="accent-primary size-4"
                />
                {tag.name}
              </Label>
            ))}
          </div>
        )}
        <Field
          name="newTags"
          label="New tags"
          hint="Separate with commas, e.g. online, proctored. Add what each one means under Tags."
        />
      </fieldset>

      <Field name="notes" label="Notes" multiline defaultValue={assessment?.notes ?? ""} />
    </>
  );
}

export function AssessmentDialog({ moduleId, tags, assessment }: AssessmentDialogProps) {
  return (
    <FormDialog
      title={assessment ? "Edit assessment" : "Add assessment"}
      triggerLabel={
        assessment ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Add assessment
          </>
        )
      }
      triggerVariant={assessment ? "ghost" : "default"}
      triggerSize={assessment ? "icon-xs" : "default"}
      triggerAriaLabel={assessment ? `Edit ${assessment.name}` : undefined}
      submitLabel={assessment ? "Save changes" : "Add assessment"}
      successMessage={assessment ? "Assessment updated" : "Assessment added"}
      className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
      action={(formData) =>
        assessment
          ? updateAssessmentAction(assessment.id, formData)
          : createAssessmentAction(moduleId, formData)
      }
    >
      <AssessmentFields assessment={assessment} tags={tags} />
    </FormDialog>
  );
}
