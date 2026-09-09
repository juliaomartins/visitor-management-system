"use client";

import { useSyncExternalStore } from "react";

/**
 * Light or dark, chosen by the person at the desk.
 *
 * CLASS-BASED, NOT `prefers-color-scheme`. Registration runs from early setup to
 * late teardown on a borrowed laptop whose OS theme may flip at sunset, and a
 * console that re-themes itself mid-shift while somebody is typing a passport
 * number is a distraction, not a feature. The OS preference is used once, as the
 * opening guess, and after that the explicit choice wins and persists.
 *
 * The state lives outside React because it is browser state, not derived state.
 * `useSyncExternalStore` reads it directly, so the first paint is already correct
 * rather than flashing the default and correcting in an effect.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "vms.theme";
const listeners = new Set<() => void>();

let cached: Theme | null = null;

function systemPreference(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function read(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A locked-down browser still gets a working console, just not a remembered
    // preference. Falling through to the system guess is the right failure.
  }
  return systemPreference();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function getSnapshot(): Theme {
  if (cached === null) cached = read();
  return cached;
}

/**
 * The server has no browser to ask. It renders light, and the blocking script in
 * the document head corrects the class before first paint, so a dark-mode user
 * never sees a white flash.
 */
function getServerSnapshot(): Theme {
  return "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme) {
  cached = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not fatal: the choice holds for this session even if it cannot be saved.
  }
  applyTheme(theme);
  for (const notify of listeners) notify();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Runs before the first paint, inlined into the document head.
 *
 * Without it the server's light markup paints, React hydrates, and only then does
 * the class land — a white flash on every navigation for anyone in dark mode. It
 * is deliberately tiny and dependency-free because it blocks rendering.
 */
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}`;
