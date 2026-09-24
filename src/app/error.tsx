"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/** Shown when a page throws. Your data is not affected: nothing here writes to it. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        This page could not be shown. Your data is safe. Try again, or go back to the dashboard.
      </p>
      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">Reference: {error.digest}</p>
      )}
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Dashboard
        </Link>
      </div>
    </div>
  );
}
