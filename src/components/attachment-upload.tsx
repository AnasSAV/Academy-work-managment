"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/format";

interface AttachmentUploadProps {
  ownerType: string;
  ownerId: number;
  kinds: { value: string; label: string }[];
  defaultKind: string;
  /** Files larger than this are refused before they are sent. */
  maxBytes: number;
}

/** Choose one or more files and upload them, one request per file. */
export function AttachmentUpload({
  ownerType,
  ownerId,
  kinds,
  defaultKind,
  maxBytes,
}: AttachmentUploadProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idBase = `${ownerType}-${ownerId}`;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    const kind = String(data.get("kind") ?? defaultKind);

    if (files.length === 0) return setError("Choose a file to upload");
    const tooBig = files.find((f) => f.size > maxBytes);
    if (tooBig) {
      return setError(
        `"${tooBig.name}" is ${formatBytes(tooBig.size)}; the limit is ${formatBytes(maxBytes)}`,
      );
    }
    setError(null);

    startTransition(async () => {
      const failures: string[] = [];
      let uploaded = 0;
      for (const [i, file] of files.entries()) {
        setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
        const body = new FormData();
        body.set("ownerType", ownerType);
        body.set("ownerId", String(ownerId));
        body.set("kind", kind);
        body.set("file", file);
        try {
          const res = await fetch("/api/attachments", { method: "POST", body });
          if (res.ok) {
            uploaded++;
          } else {
            const message = (await res.json().catch(() => null))?.error ?? res.statusText;
            failures.push(`${file.name}: ${message}`);
          }
        } catch {
          failures.push(`${file.name}: network error`);
        }
      }
      setProgress(null);
      if (uploaded > 0) {
        toast.success(uploaded === 1 ? "File uploaded" : `${uploaded} files uploaded`);
        form.reset();
        router.refresh();
      }
      if (failures.length > 0) setError(failures.join("\n"));
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2" noValidate>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-52 flex-1 gap-1">
          <Label htmlFor={`${idBase}-file`}>Add files</Label>
          <input
            id={`${idBase}-file`}
            name="file"
            type="file"
            multiple
            aria-invalid={!!error}
            className="border-input file:bg-muted file:text-foreground h-8 w-full rounded-lg border text-sm file:mr-3 file:h-full file:border-0 file:px-3 file:text-sm file:font-medium"
          />
        </div>
        {kinds.length > 1 && (
          <div className="grid gap-1">
            <Label htmlFor={`${idBase}-kind`}>Type</Label>
            <select
              id={`${idBase}-kind`}
              name="kind"
              defaultValue={defaultKind}
              className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {kinds.length === 1 && <input type="hidden" name="kind" value={kinds[0].value} />}
        <Button type="submit" disabled={pending}>
          <Upload /> {progress ?? "Upload"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">Up to {formatBytes(maxBytes)} per file.</p>
      {error && (
        <p role="alert" className="text-destructive text-sm whitespace-pre-line">
          {error}
        </p>
      )}
    </form>
  );
}
