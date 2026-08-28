"use client";

import { useMemo, useRef, useState } from "react";

import type { HourBucket } from "@/lib/reports";

/**
 * Arrivals across the day, as a line.
 *
 * A line, not bars, because the question here is SHAPE — when the doors are busy,
 * where the lull is, whether the rush has started — and shape is what a line
 * carries. The reports page keeps the stacked bars, which answer a different
 * question: how many of each outcome in a given hour.
 *
 * Straight segments between hourly readings, not a spline. A smoothed curve would
 * invent arrivals at 10:30 that nobody recorded, and would overshoot below zero
 * on the way out of a spike. The bend at each hour is a real measurement.
 *
 * One series, so no legend: the title names it. Hover is not optional on a line
 * chart — the crosshair and tooltip are how anyone reads an exact value off it.
 */
const W = 760;
const H = 240;
const PAD_T = 18;
const PAD_B = 30;
const PAD_R = 40;
const PAD_L = 8;

export function ArrivalsCurve({ buckets }: { buckets: HourBucket[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const columns = useMemo(() => {
    if (buckets.length === 0) return [];

    // Fill the gaps between the first and last active hour. An empty 11:00
    // between a busy 10:00 and 12:00 is information; dropping it would compress
    // the morning and misrepresent the shape of the day.
    const hours = buckets.map((bucket) => new Date(bucket.hour).getHours());
    const first = Math.min(...hours);
    const last = Math.max(...hours);
    const byHour = new Map(hours.map((hour, index) => [hour, buckets[index]]));

    return Array.from({ length: last - first + 1 }, (_, offset) => {
      const hour = first + offset;
      const bucket = byHour.get(hour);
      return {
        hour,
        total: bucket?.total ?? 0,
        valid: bucket?.valid ?? 0,
        refused: bucket?.refused ?? 0,
      };
    });
  }, [buckets]);

  if (columns.length === 0) {
    return (
      <p className="px-6 py-16 text-center text-sm text-ink-3">
        No scans in this range, so there is nothing to plot.
      </p>
    );
  }

  const peak = Math.max(...columns.map((column) => column.total), 1);
  // A tidy ceiling so the gridline labels are round numbers rather than the peak.
  const ceiling = niceCeiling(peak);

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const x = (index: number) =>
    columns.length === 1
      ? PAD_L + plotW / 2
      : PAD_L + (index / (columns.length - 1)) * plotW;
  const y = (value: number) => PAD_T + plotH - (value / ceiling) * plotH;

  const line = columns
    .map((column, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(column.total)}`)
    .join(" ");

  const area = `${line} L${x(columns.length - 1)} ${PAD_T + plotH} L${x(0)} ${
    PAD_T + plotH
  } Z`;

  const ticks = [0, ceiling / 2, ceiling];
  const active = hovered === null ? null : columns[hovered];

  function locate(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;

    const box = svg.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    const units = fraction * W;
    const step = columns.length === 1 ? plotW : plotW / (columns.length - 1);
    const index = Math.round((units - PAD_L) / step);
    setHovered(Math.min(Math.max(index, 0), columns.length - 1));
  }

  return (
    <div className="relative px-5 pb-5">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Arrivals by hour from ${columns[0].hour}:00 to ${
          columns[columns.length - 1].hour
        }:00. Peak ${peak} in one hour.`}
        onPointerMove={locate}
        onPointerLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="arrivals-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines, labelled on the right so they never sit between
            the reader and the curve's start. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L}
              y1={y(tick)}
              x2={PAD_L + plotW}
              y2={y(tick)}
              stroke="var(--color-line)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD_L + plotW + 8}
              y={y(tick) + 4}
              className="mono"
              fontSize="11"
              fill="var(--color-ink-3)"
            >
              {tick}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#arrivals-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Hour axis. Every other label past twelve columns, so they never collide. */}
        {columns.map((column, index) => (
          <text
            key={column.hour}
            x={x(index)}
            y={H - 9}
            textAnchor="middle"
            className="mono"
            fontSize="11"
            fill="var(--color-ink-3)"
          >
            {columns.length > 12 && index % 2 === 1
              ? ""
              : `${String(column.hour).padStart(2, "0")}`}
          </text>
        ))}

        {hovered !== null && active ? (
          <g>
            <line
              x1={x(hovered)}
              y1={PAD_T}
              x2={x(hovered)}
              y2={PAD_T + plotH}
              stroke="var(--color-line-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* A 2px surface ring keeps the marker legible over the fill. */}
            <circle
              cx={x(hovered)}
              cy={y(active.total)}
              r="5.5"
              fill="var(--color-accent)"
              stroke="var(--color-card)"
              strokeWidth="2.5"
            />
          </g>
        ) : null}
      </svg>

      {hovered !== null && active ? (
        <div
          className="pointer-events-none absolute top-2 rounded-lg bg-graphite-950 px-3 py-2 text-white shadow-lg"
          style={{
            left: `${Math.min(Math.max((x(hovered) / W) * 100, 4), 82)}%`,
          }}
        >
          <p className="mono text-[11px] font-semibold">
            {String(active.hour).padStart(2, "0")}:00
          </p>
          <p className="mt-1 text-[11px] text-graphite-300">
            <span className="mono font-semibold text-white">{active.total}</span>{" "}
            scans
          </p>
          <p className="text-[11px] text-graphite-300">
            <span className="mono font-semibold text-white">{active.valid}</span>{" "}
            arrivals ·{" "}
            <span className="mono font-semibold text-white">{active.refused}</span>{" "}
            refused
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Round the axis up to something a person would have chosen. */
function niceCeiling(peak: number): number {
  if (peak <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / (magnitude / 2)) * (magnitude / 2);
}
