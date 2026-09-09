"use client";

/**
 * One number, its context, and the shape behind it.
 *
 * The sparkline is real data or it is absent. A decorative squiggle on a KPI tile
 * is the most common lie in dashboard design — it implies a trend the figure does
 * not actually have — so a tile with nothing to plot simply renders without one.
 *
 * There is no percentage-versus-last-week here either. This system holds one
 * event; there is no last week to compare against, and inventing one would be
 * worse than leaving the space empty. The second line carries a real relationship
 * instead: how this number sits inside another one.
 */
export function StatTile({
  label,
  value,
  note,
  tone = "plain",
  spark,
}: {
  label: string;
  value: string | number;
  /** A true relationship — "of 250 registered" — never a fabricated delta. */
  note?: string;
  tone?: "plain" | "good" | "warn" | "alert";
  /** Per-hour magnitudes. Omit when the figure has no time dimension. */
  spark?: number[];
}) {
  const noteTone =
    tone === "good"
      ? "text-valid"
      : tone === "warn"
        ? "text-vip"
        : tone === "alert"
          ? "text-revoked"
          : "text-ink-3";

  const barTone =
    tone === "alert"
      ? "bg-revoked"
      : tone === "warn"
        ? "bg-vip"
        : tone === "good"
          ? "bg-valid"
          : "bg-accent";

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[0.8rem] text-ink-3">{label}</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="display text-[1.85rem] leading-none text-ink tabular-nums">
            {value}
          </p>
          {note ? (
            <p className={`mt-2 truncate text-xs ${noteTone}`}>{note}</p>
          ) : null}
        </div>

        {spark && spark.length > 1 ? (
          <Sparkline values={spark} className={barTone} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Bars, not a line, at this size.
 *
 * A 28px-tall line reduces to a fuzzy squiggle; discrete bars survive the
 * shrink because each hour keeps its own footprint. No axis and no labels — the
 * figure beside it is the value, and this only has to carry the shape.
 */
function Sparkline({
  values,
  className,
}: {
  values: number[];
  className: string;
}) {
  const peak = Math.max(...values, 1);

  return (
    <div
      aria-hidden
      className="flex h-8 shrink-0 items-end gap-[2px]"
      style={{ width: `${Math.min(values.length * 6, 96)}px` }}
    >
      {values.map((value, index) => (
        <span
          key={index}
          className={`w-full rounded-[2px] ${className} ${
            value === 0 ? "opacity-20" : "opacity-90"
          }`}
          style={{ height: `${Math.max((value / peak) * 100, 8)}%` }}
        />
      ))}
    </div>
  );
}
