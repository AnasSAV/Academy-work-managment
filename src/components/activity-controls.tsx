"use client";

import { Minus, Pencil, Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  adjustRevisionAction,
  setActivityCountsAction,
  setActivityDoneAction,
  updateChapterDetailsAction,
} from "@/actions/activities";
import { Field, FormDialog, SelectField } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ActivityCheckboxProps {
  chapterId: number;
  activityTypeId: number;
  label: string;
  done: boolean;
  /** Smaller pill for the chapter list. */
  compact?: boolean;
}

/** Tick box that updates instantly and rolls back if the server rejects the change. */
export function ActivityCheckbox({
  chapterId,
  activityTypeId,
  label,
  done,
  compact,
}: ActivityCheckboxProps) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.checked;
    startTransition(async () => {
      setOptimisticDone(next);
      const result = await setActivityDoneAction(chapterId, activityTypeId, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <label
      className={cn(
        "hover:bg-muted has-[:checked]:bg-primary/10 has-[:checked]:border-primary/40 inline-flex cursor-pointer items-center gap-1.5 rounded-md border transition-colors select-none",
        compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
      )}
    >
      <input
        type="checkbox"
        checked={optimisticDone}
        onChange={onChange}
        className="accent-primary size-3.5"
      />
      {label}
    </label>
  );
}

interface CountsFormProps {
  chapterId: number;
  activityTypeId: number;
  countDone: number | null;
  countTotal: number | null;
}

/** "12 / 40" style progress for an activity such as questions. */
export function CountsForm({ chapterId, activityTypeId, countDone, countTotal }: CountsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await setActivityCountsAction(chapterId, activityTypeId, formData);
      if (result.ok) {
        setError(null);
        toast.success("Counts saved");
      } else {
        setError(result.fieldErrors?.countDone ?? result.fieldErrors?.countTotal ?? result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
      <div className="grid gap-1">
        <Label htmlFor={`done-${activityTypeId}`} className="text-xs">
          Done
        </Label>
        <Input
          id={`done-${activityTypeId}`}
          name="countDone"
          type="number"
          min={0}
          inputMode="numeric"
          defaultValue={countDone ?? ""}
          className="w-20"
          aria-invalid={!!error}
        />
      </div>
      <span className="text-muted-foreground pb-1.5">/</span>
      <div className="grid gap-1">
        <Label htmlFor={`total-${activityTypeId}`} className="text-xs">
          Total
        </Label>
        <Input
          id={`total-${activityTypeId}`}
          name="countTotal"
          type="number"
          min={0}
          inputMode="numeric"
          defaultValue={countTotal ?? ""}
          className="w-20"
          aria-invalid={!!error}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive w-full text-xs">
          {error}
        </p>
      )}
    </form>
  );
}

/** Repeated revisions: log another one, or undo a mistaken one. */
export function RevisionControls({ chapterId, count }: { chapterId: number; count: number }) {
  const [pending, startTransition] = useTransition();

  function adjust(delta: 1 | -1) {
    startTransition(async () => {
      const result = await adjustRevisionAction(chapterId, delta);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm tabular-nums" aria-live="polite">
        {count === 0 ? "Not revised yet" : count === 1 ? "Revised once" : `Revised ${count} times`}
      </span>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => adjust(1)}>
        <Plus /> Log revision
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Undo last revision"
        disabled={pending || count === 0}
        onClick={() => adjust(-1)}
      >
        <Minus />
      </Button>
    </div>
  );
}

interface ChapterDetailsDialogProps {
  chapter: {
    id: number;
    confidence: number | null;
    lastReviewedAt: string | null;
    note: string | null;
    onenoteUrl: string | null;
  };
}

const CONFIDENCE_OPTIONS = [
  { value: "", label: "Not rated" },
  { value: "1", label: "1 – shaky" },
  { value: "2", label: "2" },
  { value: "3", label: "3 – okay" },
  { value: "4", label: "4" },
  { value: "5", label: "5 – confident" },
];

export function ChapterDetailsDialog({ chapter }: ChapterDetailsDialogProps) {
  return (
    <FormDialog
      title="Chapter details"
      triggerLabel={
        <>
          <Pencil /> Edit details
        </>
      }
      triggerVariant="outline"
      successMessage="Details saved"
      className="sm:max-w-lg"
      action={(formData) => updateChapterDetailsAction(chapter.id, formData)}
    >
      <SelectField
        name="confidence"
        label="Confidence"
        options={CONFIDENCE_OPTIONS}
        defaultValue={chapter.confidence?.toString() ?? ""}
        hint="How well you feel you know this chapter."
      />
      <Field
        name="lastReviewedAt"
        label="Last reviewed"
        type="date"
        defaultValue={chapter.lastReviewedAt ?? ""}
        hint="Logging a revision sets this to today."
      />
      <Field
        name="onenoteUrl"
        label="OneNote link"
        type="url"
        placeholder="https://… or onenote:…"
        defaultValue={chapter.onenoteUrl ?? ""}
      />
      <Field name="note" label="Note" multiline rows={4} defaultValue={chapter.note ?? ""} />
    </FormDialog>
  );
}
