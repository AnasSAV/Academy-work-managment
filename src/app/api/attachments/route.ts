import { getDb } from "@/db";
import { maxUploadBytes, uploadsDir } from "@/db/config";
import { handleUpload } from "@/server/attachments-http";

export async function POST(request: Request) {
  return handleUpload(request, { db: getDb(), root: uploadsDir, maxBytes: maxUploadBytes });
}
