"use client";

import { Pencil } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addChaptersAction, renameChapterAction } from "@/actions/chapters";
import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RenameChapterDialog({ id, title }: { id: number; title: string }) {
  return (
    <FormDialog
      title="Rename chapter"
      triggerLabel={<Pencil />}
      triggerVariant="ghost"
      triggerSize="icon-xs"
      triggerAriaLabel={`Rename ${title}`}
      submitLabel="Save"
      successMessage="Chapter renamed"
      action={(formData) => renameChapterAction(id, formData)}
    >
      <Field name="title" label="Title" defaultValue={title} required autoFocus />
    </FormDialog>
  );
}

/** Quick-add: one chapter per line. Enter submits, Shift+Enter adds a line. */
export function AddChaptersForm({ moduleId }: { moduleId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await addChaptersAction(moduleId, formData);
      if (result.ok) {
        setError(null);
        form.reset();
        toast.success(
          result.data.count === 1 ? "Chapter added" : `${result.data.count} chapters added`,
        );
      } else {
        setError(result.fieldErrors?.lines ?? result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-2" noValidate>
      <Label htmlFor="add-chapters">Add chapters</Label>
      <div className="flex items-start gap-2">
        <Textarea
          id="add-chapters"
          name="lines"
          rows={2}
          placeholder="Chapter title (paste a list to add several, one per line)"
          aria-invalid={!!error}
          aria-describedby={error ? "add-chapters-error" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {error && (
        <p id="add-chapters-error" role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
