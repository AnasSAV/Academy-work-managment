import { Download } from "lucide-react";
import fs from "node:fs";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { describeOwner, getAttachment } from "@/db/attachments";
import { uploadsDir } from "@/db/config";
import { DeleteAttachmentButton } from "@/components/delete-attachment-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { KIND_LABELS } from "@/lib/attachment-kinds";
import { formatBytes, formatTimestamp } from "@/lib/format";
import { resolveStored } from "@/lib/storage";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function loadFile(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const file = getAttachment(db, id);
  if (!file) notFound();
  return { file, owner: describeOwner(db, file.ownerType, file.ownerId) };
}

export async function generateMetadata(props: PageProps<"/files/[id]">): Promise<Metadata> {
  const { file } = loadFile((await props.params).id);
  return { title: file.originalName };
}

export default async function FilePage(props: PageProps<"/files/[id]">) {
  const { file, owner } = loadFile((await props.params).id);
  const src = `/api/attachments/${file.id}`;

  let onDisk: boolean;
  try {
    onDisk = fs.existsSync(resolveStored(uploadsDir, file.path));
  } catch {
    onDisk = false;
  }

  const isPdf = file.mime === "application/pdf";
  const isImage = IMAGE_TYPES.includes(file.mime);
  const uploaded = formatTimestamp(file.createdAt);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <nav aria-label="Breadcrumb" className="text-muted-foreground flex gap-1.5 text-sm">
          <Link href={owner?.href ?? "/"} className="hover:underline">
            {owner?.label ?? "Semesters"}
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              {file.originalName}
            </h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{KIND_LABELS[file.kind]}</Badge>
              {formatBytes(file.size)}
              {uploaded && <span>· uploaded {uploaded}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`${src}?download=1`}
              download={file.originalName}
              className={buttonVariants({ variant: "outline" })}
            >
              <Download /> Download
            </a>
            <DeleteAttachmentButton
              id={file.id}
              name={file.originalName}
              redirectTo={owner?.href ?? "/"}
              withLabel
            />
          </div>
        </div>
      </header>

      {!onDisk ? (
        <p
          role="alert"
          className="text-destructive rounded-lg border border-dashed p-6 text-center text-sm"
        >
          This file is recorded, but it is missing from the uploads folder. Delete this entry and
          upload the file again.
        </p>
      ) : isPdf ? (
        <iframe src={src} title={file.originalName} className="h-[80vh] w-full rounded-lg border" />
      ) : isImage ? (
        <div className="bg-muted/40 flex justify-center rounded-lg border p-4">
          {/* A plain img: the file is served by the local API, so next/image adds nothing. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={file.originalName}
            className="max-h-[80vh] max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          This type of file cannot be previewed here. Use Download to open it in another app.
        </p>
      )}
    </div>
  );
}
