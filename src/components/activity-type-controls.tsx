"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createActivityTypeAction,
  deleteActivityTypeAction,
  updateActivityTypeAction,
} from "@/actions/activities";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CheckboxField, Field, FormDialog } from "@/components/form-dialog";

interface ActivityTypeDialogProps {
  moduleId: number;
  /** Pass an activity to edit it; omit to add a custom one. */
  activity?: { id: number; label: string; weight: number; tracksCounts: boolean; builtIn: boolean };
}

export function ActivityTypeDialog({ moduleId, activity }: ActivityTypeDialogProps) {
  return (
    <FormDialog
      title={activity ? `Edit "${activity.label}"` : "Add activity"}
      description="Weights are relative: each activity's share is its weight divided by the total."
      triggerLabel={
        activity ? (
          <>
            <Pencil />
          </>
        ) : (
          <>
            <Plus /> Add activity
          </>
        )
      }
      triggerVariant={activity ? "ghost" : "outline"}
      triggerSize={activity ? "icon-xs" : "sm"}
      triggerAriaLabel={activity ? `Edit ${activity.label}` : undefined}
      submitLabel={activity ? "Save" : "Add activity"}
      successMessage={activity ? "Activity updated" : "Activity added"}
      action={(formData) =>
        activity
          ? updateActivityTypeAction(activity.id, formData)
          : createActivityTypeAction(moduleId, formData)
      }
    >
      <Field name="label" label="Name" defaultValue={activity?.label} required autoFocus />
      <Field
        name="weight"
        label="Weight"
        type="number"
        min="0"
        step="any"
        defaultValue={activity?.weight ?? 10}
        required
      />
      <CheckboxField
        name="tracksCounts"
        label="Track done / total counts"
        hint={
          activity?.builtIn
            ? "Fixed for built-in activities."
            : "For things like questions or labs where you count how many are done."
        }
        defaultChecked={activity?.tracksCounts}
        disabled={activity?.builtIn}
      />
    </FormDialog>
  );
}

export function DeleteActivityTypeButton({
  id,
  label,
  records,
}: {
  id: number;
  label: string;
  records: number;
}) {
  return (
    <ConfirmDelete
      subject={`activity "${label}"`}
      impact={records > 0 ? [`${records} recorded ${records === 1 ? "tick" : "ticks"}`] : []}
      triggerLabel={<Trash2 />}
      triggerSize="icon-xs"
      triggerAriaLabel={`Delete ${label}`}
      successMessage="Activity deleted"
      action={() => deleteActivityTypeAction(id)}
    />
  );
}
