"use client";

import { BookCheck, CheckCheck, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  adjustRevisionAction,
  completeChapterAction,
  setActivityDoneAction,
} from "@/actions/activities";
import type { ActionResult } from "@/actions/helpers";
import { Button } from "@/components/ui/button";
import type { BoardStatus } from "@/lib/study";

function useRun() {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  return { pending, run };
}

/** Log a revision: counts towards Revised, stamps the review date, and pushes the next one out. */
export function LogRevisionButton({
  chapterId,
  title,
  size = "sm",
}: {
  chapterId: number;
  title: string;
  size?: "sm" | "xs";
}) {
  const { pending, run } = useRun();
  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      aria-label={`Log a revision of ${title}`}
      onClick={() => run(() => adjustRevisionAction(chapterId, 1), "Revision logged")}
    >
      <RotateCcw /> {pending ? "Logging…" : "Log revision"}
    </Button>
  );
}

/**
 * The one forward step for a board card. A card's column comes from what is ticked, so it moves
 * by ticking: learned, then revised, then everything. Going back is done on the chapter page.
 */
export function AdvanceButton({
  chapterId,
  title,
  status,
  learnedTypeId,
}: {
  chapterId: number;
  title: string;
  status: BoardStatus;
  learnedTypeId: number | null;
}) {
  const { pending, run } = useRun();

  if (status === "to_learn") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending || learnedTypeId === null}
        aria-label={`Mark ${title} as learned`}
        onClick={() =>
          run(
            () => setActivityDoneAction(chapterId, learnedTypeId as number, true),
            "Marked as learned",
          )
        }
      >
        <BookCheck /> Mark learned
      </Button>
    );
  }
  if (status === "learning") {
    return <LogRevisionButton chapterId={chapterId} title={title} />;
  }
  if (status === "revising") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={`Mark ${title} as complete`}
        onClick={() => run(() => completeChapterAction(chapterId), "Chapter complete")}
      >
        <CheckCheck /> Mark complete
      </Button>
    );
  }
  return <LogRevisionButton chapterId={chapterId} title={title} />;
}
