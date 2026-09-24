"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteAttachmentAction } from "@/actions/attachments";
import { ConfirmDelete } from "@/components/confirm-delete";

interface DeleteAttachmentButtonProps {
  id: number;
  name: string;
  /** Where to go afterwards (used on the viewer page, whose file no longer exists). */
  redirectTo?: string;
  withLabel?: boolean;
}

export function DeleteAttachmentButton({
  id,
  name,
  redirectTo,
  withLabel,
}: DeleteAttachmentButtonProps) {
  const router = useRouter();
  return (
    <ConfirmDelete
      subject={`file "${name}"`}
      triggerLabel={
        withLabel ? (
          <>
            <Trash2 /> Delete
          </>
        ) : (
          <Trash2 />
        )
      }
      triggerVariant={withLabel ? "destructive" : "ghost"}
      triggerSize={withLabel ? "default" : "icon-xs"}
      triggerAriaLabel={withLabel ? undefined : `Delete ${name}`}
      successMessage="File deleted"
      action={() => deleteAttachmentAction(id)}
      onDeleted={() => {
        if (redirectTo) router.push(redirectTo);
      }}
    />
  );
}
