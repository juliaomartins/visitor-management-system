"use client";

import { useState } from "react";

import {
  ChartEmpty,
  ChartLegend,
  ChartTooltip,
  TooltipRow,
  hourLabelStep,
  useHourColumns,
  useMeasuredWidth,
} from "@/components/charts/primitives";
import { HOUR_SERIES } from "@/components/charts/outcomes";
import { useT } from "@/lib/i18n";
import type { HourBucket } from "@/lib/reports";

/**
 * Scans by hour, stacked by outcome.
 *
 * Bars, because the question is magnitude over a small number of time buckets;
 * a line would imply a continuous rate between hours that does not exist.
 *
 * THREE segments, not two. A duplicate is somebody already inside coming back
 * through a door -- it is not a refusal, and folding it into one would inflate
 * every "refused" figure a security review reads.
 *
 * FOUR THINGS WERE WRONG HERE AND ARE WORTH NAMING, because three of them were
 * invisible in the source and obvious on screen:
 *
 *  1. The duplicate series was filled with `var(--color-sun)`, a token defined
 *     nowhere. An invalid `fill` falls back to black, so duplicates rendered
 *     identical to refused. Colours now come from `charts/outcomes.ts`, which
 *     both pages share.
 *  2. `viewBox="0 0 100 180"` with `preserveAspectRatio="none"` scaled x about
 *     14.7x and y 1x, so `rx={7}` drew a 103x7 ELLIPSE -- the flattened cap
 *     that sat on every bar. Geometry is now CSS pixels from a measured
 *     container.
 *  3. The tooltip heading was `text-ink` on `bg-graphite-950`: near-black on
 *     near-black, so the hour was invisible in light mode.
 *  4. The hit target covered gap-filled empty hours, so 11:00 with no scans
 *     reported "Valid 0, Duplicate 0, Refused 0". An empty hour is still drawn
 *     -- the lull is information -- but it no longer claims to have a reading.
 */
const HEIGHT = 200;
/** Space between columns, as a share of one column's slot. */
const GAP_RATIO = 0.3;
/** A 2px surface gap keeps stacked segments from reading as one block. */
const SEGMENT_GAP = 2;
/** Rounded data-end, anchored to the baseline. Pixels, and now honestly so. */
const ROUND = 4;

export function EntryChart({ buckets }: { buckets: HourBucket[] }) {
  const t = useT();
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const columns = useHourColumns(buckets);

  const legend = HOUR_SERIES.map((series) => ({
    key: series.key,
    label: t(series.labelKey),
    fill: series.fill,
  }));

  if (columns.length === 0) {
    return (
      <div className="px-6 py-5">
        <h3 className="display text-lg text-ink">{t("chart.scansByHour")}</h3>
        <ChartEmpty message={t("chart.noScans")} />
      </div>
    );
  }

  const peak = Math.max(...columns.map((column) => column.total), 1);
  const slot = width / columns.length;
  const barW = Math.max(slot * (1 - GAP_RATIO), 2);
  const plotH = HEIGHT - 10;
  const step = hourLabelStep(columns.length, width);
  const active =
    hovered === null || columns[hovered].total === 0 ? null : columns[hovered];

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className="display text-lg text-ink">{t("chart.scansByHour")}</h3>
        {/* Two or more series always carry a legend, so identity is never
            colour alone -- and these are the same words the table's result
            column uses. */}
        <ChartLegend items={legend} />
      </div>

      <div ref={ref} className="relative mt-4">
        {width === 0 ? (
          <div style={{ height: HEIGHT }} />
        ) : (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="touch-none"
            role="img"
            aria-label={`${t("chart.scansByHour")}. ${columns[0].hour}:00 to ${
              columns[columns.length - 1].hour
            }:00. Peak ${peak} in one hour.`}
          >
            {/* Recessive baseline. No gridlines: the tooltip carries exact
                numbers, so rules would only add ink. */}
            <line
              x1="0"
              y1={HEIGHT - 0.5}
              x2={width}
              y2={HEIGHT - 0.5}
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />

            {columns.map((column, index) => {
              const left = index * slot + (slot - barW) / 2;
              let cursor = HEIGHT;

              return (
                <g
                  key={column.hour}
                  onPointerEnter={() => setHovered(index)}
                  onPointerLeave={() => setHovered(null)}
                >
                  {/* Hit target spans the full column, so a one-scan hour is as
                      easy to hover as a busy one. */}
                  <rect
                    x={index * slot}
                    y={0}
                    width={slot}
                    height={HEIGHT}
                    fill="transparent"
                  />

                  {HOUR_SERIES.map((series) => {
                    const value = column[series.key];
                    if (value === 0) return null;

                    const height = (value / peak) * plotH;
                    cursor -= height;
                    const y = cursor;
                    cursor -= SEGMENT_GAP;

                    // Only the top of the stack is rounded; the rest stays flat
                    // so the segments read as one column.
                    const isTop =
                      series.key === "refused" ||
                      (series.key === "duplicate" && column.refused === 0) ||
                      (series.key === "valid" &&
                        column.refused === 0 &&
                        column.duplicate === 0);

                    return (
                      <rect
                        key={series.key}
                        x={left}
                        y={y}
                        width={barW}
                        height={Math.max(height, 1)}
                        rx={isTop ? Math.min(ROUND, barW / 2) : 0}
                        fill={series.fill}
                        opacity={
                          hovered === null || hovered === index ? 1 : 0.45
                        }
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}

        <div className="mt-1.5 flex">
          {columns.map((column, index) => (
            <span
              key={column.hour}
              className="mono shrink-0 text-center text-[10px] text-ink-2 tabular-nums"
              style={{ width: `${100 / columns.length}%` }}
            >
              {index % step === 0 ? String(column.hour).padStart(2, "0") : ""}
            </span>
          ))}
        </div>

        {active ? (
          <ChartTooltip
            x={(hovered! * slot + slot / 2) / Math.max(width, 1)}
          >
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
    </div>
  );
}
