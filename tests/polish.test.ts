import { describe, expect, it } from "vitest";
import {
  GO_TARGETS,
  SHORTCUT_HELP,
  handleKey,
  isTypingTarget,
  type KeyLike,
} from "@/lib/shortcuts";
import {
  THEME_KEY,
  THEME_SCRIPT,
  nextPreference,
  parsePreference,
  resolveTheme,
} from "@/lib/theme";

describe("theme preference", () => {
  it("treats anything unknown as following the system", () => {
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("light")).toBe("light");
    for (const v of ["system", "", "Dark", null, undefined, 3, {}]) {
      expect(parsePreference(v)).toBe("system");
    }
  });

  it("resolves to a concrete theme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("cycles system, light, dark and back", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });
});

describe("the script that runs before first paint", () => {
  /** Run the shipped script against fake browser objects; returns whether it made the page dark. */
  function run(opts: { stored?: string | null; systemDark: boolean; storageThrows?: boolean }) {
    let dark: boolean | null = null;
    const localStorage = {
      getItem(key: string) {
        if (opts.storageThrows) throw new Error("storage blocked");
        expect(key).toBe(THEME_KEY);
        return opts.stored ?? null;
      },
    };
    const matchMedia = (query: string) => {
      expect(query).toBe("(prefers-color-scheme: dark)");
      return { matches: opts.systemDark };
    };
    const document = {
      documentElement: {
        classList: {
          toggle(name: string, force: boolean) {
            expect(name).toBe("dark");
            dark = force;
          },
        },
      },
    };
    new Function("localStorage", "matchMedia", "document", THEME_SCRIPT)(
      localStorage,
      matchMedia,
      document,
    );
    return dark;
  }

  it("follows the system when nothing is saved", () => {
    expect(run({ systemDark: true })).toBe(true);
    expect(run({ systemDark: false })).toBe(false);
  });

  it("obeys a saved choice over the system", () => {
    expect(run({ stored: "dark", systemDark: false })).toBe(true);
    expect(run({ stored: "light", systemDark: true })).toBe(false);
  });

  it("ignores a corrupt saved value", () => {
    expect(run({ stored: "purple", systemDark: true })).toBe(true);
    expect(run({ stored: "purple", systemDark: false })).toBe(false);
  });

  it("never throws when storage is blocked, and leaves the page alone", () => {
    expect(() => run({ storageThrows: true, systemDark: true })).not.toThrow();
    expect(run({ storageThrows: true, systemDark: true })).toBeNull();
  });

  it("agrees with resolveTheme for every combination", () => {
    for (const stored of [null, "light", "dark", "junk"]) {
      for (const systemDark of [true, false]) {
        const expected = resolveTheme(parsePreference(stored), systemDark) === "dark";
        expect(run({ stored, systemDark })).toBe(expected);
      }
    }
  });
});

describe("keyboard shortcuts", () => {
  const key = (k: string, over: Partial<KeyLike> = {}): KeyLike => ({ key: k, ...over });

  it("goes to a page with g then a letter", () => {
    const first = handleKey(false, key("g"));
    expect(first).toEqual({ action: null, awaitingGo: true, handled: true });
    for (const [letter, { href }] of Object.entries(GO_TARGETS)) {
      expect(handleKey(true, key(letter))).toEqual({
        action: { type: "go", href },
        awaitingGo: false,
        handled: true,
      });
    }
  });

  it("accepts capital letters (caps lock, shift)", () => {
    expect(handleKey(true, key("B")).action).toEqual({ type: "go", href: "/board" });
    expect(handleKey(false, key("N")).action).toEqual({ type: "quick-add" });
  });

  it("opens quick add, switches theme and shows help", () => {
    expect(handleKey(false, key("n")).action).toEqual({ type: "quick-add" });
    expect(handleKey(false, key("t")).action).toEqual({ type: "theme" });
    expect(handleKey(false, key("?")).action).toEqual({ type: "help" });
  });

  it("cancels the sequence on an unknown second key, then treats that key normally", () => {
    expect(handleKey(true, key("x"))).toEqual({ action: null, awaitingGo: false, handled: false });
    // "g" then "n": the sequence is dropped and "n" still opens quick add
    expect(handleKey(true, key("n")).action).toEqual({ type: "quick-add" });
    // "g" then "g" keeps waiting
    expect(handleKey(true, key("g"))).toEqual({ action: null, awaitingGo: true, handled: true });
    // "g" then Escape just cancels
    expect(handleKey(true, key("Escape")).awaitingGo).toBe(false);
  });

  it("ignores keys it does not know and does not claim them", () => {
    for (const k of ["a", "1", "Enter", "ArrowDown", " ", "/"]) {
      expect(handleKey(false, key(k))).toEqual({ action: null, awaitingGo: false, handled: false });
    }
  });

  it("does nothing while typing in a field", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(handleKey(false, key("n", { target: { tagName } })).action).toBeNull();
    }
    expect(
      handleKey(false, key("n", { target: { tagName: "DIV", isContentEditable: true } })).action,
    ).toBeNull();
    expect(handleKey(false, key("n", { target: { tagName: "BUTTON" } })).action).toEqual({
      type: "quick-add",
    });
    expect(handleKey(false, key("n", { target: { tagName: "BODY" } })).action).toEqual({
      type: "quick-add",
    });
  });

  it("drops a pending g when the user starts typing", () => {
    expect(handleKey(true, key("d", { target: { tagName: "INPUT" } }))).toEqual({
      action: null,
      awaitingGo: false,
      handled: false,
    });
  });

  it("leaves browser shortcuts alone when a modifier is held", () => {
    for (const mod of ["ctrlKey", "metaKey", "altKey"] as const) {
      expect(handleKey(false, key("n", { [mod]: true }))).toEqual({
        action: null,
        awaitingGo: false,
        handled: false,
      });
      expect(handleKey(true, key("d", { [mod]: true })).action).toBeNull();
    }
  });

  it("does nothing while a dialog is open", () => {
    expect(handleKey(false, key("n", { dialogOpen: true })).action).toBeNull();
    expect(handleKey(false, key("?", { dialogOpen: true })).action).toBeNull();
  });

  it("recognises typing targets", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
    expect(isTypingTarget({})).toBe(false);
    expect(isTypingTarget({ tagName: "A" })).toBe(false);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
  });

  it("documents every shortcut it implements", () => {
    const listed = SHORTCUT_HELP.map((h) => h.keys.join(" "));
    for (const letter of Object.keys(GO_TARGETS)) expect(listed).toContain(`g ${letter}`);
    for (const k of ["n", "t", "?"]) expect(listed).toContain(k);
    expect(listed).toHaveLength(Object.keys(GO_TARGETS).length + 3);
  });
});
