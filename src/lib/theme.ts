export type ThemePreference = "system" | "light" | "dark";

export const THEME_KEY = "academy-theme";
export const THEME_EVENT = "academy-theme-change";

export const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];

/** Anything that is not a known preference means "follow the system". */
export function parsePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean) {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function nextPreference(current: ThemePreference): ThemePreference {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
}

/**
 * Runs in the page head before anything is painted, so a dark theme never flashes light. It must
 * stay dependency-free and must never throw (storage can be blocked). Kept as a string so the
 * exact code that ships is the code the tests run.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
