import { getDb } from "@/db";
import { maxUploadBytes, uploadsDir } from "@/db/config";
import { handleFile } from "@/server/attachments-http";

async function serve(request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "File not found" }, { status: 404 });
  return handleFile(request, id, { db: getDb(), root: uploadsDir, maxBytes: maxUploadBytes });
}

export const GET = serve;
export const HEAD = serve;
