"use client";

import { useState } from "react";

import {
  ChartEmpty,
  ChartTooltip,
  TooltipRow,
  hourLabelStep,
  niceCeiling,
  useHourColumns,
  useMeasuredWidth,
} from "@/components/charts/primitives";
import { HOUR_SERIES } from "@/components/charts/outcomes";
import { useT } from "@/lib/i18n";
import type { HourBucket } from "@/lib/reports";

/**
 * The shape of the day, as a line.
 *
 * A line and not bars, because the question here is SHAPE -- when the doors are
 * busy, where the lull is, whether the rush has started. The reports page keeps
 * the stacked bars, which answer the different question of how many of each
 * outcome fell in a given hour.
 *
 * Straight segments between hourly readings, never a spline. A smoothed curve
 * would invent arrivals at 10:30 that nobody recorded, and would overshoot
 * below zero coming out of a spike. Every bend is a real measurement.
 *
 * One series, so no legend -- the title names it. A legend of one is furniture.
 *
 * GEOMETRY IS IN CSS PIXELS FROM A MEASURED CONTAINER, not a scaled viewBox.
 * See the comment at the top of `charts/primitives.tsx`: the old approach is
 * what turned a 7px corner radius on the reports chart into a 103x7 ellipse.
 */
const HEIGHT = 260;
const PAD_T = 20;
const PAD_B = 32;
/** Room for the axis numbers, which sit on the right. */
const PAD_R = 44;
const PAD_L = 6;

export function ArrivalsCurve({ buckets }: { buckets: HourBucket[] }) {
  const t = useT();
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const columns = useHourColumns(buckets);

  if (columns.length === 0) {
    return <ChartEmpty message={t("chart.noScans")} />;
  }

  const peak = Math.max(...columns.map((column) => column.total), 1);
  // A tidy ceiling, so the gridline labels are round numbers rather than the peak.
  const ceiling = niceCeiling(peak);

  const plotW = Math.max(width - PAD_L - PAD_R, 1);
  const plotH = HEIGHT - PAD_T - PAD_B;

  const x = (index: number) =>
    columns.length === 1
      ? PAD_L + plotW / 2
      : PAD_L + (index / (columns.length - 1)) * plotW;
  const y = (value: number) => PAD_T + plotH - (value / ceiling) * plotH;

  const line = columns
    .map(
      (column, index) =>
        `${index === 0 ? "M" : "L"}${x(index)} ${y(column.total)}`,
    )
    .join(" ");

  const area = `${line} L${x(columns.length - 1)} ${PAD_T + plotH} L${x(0)} ${
    PAD_T + plotH
  } Z`;

  const step = hourLabelStep(columns.length, plotW);
  const active = hovered === null ? null : columns[hovered];
  const peakHour = columns.reduce(
    (best, column) => (column.total > best.total ? column : best),
    columns[0],
  );

  /** Nearest column to the pointer, so the whole plot is a hit target. */
  function locate(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const units = event.clientX - box.left;
    const gap = columns.length === 1 ? plotW : plotW / (columns.length - 1);
    const index = Math.round((units - PAD_L) / gap);
    setHovered(Math.min(Math.max(index, 0), columns.length - 1));
  }

  return (
    <div ref={ref} className="relative px-5 pb-5">
      {/* Rendered only once measured. Drawing at width 0 first would flash a
          collapsed plot and then jump, which is worse than one blank frame. */}
      {width === 0 ? (
        <div style={{ height: HEIGHT }} />
      ) : (
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="touch-none"
          role="img"
          aria-label={`${t("overview.arrivalsByHour")}. ${columns[0].hour}:00 to ${
            columns[columns.length - 1].hour
          }:00. Peak ${peak} at ${peakHour.hour}:00.`}
          onPointerMove={locate}
          onPointerLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="vms-arrivals-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-accent)"
                stopOpacity="0.13"
              />
              <stop
                offset="100%"
                stopColor="var(--color-accent)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {/* Recessive gridlines, labelled on the RIGHT so a number never sits
              between the reader and where the curve begins. */}
          {[0, ceiling / 2, ceiling].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y(tick)}
                x2={PAD_L + plotW}
                y2={y(tick)}
                stroke="var(--color-line)"
                strokeWidth="1"
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

          <path d={area} fill="url(#vms-arrivals-fill)" />
          {/*
            NO DRAW-ON ANIMATION, DELIBERATELY REMOVED.

            It was a dash pattern revealed by a keyframe, which means the line is
            INVISIBLE until the animation runs. Screenshots at two widths caught
            it frozen partway and the chart simply had no line in them -- and a
            backgrounded tab throttles exactly the timers it depends on, which
            this app already knows about for the kiosk. A mark whose visibility
            depends on an animation completing is a mark that is sometimes
            missing, and the one thing this chart is for is the line.
          */}
          <path
            d={line}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* A marker on the peak, labelled. Selective direct labels only -- a
              number on every point is noise, and the tooltip carries the rest. */}
          <circle
            cx={x(columns.indexOf(peakHour))}
            cy={y(peakHour.total)}
            r="3.5"
            fill="var(--color-accent)"
            stroke="var(--color-card)"
            strokeWidth="2"
          />

          {columns.map((column, index) => (
            <text
              key={column.hour}
              x={x(index)}
              y={HEIGHT - 10}
              textAnchor="middle"
              className="mono"
              fontSize="11"
              fill="var(--color-ink-3)"
            >
              {index % step === 0
                ? String(column.hour).padStart(2, "0")
                : ""}
            </text>
          ))}

          {active ? (
            <g>
              <line
                x1={x(hovered!)}
                y1={PAD_T}
                x2={x(hovered!)}
                y2={PAD_T + plotH}
                stroke="var(--color-line-strong)"
                strokeWidth="1"
              />
              {/* A 2px surface ring keeps the marker legible over the fill. */}
              <circle
                cx={x(hovered!)}
                cy={y(active.total)}
                r="5.5"
                fill="var(--color-accent)"
                stroke="var(--color-card)"
                strokeWidth="2.5"
              />
            </g>
          ) : null}
        </svg>
      )}

      {active ? (
        <ChartTooltip x={x(hovered!) / Math.max(width, 1)}>
          <p className="mono text-[11px] font-semibold text-white">
            {String(active.hour).padStart(2, "0")}:00
          </p>
          <div className="mt-1.5">
            {HOUR_SERIES.map((series) => (
              <TooltipRow
                key={series.key}
                fill={series.fill}
                label={t(series.labelKey)}
                value={active[series.key]}
              />
            ))}
          </div>
        </ChartTooltip>
      ) : null}
    </div>
  );
}
