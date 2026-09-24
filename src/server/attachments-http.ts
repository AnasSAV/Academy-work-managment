import fs from "node:fs";
import { Readable } from "node:stream";
import { z } from "zod";
import { createAttachment, getAttachment, ownerExists } from "@/db/attachments";
import type { Db } from "@/db";
import { ATTACHMENT_KINDS, ATTACHMENT_OWNER_TYPES } from "@/db/schema";
import { deleteStored, isInlineType, resolveStored, saveUpload } from "@/lib/storage";
import { parseInput } from "@/lib/validation/parse";

/**
 * HTTP handling for uploads and downloads, kept free of Next.js so it can be tested with plain
 * Request objects. The route files in src/app/api/attachments only supply the dependencies.
 */

export interface HttpContext {
  db: Db;
  /** Uploads root directory. */
  root: string;
  maxBytes: number;
}

/** Multipart framing and the other form fields add a little on top of the file itself. */
const MULTIPART_OVERHEAD = 64 * 1024;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Route handlers have no CSRF protection of their own, and a web page can POST a multipart form
 * to localhost from another site. Browsers always send Origin on such a request, so reject one
 * that does not match this host. Clients that send no Origin (scripts, tests) are not browsers.
 */
export function isSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const uploadFields = z.object({
  ownerType: z.enum(ATTACHMENT_OWNER_TYPES, { error: "Unknown owner type" }),
  ownerId: z.coerce.number({ error: "Invalid owner" }).int().positive("Invalid owner"),
  kind: z.enum(ATTACHMENT_KINDS, { error: "Unknown file kind" }),
});

const megabytes = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

export async function handleUpload(request: Request, ctx: HttpContext): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Cross-origin uploads are not allowed" }, 403);

  const declared = Number(request.headers.get("content-length"));
  if (declared > ctx.maxBytes + MULTIPART_OVERHEAD) {
    return json({ error: `File is larger than ${megabytes(ctx.maxBytes)} MB` }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Could not read the upload" }, 400);
  }

  const fields = parseInput(uploadFields, {
    ownerType: form.get("ownerType"),
    ownerId: form.get("ownerId"),
    kind: form.get("kind") ?? "other",
  });
  if (!fields.ok) return json({ error: fields.error }, 400);

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a file to upload" }, 400);
  if (file.size === 0) return json({ error: "That file is empty" }, 400);
  if (file.size > ctx.maxBytes) {
    return json({ error: `File is larger than ${megabytes(ctx.maxBytes)} MB` }, 413);
  }

  const { ownerType, ownerId, kind } = fields.data;
  if (!ownerExists(ctx.db, ownerType, ownerId)) return json({ error: "Owner not found" }, 404);

  const saved = saveUpload(ctx.root, ownerType, ownerId, {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  try {
    const row = createAttachment(ctx.db, {
      ownerType,
      ownerId,
      kind,
      path: saved.path,
      originalName: saved.originalName,
      mime: saved.mime,
      size: saved.size,
    });
    return json(row, 201);
  } catch (error) {
    deleteStored(ctx.root, [saved.path]);
    console.error(error);
    return json({ error: "Could not save the file" }, 500);
  }
}

/** Parse a single `Range: bytes=...` header. Returns null when it cannot be satisfied. */
export function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}

function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function handleFile(
  request: Request,
  id: number,
  ctx: HttpContext,
): Promise<Response> {
  const row = getAttachment(ctx.db, id);
  if (!row) return json({ error: "File not found" }, 404);

  let absolute: string;
  let size: number;
  try {
    absolute = resolveStored(ctx.root, row.path);
    size = fs.statSync(absolute).size;
  } catch {
    return json({ error: "The file is missing from disk" }, 404);
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline = isInlineType(row.mime) && !download;

  const headers = new Headers({
    "Content-Type": row.mime,
    "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", row.originalName),
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=300",
  });
  // Images cannot run script when shown, but a direct visit should be locked down as well.
  // (Not applied to PDFs: the browser's PDF viewer does not work inside a sandbox.)
  if (row.mime.startsWith("image/")) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    );
  }

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, size) : null;
  if (rangeHeader && !range) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  headers.set("Content-Length", String(size === 0 ? 0 : end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });

  const stream = fs.createReadStream(absolute, size === 0 ? undefined : { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  });
}
