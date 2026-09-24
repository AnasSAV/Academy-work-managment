import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Local file storage under one root directory (data/uploads by default). Files are stored under a
 * random name so the original name never touches the file system; the original name lives in the
 * database. Nothing here trusts a client-supplied type: the type comes from the extension and is
 * cross-checked against the file's first bytes.
 */

export const OCTET_STREAM = "application/octet-stream";

/** Types the browser may display inline. Everything else is offered as a download only. */
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  // SVG can carry scripts, so it is stored and downloadable but never shown inline.
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

export function isInlineType(mime: string): boolean {
  return INLINE_TYPES.has(mime);
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/** The inline-capable type these bytes really are, or null. */
export function sniffInlineType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif"; // GIF8
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Decide the stored type. An extension that claims an inline type must be backed by matching
 * bytes, otherwise the file is stored as an opaque download (a renamed HTML file is not a PDF).
 * A file with no known extension is identified from its bytes when possible.
 */
export function detectMime(fileName: string, head: Uint8Array): string {
  const claimed = MIME_BY_EXT[extensionOf(fileName)];
  const sniffed = sniffInlineType(head);
  if (claimed) {
    if (!isInlineType(claimed)) return claimed;
    return sniffed === claimed ? claimed : OCTET_STREAM;
  }
  return sniffed ?? OCTET_STREAM;
}

/** Strip paths and characters that are unsafe or confusing in a file name shown to the user. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const trimmed = cleaned.length > 150 ? cleanLongName(cleaned) : cleaned;
  return trimmed && trimmed !== "." && trimmed !== ".." ? trimmed : "file";
}

function cleanLongName(name: string): string {
  const ext = path.extname(name);
  const keepExt = ext.length <= 10 ? ext : "";
  return name.slice(0, 150 - keepExt.length) + keepExt;
}

export function extensionOf(fileName: string): string {
  const ext = path.extname(sanitizeFileName(fileName)).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

/** Resolve a stored relative path inside `root`, refusing anything that escapes it. */
export function resolveStored(root: string, relativePath: string): string {
  const base = path.resolve(root);
  const absolute = path.resolve(base, relativePath);
  if (absolute !== base && !absolute.startsWith(base + path.sep)) {
    throw new Error("Path is outside the uploads directory");
  }
  return absolute;
}

export interface SavedFile {
  /** Path relative to the uploads root. */
  path: string;
  mime: string;
  size: number;
  originalName: string;
}

export function saveUpload(
  root: string,
  ownerType: string,
  ownerId: number,
  file: { name: string; bytes: Uint8Array },
): SavedFile {
  const originalName = sanitizeFileName(file.name);
  const mime = detectMime(originalName, file.bytes.subarray(0, 16));
  // With no usable extension but a recognised type, give the stored file a matching one.
  const ext =
    extensionOf(originalName) || Object.entries(MIME_BY_EXT).find(([, m]) => m === mime)?.[0] || "";
  const relativePath = `${ownerType}/${ownerId}/${crypto.randomUUID()}${ext}`;
  const absolute = resolveStored(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, file.bytes, { flag: "wx" });
  return { path: relativePath, mime, size: file.bytes.byteLength, originalName };
}

/** Delete stored files and tidy up emptied folders. Never throws: a missing file is fine. */
export function deleteStored(root: string, relativePaths: string[]): void {
  for (const rel of relativePaths) {
    try {
      const absolute = resolveStored(root, rel);
      fs.rmSync(absolute, { force: true });
      // Remove the owner folder (and its type folder) if now empty; rmdir fails when not empty.
      for (const dir of [path.dirname(absolute), path.dirname(path.dirname(absolute))]) {
        if (path.resolve(dir) === path.resolve(root)) break;
        try {
          fs.rmdirSync(dir);
        } catch {
          break;
        }
      }
    } catch (error) {
      console.error(`Could not delete stored file ${rel}`, error);
    }
  }
}
