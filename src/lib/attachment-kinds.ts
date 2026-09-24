import type { Attachment } from "@/db/schema";

export type AttachmentKind = Attachment["kind"];

export const KIND_LABELS: Record<AttachmentKind, string> = {
  outline: "Module outline",
  slides: "Slides",
  notes: "Notes",
  past_paper: "Past paper",
  marking_scheme: "Marking scheme",
  other: "Other",
};

export const kindOptions = (kinds: AttachmentKind[]) =>
  kinds.map((value) => ({ value, label: KIND_LABELS[value] }));
