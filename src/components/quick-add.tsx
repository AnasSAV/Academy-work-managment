"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createAssessmentAction } from "@/actions/assessments";
import { addChaptersAction } from "@/actions/chapters";
import type { ActionResult } from "@/actions/helpers";
import { createPastPaperAction } from "@/actions/past-papers";
import { Field, FormDialog, SelectField } from "@/components/form-dialog";

export interface QuickAddModule {
  id: number;
  name: string;
  semesterName: string;
}

const TYPES = [
  { value: "chapters", label: "Chapters" },
  { value: "assessment", label: "Assessment" },
  { value: "paper", label: "Past paper" },
];

const SUCCESS: Record<string, string> = {
  chapters: "Chapters added",
  assessment: "Assessment added",
  paper: "Past paper added",
};

/** Route the form to the right action. The field names match the full forms, so validation is shared. */
async function submit(formData: FormData): Promise<ActionResult<unknown>> {
  const type = String(formData.get("type"));
  const moduleId = Number(formData.get("moduleId"));
  if (!Number.isInteger(moduleId)) return { ok: false, error: "Choose a module" };
  if (type === "chapters") return addChaptersAction(moduleId, formData);
  if (type === "assessment") return createAssessmentAction(moduleId, formData);
  if (type === "paper") return createPastPaperAction(moduleId, formData);
  return { ok: false, error: "Choose what to add" };
}

function QuickAddFields({ modules }: { modules: QuickAddModule[] }) {
  const pathname = usePathname();
  const [type, setType] = useState("chapters");
  // Start on the module you are looking at, if any.
  const fromPath = /^\/modules\/(\d+)/.exec(pathname)?.[1];
  const defaultModule = modules.find((m) => String(m.id) === fromPath)?.id ?? modules[0]?.id;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="type"
          label="Add"
          options={TYPES}
          defaultValue={type}
          onValueChange={setType}
        />
        <SelectField
          name="moduleId"
          label="To module"
          options={modules.map((m) => ({
            value: String(m.id),
            label: `${m.name} (${m.semesterName})`,
          }))}
          defaultValue={String(defaultModule)}
        />
      </div>

      {type === "chapters" && (
        <Field
          name="lines"
          label="Chapter titles"
          multiline
          rows={4}
          autoFocus
          placeholder={"One per line, e.g.\n11 Wireless Networks\n12 Network Security"}
        />
      )}
      {type === "assessment" && (
        <>
          <Field name="name" label="Component name" required autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="weight"
              label="Weight (%)"
              type="number"
              min="0"
              max="100"
              step="any"
              required
            />
            <Field name="dueDate" label="Due date" type="date" />
          </div>
          <p className="text-muted-foreground text-xs">
            Add the score, work mode and tags later from the module&apos;s Assessments tab.
          </p>
        </>
      )}
      {type === "paper" && (
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field name="title" label="Title" required autoFocus placeholder="e.g. 2024 Final" />
          <Field name="year" label="Year" type="number" />
        </div>
      )}
    </>
  );
}

export function QuickAddDialog({
  modules,
  open,
  onOpenChange,
}: {
  modules: QuickAddModule[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog
      title="Quick add"
      description={
        modules.length === 0
          ? "Add a semester and a module first, then you can add things to it here."
          : "Add something to a module without leaving this page."
      }
      open={open}
      onOpenChange={onOpenChange}
      submitLabel="Add"
      action={async (formData) => {
        const result = await submit(formData);
        if (result.ok) {
          toast.success(SUCCESS[String(formData.get("type"))] ?? "Added");
        }
        return result;
      }}
      className="sm:max-w-md"
    >
      {modules.length === 0 ? null : <QuickAddFields modules={modules} />}
    </FormDialog>
  );
}
