"use client";

import { Pencil, Plus } from "lucide-react";
import { createModuleAction, updateModuleAction } from "@/actions/modules";
import { Field, FormDialog } from "@/components/form-dialog";
import { useRouter } from "next/navigation";

export interface ModuleFormValues {
  id: number;
  name: string;
  code: string | null;
  credits: number | null;
  lecturers: string | null;
  color: string;
  targetGrade: number | null;
  examDate: string | null;
  notes: string | null;
}

interface ModuleDialogProps {
  /** Pass a module to edit it; omit to create one in `semesterId`. */
  existing?: ModuleFormValues;
  semesterId: number;
  /** Colour pre-selected when creating a module. */
  defaultColor: string;
}

export function ModuleDialog({ existing, semesterId, defaultColor }: ModuleDialogProps) {
  const router = useRouter();

  return (
    <FormDialog
      title={existing ? "Edit module" : "Add module"}
      triggerLabel={
        existing ? (
          <>
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add module
          </>
        )
      }
      triggerVariant={existing ? "outline" : "default"}
      submitLabel={existing ? "Save changes" : "Add module"}
      successMessage={existing ? "Module updated" : "Module added"}
      className="sm:max-w-lg"
      action={(formData) =>
        existing
          ? updateModuleAction(existing.id, formData)
          : createModuleAction(semesterId, formData)
      }
      onSuccess={(data) => {
        if (data) router.push(`/modules/${data.id}`);
      }}
    >
      <Field name="name" label="Name" defaultValue={existing?.name} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Field name="code" label="Code" defaultValue={existing?.code ?? ""} />
        <Field
          name="credits"
          label="Credits"
          type="number"
          step="0.5"
          min="0"
          defaultValue={existing?.credits ?? ""}
        />
      </div>
      <Field
        name="lecturers"
        label="Lecturers"
        hint="Free text, e.g. NdS, RTU, AF"
        defaultValue={existing?.lecturers ?? ""}
      />
      <div className="grid grid-cols-[auto_1fr_1fr] items-start gap-3">
        <Field
          name="color"
          label="Colour"
          type="color"
          className="h-8 w-14 cursor-pointer p-1"
          defaultValue={existing?.color ?? defaultColor}
        />
        <Field
          name="targetGrade"
          label="Target grade (%)"
          type="number"
          step="0.1"
          min="0"
          max="100"
          defaultValue={existing?.targetGrade ?? ""}
        />
        <Field
          name="examDate"
          label="Exam date"
          type="date"
          defaultValue={existing?.examDate ?? ""}
        />
      </div>
      <Field name="notes" label="Notes" multiline defaultValue={existing?.notes ?? ""} />
    </FormDialog>
  );
}
