"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSemesterAction, updateSemesterAction } from "@/actions/semesters";
import { Field, FormDialog } from "@/components/form-dialog";

interface SemesterDialogProps {
  /** Pass a semester to edit it; omit to create a new one. */
  semester?: { id: number; name: string; startDate: string | null; endDate: string | null };
}

export function SemesterDialog({ semester }: SemesterDialogProps) {
  const router = useRouter();

  return (
    <FormDialog
      title={semester ? "Edit semester" : "Add semester"}
      triggerLabel={
        semester ? (
          <>
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add semester
          </>
        )
      }
      triggerVariant={semester ? "outline" : "default"}
      submitLabel={semester ? "Save changes" : "Add semester"}
      successMessage={semester ? "Semester updated" : "Semester added"}
      action={(formData) =>
        semester ? updateSemesterAction(semester.id, formData) : createSemesterAction(formData)
      }
      onSuccess={(data) => {
        if (data) router.push(`/semesters/${data.id}`);
      }}
    >
      <Field name="name" label="Name" defaultValue={semester?.name} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Field
          name="startDate"
          label="Start date"
          type="date"
          defaultValue={semester?.startDate ?? ""}
        />
        <Field name="endDate" label="End date" type="date" defaultValue={semester?.endDate ?? ""} />
      </div>
    </FormDialog>
  );
}
