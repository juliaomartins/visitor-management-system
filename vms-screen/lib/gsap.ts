"use client";

/**
 * GSAP, registered once.
 *
 * Plugins must be registered before any tween touches them, and registering the
 * same plugin twice is wasted work on a machine that will run this page for
 * fourteen hours. Everything imports from here so there is one registration and
 * one place to see which plugins this screen actually uses.
 *
 * Every plugin here is free, including for commercial use — Physics2D and
 * SplitText included. No membership, licence key or private registry.
 */
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, Physics2DPlugin, SplitText);

/**
 * A kiosk is a fixed panel, so the frame budget is fixed too.
 *
 * `lagSmoothing` stops GSAP trying to "catch up" after the browser stalls — on a
 * background tab or a garbage-collection pause it would otherwise jump every
 * tween forward at once, which on this screen looks like sparks teleporting.
 */
gsap.ticker.lagSmoothing(500, 33);

export { gsap, useGSAP, SplitText };

/** True when the viewer has asked for less motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * How much spectacle this device can afford.
 *
 * The lobby panel is a desktop browser and can carry a full burst. The same page
 * opened on a phone to check it is working should not melt, and a viewer who has
 * asked for reduced motion gets none of it. One number, decided in one place, so
 * every effect scales together instead of each guessing.
 */
export function particleBudget(): number {
  if (typeof window === "undefined") return 0;
  if (prefersReducedMotion()) return 0;

  const cores = navigator.hardwareConcurrency ?? 4;
  const width = window.innerWidth;

  if (width < 640 || cores <= 2) return 14;
  if (width < 1280 || cores <= 4) return 28;
  return 46;
}
