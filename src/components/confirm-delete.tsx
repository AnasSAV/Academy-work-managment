"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/helpers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteProps<T> {
  /** What is being deleted, e.g. `module "Advanced ML"`. */
  subject: string;
  /** What else will go with it, e.g. ["10 chapters", "3 assessments"]. Empty items are skipped. */
  impact?: string[];
  /** Replaces the default "also deletes ..." sentence when the delete has a different effect. */
  note?: string;
  triggerLabel: ReactNode;
  triggerVariant?: "destructive" | "ghost" | "outline";
  triggerSize?: "default" | "sm" | "xs" | "icon" | "icon-sm" | "icon-xs";
  triggerAriaLabel?: string;
  successMessage?: string;
  action: () => Promise<ActionResult<T>>;
  onDeleted?: (data: T) => void;
}

/** Delete button that asks for confirmation and lists what else will be removed. */
export function ConfirmDelete<T>({
  subject,
  impact = [],
  note,
  triggerLabel,
  triggerVariant = "ghost",
  triggerSize = "default",
  triggerAriaLabel,
  successMessage = "Deleted",
  action,
  onDeleted,
}: ConfirmDeleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const items = impact.filter(Boolean);

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(successMessage);
        setOpen(false);
        onDeleted?.(result.data);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant={triggerVariant} size={triggerSize} aria-label={triggerAriaLabel} />
        }
      >
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {subject}?</AlertDialogTitle>
          <AlertDialogDescription>
            {note ? (
              <>{note} This cannot be undone.</>
            ) : items.length > 0 ? (
              <>This also permanently deletes {items.join(", ")}. This cannot be undone.</>
            ) : (
              <>This cannot be undone.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
