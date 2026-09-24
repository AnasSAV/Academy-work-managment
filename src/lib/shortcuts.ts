/**
 * Keyboard shortcuts as a small state machine, so the rules can be tested without a browser.
 *
 *   g then d / b / c / r / s   go to Dashboard / Board / Calendar / Review / Settings
 *   n                          quick add
 *   t                          switch theme
 *   ?                          show the shortcuts
 *
 * Nothing fires while typing in a field, while a modifier key is held (so browser shortcuts such
 * as Ctrl+R still work), or while a dialog is open.
 */

export const GO_TARGETS: Record<string, { href: string; label: string }> = {
  d: { href: "/", label: "Dashboard" },
  b: { href: "/board", label: "Board" },
  c: { href: "/calendar", label: "Calendar" },
  r: { href: "/review", label: "Review" },
  s: { href: "/settings", label: "Settings" },
};

/** How long "g" waits for its second key. */
export const GO_TIMEOUT_MS = 1500;

export type ShortcutAction =
  { type: "go"; href: string } | { type: "quick-add" } | { type: "theme" } | { type: "help" };

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Where the key was pressed. */
  target?: { tagName?: string; isContentEditable?: boolean } | null;
  /** A dialog is currently open. */
  dialogOpen?: boolean;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(target: KeyLike["target"]): boolean {
  if (!target) return false;
  return target.isContentEditable === true || TYPING_TAGS.has((target.tagName ?? "").toUpperCase());
}

export interface ShortcutResult {
  action: ShortcutAction | null;
  /** True when "g" was just pressed and a second key is awaited. */
  awaitingGo: boolean;
  /** Whether the key was used, so the caller should stop the browser acting on it. */
  handled: boolean;
}

export function handleKey(awaitingGo: boolean, e: KeyLike): ShortcutResult {
  const ignore = e.ctrlKey || e.metaKey || e.altKey || e.dialogOpen || isTypingTarget(e.target);
  if (ignore) return { action: null, awaitingGo: false, handled: false };

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (awaitingGo) {
    const target = GO_TARGETS[key];
    if (target)
      return { action: { type: "go", href: target.href }, awaitingGo: false, handled: true };
    if (key === "g") return { action: null, awaitingGo: true, handled: true };
    // Any other key cancels the sequence and is then treated as a normal key press.
    return handleKey(false, e);
  }

  switch (key) {
    case "g":
      return { action: null, awaitingGo: true, handled: true };
    case "n":
      return { action: { type: "quick-add" }, awaitingGo: false, handled: true };
    case "t":
      return { action: { type: "theme" }, awaitingGo: false, handled: true };
    case "?":
      return { action: { type: "help" }, awaitingGo: false, handled: true };
    default:
      return { action: null, awaitingGo: false, handled: false };
  }
}

export const SHORTCUT_HELP: { keys: string[]; label: string }[] = [
  { keys: ["g", "d"], label: "Go to the dashboard" },
  { keys: ["g", "b"], label: "Go to the board" },
  { keys: ["g", "c"], label: "Go to the calendar" },
  { keys: ["g", "r"], label: "Go to review" },
  { keys: ["g", "s"], label: "Go to settings" },
  { keys: ["n"], label: "Quick add a chapter, assessment or past paper" },
  { keys: ["t"], label: "Switch theme (system, light, dark)" },
  { keys: ["?"], label: "Show this list" },
];
