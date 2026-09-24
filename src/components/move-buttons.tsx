"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/helpers";
import { Button } from "@/components/ui/button";

interface MoveButtonsProps {
  /** What is being moved, for accessible labels, e.g. "chapter 3". */
  label: string;
  onMove: (direction: "up" | "down") => Promise<ActionResult>;
  isFirst?: boolean;
  isLast?: boolean;
}

export function MoveButtons({ label, onMove, isFirst, isLast }: MoveButtonsProps) {
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const result = await onMove(direction);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${label} up`}
        disabled={pending || isFirst}
        onClick={() => move("up")}
      >
        <ChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${label} down`}
        disabled={pending || isLast}
        onClick={() => move("down")}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}
