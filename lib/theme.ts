"use client";

import { useSyncExternalStore } from "react";

/**
 * Dark by default, light on request.
 *
 * THE DEFAULT IS NOT A PREFERENCE. This panel runs unattended in a lobby for
 * fourteen hours; a wall-sized white rectangle is a lamp pointed at the people it
 * is meant to welcome, and it blows out every visitor photo on it. Light mode
 * exists for two real cases -- setting the screen up under office lighting, and a
 * glass atrium at midday -- so it is always an explicit act and it is remembered.
 *
 * `prefers-color-scheme` is deliberately ignored. A kiosk browser inherits the
 * host machine's theme, which on Windows flips with the OS at sunset, and a lobby
 * display that changes appearance mid-event looks broken to everyone who walks
 * past it.
 */
export type Theme = "dark" | "light";

const STORAGE_KEY = "vms.screen.theme";
const listeners = new Set<() => void>();

let cached: Theme | null = null;

function read(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    // A kiosk profile with storage disabled still gets the correct default.
    return "dark";
  }
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

function getServerSnapshot(): Theme {
  return "dark";
}

export function setTheme(theme: Theme) {
  cached = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not fatal: the choice holds for this session.
  }
  document.documentElement.classList.toggle("light", theme === "light");
  for (const notify of listeners) notify();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Runs before the first paint, inlined into the document head.
 *
 * The server renders dark, so only a light-mode operator would otherwise see a
 * flash -- but on this screen that flash is a full-wall white strobe, which is
 * exactly the thing worth spending four lines of blocking script to avoid.
 */
export const THEME_BOOTSTRAP = `try{if(localStorage.getItem("${STORAGE_KEY}")==="light"){document.documentElement.classList.add("light")}}catch(e){}`;
