"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { createTagAction, deleteTagAction, updateTagAction } from "@/actions/assessments";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field, FormDialog } from "@/components/form-dialog";

interface TagDialogProps {
  moduleId: number;
  /** Pass a tag to edit it; omit to add one. */
  tag?: { id: number; name: string; description: string | null };
}

export function TagDialog({ moduleId, tag }: TagDialogProps) {
  return (
    <FormDialog
      title={tag ? `Edit tag "${tag.name}"` : "Add tag"}
      description="Tags label assessments in this module. The description says what the tag means."
      triggerLabel={
        tag ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Add tag
          </>
        )
      }
      triggerVariant={tag ? "ghost" : "outline"}
      triggerSize={tag ? "icon-xs" : "sm"}
      triggerAriaLabel={tag ? `Edit tag ${tag.name}` : undefined}
      submitLabel={tag ? "Save" : "Add tag"}
      successMessage={tag ? "Tag updated" : "Tag added"}
      action={(formData) =>
        tag ? updateTagAction(tag.id, formData) : createTagAction(moduleId, formData)
      }
    >
      <Field
        name="name"
        label="Name"
        defaultValue={tag?.name}
        placeholder="e.g. * or online"
        required
        autoFocus
      />
      <Field
        name="description"
        label="Meaning"
        defaultValue={tag?.description ?? ""}
        placeholder="e.g. Takes place in class"
      />
    </FormDialog>
  );
}

export function DeleteTagButton({ id, name, usage }: { id: number; name: string; usage: number }) {
  return (
    <ConfirmDelete
      subject={`tag "${name}"`}
      impact={[]}
      triggerLabel={<Trash2 />}
      triggerSize="icon-xs"
      triggerAriaLabel={`Delete tag ${name}`}
      successMessage="Tag deleted"
      action={() => deleteTagAction(id)}
      note={
        usage > 0
          ? `It will be removed from ${usage} ${usage === 1 ? "assessment" : "assessments"}. The assessments stay.`
          : undefined
      }
    />
  );
}
