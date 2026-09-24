"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  THEME_EVENT,
  THEME_KEY,
  nextPreference,
  parsePreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function applyTheme(preference: ThemePreference) {
  const dark =
    resolveTheme(preference, matchMedia("(prefers-color-scheme: dark)").matches) === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

function subscribePreference(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved preference, "system" on the server and until the page has loaded. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribePreference, readPreference, () => "system");
}

/** Whether the page is currently dark, kept in step with the class on <html>. */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Storage can be blocked; the theme still applies for this visit.
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Used by the "t" shortcut. */
export function nextThemeFromCurrent() {
  setThemePreference(nextPreference(readPreference()));
}

const LABEL: Record<ThemePreference, string> = { system: "System", light: "Light", dark: "Dark" };
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

/** One button that cycles System, Light, Dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemePreference();
  const Icon = ICON[preference];

  // While following the system, react when the OS switches between light and dark.
  useEffect(() => {
    if (preference !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  return (
    <button
      type="button"
      onClick={() => setThemePreference(nextPreference(preference))}
      aria-label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[nextPreference(preference)]}`}
      className={cn(
        "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      Theme: {LABEL[preference]}
    </button>
  );
}
