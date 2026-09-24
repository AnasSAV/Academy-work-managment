import { Download, File as FileIcon, FileImage, FileText } from "lucide-react";
import Link from "next/link";
import { getDb } from "@/db";
import { listAttachments, type OwnerType } from "@/db/attachments";
import { maxUploadBytes } from "@/db/config";
import { AttachmentUpload } from "@/components/attachment-upload";
import { DeleteAttachmentButton } from "@/components/delete-attachment-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { KIND_LABELS, kindOptions, type AttachmentKind } from "@/lib/attachment-kinds";
import { formatBytes, formatTimestamp } from "@/lib/format";

interface AttachmentsPanelProps {
  ownerType: OwnerType;
  ownerId: number;
  /** Kinds offered in the upload form. */
  kinds: AttachmentKind[];
  /** Kind pre-selected in the upload form. */
  defaultKind: AttachmentKind;
  heading?: string;
  description?: string;
}

function FileTypeIcon({ mime }: { mime: string }) {
  const cls = "text-muted-foreground size-4 shrink-0";
  if (mime.startsWith("image/")) return <FileImage className={cls} aria-hidden />;
  if (mime === "application/pdf" || mime.startsWith("text/")) {
    return <FileText className={cls} aria-hidden />;
  }
  return <FileIcon className={cls} aria-hidden />;
}

/** Lists the files attached to something and lets you upload more. Reads its own data. */
export function AttachmentsPanel({
  ownerType,
  ownerId,
  kinds,
  defaultKind,
  heading = "Files",
  description,
}: AttachmentsPanelProps) {
  const files = listAttachments(getDb(), ownerType, ownerId);
  const headingId = `files-${ownerType}-${ownerId}`;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <h2 id={headingId} className="text-lg font-medium">
          {heading}
        </h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>

      {files.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
          No files yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
              <FileTypeIcon mime={file.mime} />
              <Link
                href={`/files/${file.id}`}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
                title={file.originalName}
              >
                {file.originalName}
              </Link>
              <Badge variant="secondary">{KIND_LABELS[file.kind]}</Badge>
              <span className="text-muted-foreground text-right text-xs whitespace-nowrap tabular-nums">
                {formatBytes(file.size)}
                {formatTimestamp(file.createdAt) ? ` · ${formatTimestamp(file.createdAt)}` : ""}
              </span>
              <a
                href={`/api/attachments/${file.id}?download=1`}
                download={file.originalName}
                aria-label={`Download ${file.originalName}`}
                className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
              >
                <Download />
              </a>
              <DeleteAttachmentButton id={file.id} name={file.originalName} />
            </li>
          ))}
        </ul>
      )}

      <AttachmentUpload
        // Remount when the default changes (e.g. once an outline exists), or the select keeps its old value.
        key={defaultKind}
        ownerType={ownerType}
        ownerId={ownerId}
        kinds={kindOptions(kinds)}
        defaultKind={defaultKind}
        maxBytes={maxUploadBytes}
      />
    </section>
  );
}
