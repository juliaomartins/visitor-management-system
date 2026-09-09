"use client";

import { useSyncExternalStore } from "react";

/**
 * The viewport, as an external store.
 *
 * `FitText` needs pixel bounds, and the bounds have to follow the panel: the
 * ideal name size on a 3840x2160 wall is not the ideal size on a 1366x768
 * projector. CSS could express that with `clamp()`, but the value has to cross
 * into JavaScript to be measured against, so it is computed here instead.
 *
 * `useSyncExternalStore` rather than an effect: window size is external state
 * that already has a subscription model, and reading it through an effect means
 * a mount-then-setState round trip and a first paint at the wrong size.
 *
 * The snapshot is cached because the hook must return a stable reference for an
 * unchanged size — a fresh object every call is an infinite render loop.
 */
export type Viewport = { width: number; height: number };

const SERVER: Viewport = { width: 1920, height: 1080 };

let cached: Viewport = SERVER;
let cachedKey = "";

function subscribe(notify: () => void): () => void {
  window.addEventListener("resize", notify);
  window.addEventListener("orientationchange", notify);
  return () => {
    window.removeEventListener("resize", notify);
    window.removeEventListener("orientationchange", notify);
  };
}

function getSnapshot(): Viewport {
  const key = `${window.innerWidth}x${window.innerHeight}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cached = { width: window.innerWidth, height: window.innerHeight };
  }
  return cached;
}

/**
 * A landscape 1080p panel is the target, but the same page is opened on a
 * rotated panel, a short projector and a windowed browser during testing. The
 * server snapshot is the lobby panel, so SSR renders the common case.
 */
function getServerSnapshot(): Viewport {
  return SERVER;
}

export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `clamp()` in JavaScript, so the sizing rules read the same as the CSS ones. */
export function clampPx(min: number, ideal: number, max: number): number {
  return Math.round(Math.max(min, Math.min(ideal, max)));
}
