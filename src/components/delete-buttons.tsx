"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteChapterAction } from "@/actions/chapters";
import { deleteModuleAction } from "@/actions/modules";
import { deleteSemesterAction } from "@/actions/semesters";
import { ConfirmDelete } from "@/components/confirm-delete";

export function DeleteSemesterButton({
  id,
  name,
  impact,
}: {
  id: number;
  name: string;
  impact: string[];
}) {
  const router = useRouter();
  return (
    <ConfirmDelete
      subject={`semester "${name}"`}
      impact={impact}
      triggerLabel={
        <>
          <Trash2 /> Delete
        </>
      }
      triggerVariant="destructive"
      successMessage="Semester deleted"
      action={() => deleteSemesterAction(id)}
      onDeleted={() => router.push("/")}
    />
  );
}

export function DeleteModuleButton({
  id,
  name,
  impact,
}: {
  id: number;
  name: string;
  impact: string[];
}) {
  const router = useRouter();
  return (
    <ConfirmDelete
      subject={`module "${name}"`}
      impact={impact}
      triggerLabel={
        <>
          <Trash2 /> Delete
        </>
      }
      triggerVariant="destructive"
      successMessage="Module deleted"
      action={() => deleteModuleAction(id)}
      onDeleted={(data) => router.push(`/semesters/${data.semesterId}`)}
    />
  );
}

export function DeleteChapterButton({
  id,
  title,
  impact,
}: {
  id: number;
  title: string;
  impact: string[];
}) {
  return (
    <ConfirmDelete
      subject={`chapter "${title}"`}
      impact={impact}
      triggerLabel={<Trash2 />}
      triggerSize="icon-xs"
      triggerAriaLabel={`Delete ${title}`}
      successMessage="Chapter deleted"
      action={() => deleteChapterAction(id)}
    />
  );
}
