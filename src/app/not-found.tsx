import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">We could not find that page</h1>
      <p className="text-muted-foreground text-sm">
        It may have been deleted, or the link may be out of date.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to the dashboard
      </Link>
    </div>
  );
}
