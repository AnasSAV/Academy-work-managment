"use client";

import { Keyboard, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QuickAddDialog, type QuickAddModule } from "@/components/quick-add";
import { ThemeToggle, nextThemeFromCurrent } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GO_TIMEOUT_MS, SHORTCUT_HELP, handleKey } from "@/lib/shortcuts";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[11px]">
      {children}
    </kbd>
  );
}

/**
 * Sidebar tools (quick add, shortcut help, theme) and the global keyboard shortcuts. The key
 * listener lives here so it works on every page, even while the sidebar is collapsed on a phone.
 */
export function AppTools({ modules }: { modules: QuickAddModule[] }) {
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const awaitingGo = useRef(false);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (goTimer.current) clearTimeout(goTimer.current);
      goTimer.current = null;
    };

    function onKeyDown(e: KeyboardEvent) {
      const result = handleKey(awaitingGo.current, {
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        target: e.target instanceof HTMLElement ? e.target : null,
        dialogOpen: !!document.querySelector('[role="dialog"], [role="alertdialog"]'),
      });

      awaitingGo.current = result.awaitingGo;
      clearTimer();
      if (result.awaitingGo) {
        goTimer.current = setTimeout(() => (awaitingGo.current = false), GO_TIMEOUT_MS);
      }
      if (result.handled) e.preventDefault();

      switch (result.action?.type) {
        case "go":
          router.push(result.action.href);
          break;
        case "quick-add":
          setQuickAddOpen(true);
          break;
        case "help":
          setHelpOpen(true);
          break;
        case "theme":
          nextThemeFromCurrent();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimer();
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
      >
        <Plus className="size-4" aria-hidden />
        <span className="flex-1">Quick add</span>
        <Kbd>N</Kbd>
      </button>
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
      >
        <Keyboard className="size-4" aria-hidden />
        <span className="flex-1">Shortcuts</span>
        <Kbd>?</Kbd>
      </button>
      <ThemeToggle />

      <QuickAddDialog modules={modules} open={quickAddOpen} onOpenChange={setQuickAddOpen} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              They work anywhere except while you are typing in a field.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y text-sm">
            {SHORTCUT_HELP.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4 py-2">
                <span>{item.label}</span>
                <span className="flex items-center gap-1">
                  {item.keys.map((k, i) => (
                    <span key={k} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground text-xs">then</span>}
                      <Kbd>{k}</Kbd>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
