import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Academy Work Management</h1>
      <p className="text-muted-foreground">
        Local-first tracker for semesters, modules, chapters, past papers and assessments. The
        dashboard arrives in later milestones.
      </p>
      <div>
        <Button variant="outline">Get started</Button>
      </div>
    </main>
  );
}
