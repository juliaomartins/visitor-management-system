"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { HourBucket } from "@/lib/reports";
import { HATCH_ID } from "./outcomes";

/**
 * The pieces every chart on this dashboard is built from.
 *
 * WHY A MEASURED WIDTH AND NOT A viewBox. The reports chart used to draw into
 * `viewBox="0 0 100 180"` with `preserveAspectRatio="none"`, which stretched x
 * by about 14.7 and y by 1. Every length in the drawing meant two different
 * things depending on its axis: `rx={7}` became a 103x7px ELLIPSE, which is the
 * flattened "3D cap" that sat on top of every bar.
 *
 * That is not a radius to tune. It is what non-uniform scaling does to any
 * radius, any stroke and any circle, so the fix is to stop scaling: measure the
 * container and draw in CSS pixels, where 7 is 7 in both directions. Strokes,
 * corners and markers are then all honest, and no future mark can inherit the
 * bug.
 */

/** Observe an element's content width. Returns 0 until the first measurement. */
export function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    /*
      MEASURE THE CONTENT BOX, AND FROM BOTH SOURCES THE SAME WAY.

      This read used `node.clientWidth`, which INCLUDES padding, while the
      observer below reports `contentRect.width`, which does not. The chart
      container is `px-5`, so the first measurement came back 40px too wide, the
      svg was rendered wider than its own card, and the card pushed the document
      past the viewport -- a horizontal scrollbar on the dashboard at 400px,
      from a 40px disagreement between two ways of asking the same question.

      The observer corrected it a frame later, which is exactly what made it
      hard to see: it only showed up where the observer had not run yet.
    */
    const measure = () => {
      const style = getComputedStyle(node);
      const pad =
        parseFloat(style.paddingLeft || "0") +
        parseFloat(style.paddingRight || "0");
      setWidth(Math.max(Math.round(node.clientWidth - pad), 0));
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      // No observer: follow the window instead, so a rotate still reflows.
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/** Whether this viewer has asked for less motion. Chart entrances honour it. */
export function usePrefersReducedMotion() {
  /*
    Read synchronously on the first client render, not in an effect. Defaulting
    to "quiet" and correcting afterwards meant an animated figure was set to its
    final value on the first pass and then animated on the second -- it jumped,
    then counted up to where it already was.

    Server-rendering has no media query, so it assumes quiet; that is the safe
    default and it changes no markup, because what renders is the value rather
    than the preference.
  */
  const [quiet, setQuiet] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    // Subscribe only. The initializer above already read the current value, so
    // setting it again here would be a second render for no new information --
    // which is what `react-hooks/set-state-in-effect` is pointing at.
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setQuiet(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return quiet;
}

export type HourColumn = {
  hour: number;
  total: number;
  valid: number;
  duplicate: number;
  revoked: number;
  invalid: number;
  refused: number;
};

/**
 * Hourly buckets, gap-filled between the first and last active hour.
 *
 * An empty 11:00 between a busy 10:00 and a busy 12:00 IS information -- it is
 * the lull between the opening rush and lunch. Dropping it would slide the
 * afternoon left and misrepresent the shape of the day, which is the one thing
 * this chart exists to show.
 *
 * Only the middle is filled. Padding out to 00:00 and 23:00 would bury a
 * six-hour conference day in eighteen empty columns.
 *
 * Both charts derived this separately before, with the same comment written
 * twice. One of them would eventually have been fixed alone.
 */
export function useHourColumns(buckets: HourBucket[]): HourColumn[] {
  return useMemo(() => {
    if (buckets.length === 0) return [];

    const hours = buckets.map((bucket) => new Date(bucket.hour).getHours());
    const first = Math.min(...hours);
    const last = Math.max(...hours);
    const byHour = new Map(hours.map((hour, index) => [hour, buckets[index]]));

    return Array.from({ length: last - first + 1 }, (_, offset) => {
      const hour = first + offset;
      const bucket = byHour.get(hour);
      const refused = bucket?.refused ?? 0;

      return {
        hour,
        total: bucket?.total ?? 0,
        valid: bucket?.valid ?? 0,
        duplicate: bucket?.duplicate ?? 0,
        // The feed carries `refused` as one figure; the split into revoked and
        // invalid lives on the summary, not per hour. Kept as zero here rather
        // than guessed, so nothing downstream can read an invented number.
        revoked: 0,
        invalid: 0,
        refused,
      };
    });
  }, [buckets]);
}

/** Round an axis up to a number a person would have chosen. */
export function niceCeiling(peak: number): number {
  if (peak <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / (magnitude / 2)) * (magnitude / 2);
}

/**
 * Label every hour, or every other one once there are too many to fit.
 *
 * Driven by measured width rather than a column count, because the same twelve
 * columns collide on a phone and sit comfortably on a 1920 panel.
 */
export function hourLabelStep(columns: number, width: number): number {
  if (width === 0) return 1;
  const per = width / Math.max(columns, 1);
  if (per >= 34) return 1;
  if (per >= 18) return 2;
  return 3;
}

/**
 * The 45-degree hatch, for the one series colour cannot separate.
 *
 * Drawn in `currentColor` so a single `<defs>` serves any fill: the user sets
 * `color` on the element that references it. Render this ONCE per svg.
 */
export function HatchDef({ id = HATCH_ID }: { id?: string }) {
  return (
    <pattern
      id={id}
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="6" height="6" fill="currentColor" />
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="6"
        stroke="var(--color-card)"
        strokeWidth="2"
      />
    </pattern>
  );
}

/**
 * The tooltip shell: dark card, light ink, out of the pointer's way.
 *
 * THE REPORTS TOOLTIP SET ITS HEADING IN `text-ink` ON `bg-graphite-950` --
 * near-black on near-black, so in light mode the hour simply was not there.
 * A tooltip is a surface with its own colour scheme and cannot borrow page ink;
 * these classes are fixed for that reason, not themed.
 *
 * `x` is a fraction of the plot, clamped so the box never leaves the card.
 */
export function ChartTooltip({
  x,
  children,
}: {
  x: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-32 rounded-xl bg-graphite-950 px-3 py-2 shadow-xl ring-1 ring-white/10"
      style={{
        left: `${Math.min(Math.max(x * 100, 0), 100)}%`,
        // Centre on the reading, then let the clamp above keep it on the card.
        transform: `translateX(-${Math.min(Math.max(x * 100, 8), 92)}%)`,
      }}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

/** One `swatch — label — value` line inside a tooltip. */
export function TooltipRow({
  fill,
  label,
  value,
  hatch = false,
}: {
  fill: string;
  label: string;
  value: number;
  hatch?: boolean;
}) {
  return (
    <p className="mt-1 flex items-center gap-2 text-[11px] first:mt-0">
      <span
        aria-hidden
        className="block h-2.5 w-2.5 shrink-0 rounded-[3px]"
        style={
          hatch
            ? {
                color: fill,
                backgroundImage: `repeating-linear-gradient(45deg, ${fill} 0 2px, #0b1016 2px 4px)`,
              }
            : { background: fill }
        }
      />
      <span className="text-graphite-300">{label}</span>
      <span className="mono ml-auto pl-3 font-semibold text-white tabular-nums">
        {value}
      </span>
    </p>
  );
}

/**
 * Series identity, always present for two or more series.
 *
 * Never colour alone: the word is the identity and the swatch is the shortcut.
 * A single-series chart gets none -- its title names it, and a legend of one is
 * furniture.
 */
export function ChartLegend({
  items,
}: {
  items: { key: string; label: string; fill: string; hatch?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="block h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={
              item.hatch
                ? {
                    backgroundImage: `repeating-linear-gradient(45deg, ${item.fill} 0 2px, var(--color-card) 2px 4px)`,
                  }
                : { background: item.fill }
            }
          />
          <span className="text-xs text-ink-2">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** What a chart shows when the day has not started. */
export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-6 py-12">
      <p className="text-center text-sm text-ink-3">{message}</p>
    </div>
  );
}
