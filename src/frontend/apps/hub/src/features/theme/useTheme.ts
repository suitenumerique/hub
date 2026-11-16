import { useSyncExternalStore } from "react";

/**
 * The theme follows the operating system until the user forces one. The choice
 * belongs to this browser, not to the account: it is kept in localStorage and
 * survives logging out.
 *
 * `THEME_INIT_SCRIPT` applies the same rule before the first paint: keep both
 * in sync.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "hubTheme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export const CUNNINGHAM_THEMES = {
  light: "dsfr-light",
  dark: "dsfr-dark",
} as const satisfies Record<ResolvedTheme, string>;

const isPreference = (value: unknown): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const readPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    // Unavailable storage holds no choice.
    return "system";
  }
};

// Read once, then kept here: a blocked storage still switches the theme until
// the next load.
let preference: ThemePreference | null = null;
const getPreference = () => (preference ??= readPreference());

const listeners = new Set<() => void>();

const subscribePreference = (listener: () => void) => {
  listeners.add(listener);
  // Another tab of this browser changed the theme.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const setPreference = (next: ThemePreference) => {
  preference = next;
  try {
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // The choice then lasts until the next load.
  }
  listeners.forEach((listener) => listener());
};

const subscribeSystem = (listener: () => void) => {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

const getSystemDark = () => window.matchMedia(DARK_QUERY).matches;

// The static export renders without a window. In the browser, hydration reads
// the real values at once: the theme changes no markup, and a first render in
// light would undo the dark class `THEME_INIT_SCRIPT` already set.
const onServer = typeof window === "undefined";
const getServerPreference = (): ThemePreference =>
  onServer ? "system" : getPreference();
const getServerSystemDark = () => !onServer && getSystemDark();

export const useTheme = () => {
  const current = useSyncExternalStore(
    subscribePreference,
    getPreference,
    getServerPreference,
  );
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    getSystemDark,
    getServerSystemDark,
  );
  const theme: ResolvedTheme =
    current === "dark" || (current === "system" && systemDark)
      ? "dark"
      : "light";
  return {
    preference: current,
    setPreference,
    theme,
    cunninghamTheme: CUNNINGHAM_THEMES[theme],
  };
};

/**
 * Runs in `<head>` before the first paint, so a dark page never flashes light
 * while React loads. `CunninghamProvider` manages the class afterwards.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});var d=p==="dark"||(p!=="light"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);document.documentElement.classList.add("cunningham-theme--"+(d?${JSON.stringify(
  CUNNINGHAM_THEMES.dark,
)}:${JSON.stringify(CUNNINGHAM_THEMES.light)}));}catch(e){}})();`;
