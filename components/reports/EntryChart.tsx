"use client";

import { useState } from "react";

import type { HourBucket } from "@/lib/reports";

/**
 * Arrivals by hour, stacked by outcome.
 *
 * Bars, because the question is magnitude over a small number of time buckets —
 * a line would imply a continuous rate between hours that does not exist.
 *
 * THREE segments, not two. Splitting the stack into valid / duplicate / refused
 * matters more than it looks: a duplicate is someone already inside coming back
 * through a door, which is not a refusal, and folding it into one would inflate
 * every "refused" figure a security review reads.
 *
 * The three fills are the three verdicts, and they are the only chroma on the page
 * — the same green, grey and rose the table below uses, so a coloured block in the
 * chart and a coloured row under it mean the same thing.
 *
 * Green and rose are separated by lightness as well as hue, and every series is
 * named in the legend, so the reading survives colour blindness. The neutral for
 * duplicates sits deliberately outside that pair: it is a status neutral, not a
 * third identity, and the one segment nobody needs to tell apart at a glance.
 */
const SERIES = [
  { key: "valid", label: "Valid", fill: "var(--color-accent)" },
  { key: "duplicate", label: "Duplicate", fill: "var(--color-sun)" },
  { key: "refused", label: "Refused", fill: "var(--color-graphite-950)" },
] as const;

const HEIGHT = 180;
const BAR_GAP = 14;
/** A 2px surface gap keeps stacked segments from reading as one block. */
const SEGMENT_GAP = 3;
const ROUND = 7;

export function EntryChart({ buckets }: { buckets: HourBucket[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (buckets.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-ink-3">
        No scans in this range, so there is nothing to plot.
      </p>
    );
  }

  // Fill the gaps between the first and last active hour. An empty 11:00 between
  // a busy 10:00 and 12:00 is information; omitting it would silently compress
  // the morning and misrepresent the shape of the day.
  const hours = buckets.map((bucket) => new Date(bucket.hour).getHours());
  const first = Math.min(...hours);
  const last = Math.max(...hours);

  const byHour = new Map(hours.map((hour, index) => [hour, buckets[index]]));
  const columns = Array.from({ length: last - first + 1 }, (_, offset) => {
    const hour = first + offset;
    const bucket = byHour.get(hour);
    return {
      hour,
      valid: bucket?.valid ?? 0,
      duplicate: bucket?.duplicate ?? 0,
      refused: bucket?.refused ?? 0,
      total: bucket?.total ?? 0,
    };
  });

  const peak = Math.max(...columns.map((column) => column.total), 1);
  const barWidth = 100 / columns.length;

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="display text-lg text-ink">Scans by hour</h3>

        {/* Two or more series always carry a legend, so identity is never colour
            alone — and the same words appear in the table's result column. */}
        <ul className="flex flex-wrap items-center gap-4">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="block h-2.5 w-2.5 rounded-full"
                style={{ background: series.fill }}
              />
              <span className="text-xs text-ink-2">{series.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-45 w-full"
          role="img"
          aria-label={`Scans by hour, ${first}:00 to ${last}:00. Peak ${peak} in one hour.`}
        >
          {/* Recessive baseline. No gridlines: the peak is labelled and the
              tooltip carries exact numbers, so rules would only add ink. */}
          <line
            x1="0"
            y1={HEIGHT - 0.5}
            x2="100"
            y2={HEIGHT - 0.5}
            stroke="var(--color-line-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {columns.map((column, index) => {
            const x = index * barWidth;
            const width = barWidth - BAR_GAP / columns.length;
            let cursor = HEIGHT;

            return (
              <g
                key={column.hour}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
              >
                {/* Hit target spans the full column height, so a one-scan hour is
                    as easy to hover as a busy one. */}
                <rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={HEIGHT}
                  fill="transparent"
                />

                {SERIES.map((series) => {
                  const value = column[series.key];
                  if (value === 0) return null;

                  const height = (value / peak) * (HEIGHT - 8);
                  cursor -= height;
                  const y = cursor;
                  cursor -= SEGMENT_GAP;

                  // Only the top of the stack is rounded; the rest is anchored
                  // flat so segments read as one column.
                  const isTop =
                    series.key === "refused" ||
                    (series.key === "duplicate" && column.refused === 0) ||
                    (series.key === "valid" &&
                      column.refused === 0 &&
                      column.duplicate === 0);

                  return (
                    <rect
                      key={series.key}
                      x={x}
                      y={y}
                      width={width}
                      height={Math.max(height, 1)}
                      rx={isTop ? ROUND : 0}
                      fill={series.fill}
                      opacity={hovered === null || hovered === index ? 1 : 0.45}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Hour axis. Every other label past twelve columns, so they never collide. */}
        <div className="mt-1.5 flex">
          {columns.map((column, index) => (
            <span
              key={column.hour}
              className="mono shrink-0 text-center text-[10px] text-ink-2 tabular-nums"
              style={{ width: `${barWidth}%` }}
            >
              {columns.length > 12 && index % 2 === 1
                ? ""
                : String(column.hour).padStart(2, "0")}
            </span>
          ))}
        </div>

        {hovered !== null ? (
          <div
            className="pointer-events-none absolute -top-1 rounded-2xl bg-graphite-950 px-4 py-3"
            style={{
              left: `${Math.min(Math.max(hovered * barWidth, 0), 78)}%`,
            }}
          >
            <p className="mono text-[11px] font-semibold text-ink">
              {String(columns[hovered].hour).padStart(2, "0")}:00
            </p>
            {SERIES.map((series) => (
              <p key={series.key} className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                <span
                  aria-hidden
                  className="block h-2 w-2 rounded-full"
                  style={{ background: series.fill }}
                />
                <span className="text-graphite-300">{series.label}</span>
                <span className="mono ml-auto pl-2 font-medium text-white tabular-nums">
                  {columns[hovered][series.key]}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
