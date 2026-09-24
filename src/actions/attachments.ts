"use server";

import { getDb } from "@/db";
import { deleteAttachment } from "@/db/attachments";
import { uploadsDir } from "@/db/config";
import { deleteStored } from "@/lib/storage";
import { failure, guard, parseId, type ActionResult } from "./helpers";

export async function deleteAttachmentAction(id: number): Promise<ActionResult> {
  const attachmentId = parseId(id);
  if (!attachmentId) return failure("Invalid file");
  return guard(() => {
    const row = deleteAttachment(getDb(), attachmentId);
    deleteStored(uploadsDir, [row.path]);
    return undefined;
  });
}
