"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { loadStarterDataAction } from "@/actions/seed";
import { Button } from "@/components/ui/button";

export function StarterDataButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await loadStarterDataAction();
          if (result.ok) toast.success("Loaded Semester 07");
          else toast.error(result.error);
        })
      }
    >
      {pending ? "Loading…" : "Load Semester 07 starter data"}
    </Button>
  );
}
