"use client";

import type { EntrySummary } from "@/lib/reports";

/**
 * How the day's scans divided, by outcome.
 *
 * FOUR outcomes, not two. A duplicate is somebody already inside coming back
 * through a door — it is not a refusal, and folding it into one would inflate
 * every "refused" figure a security review reads.
 *
 * The colours are the validated status set (see globals.css). Amber sits at
 * 2.86:1 against white, which obligates relief: every row here carries its word
 * and its number, and the reports page is the table view. Never colour alone.
 */
const ROWS = [
  { key: "valid", label: "Valid", swatch: "bg-valid", text: "text-valid" },
  {
    key: "duplicate",
    label: "Duplicate",
    swatch: "bg-neutral-mark",
    text: "text-ink-2",
  },
  { key: "revoked", label: "Revoked", swatch: "bg-vip", text: "text-vip" },
  { key: "invalid", label: "Invalid", swatch: "bg-revoked", text: "text-revoked" },
] as const;

export function OutcomeSplit({ summary }: { summary: EntrySummary }) {
  const total = summary.total || 0;

  return (
    <div className="px-5 pb-5">
      {/* One stacked strip: the shape of the day in a single glance. A 2px
          surface gap keeps the segments from reading as one block. */}
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-card-2">
        {ROWS.map((row) => {
          const value = summary.by_result[row.key] ?? 0;
          if (value === 0) return null;
          return (
            <span
              key={row.key}
              className={`${row.swatch} first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${(value / Math.max(total, 1)) * 100}%` }}
            />
          );
        })}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        {ROWS.map((row) => {
          const value = summary.by_result[row.key] ?? 0;
          const share = total === 0 ? 0 : Math.round((value / total) * 100);

          return (
            <div key={row.key}>
              <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${row.swatch}`}
                />
                {row.label}
              </dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`display text-lg leading-none tabular-nums ${row.text}`}
                >
                  {value}
                </span>
                <span className="mono text-[11px] text-ink-3">{share}%</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
        {total === 0
          ? "Nothing has been scanned yet today."
          : `${summary.unique_visitors} ${
              summary.unique_visitors === 1 ? "person has" : "people have"
            } arrived across ${total} ${total === 1 ? "scan" : "scans"}.`}
      </p>
    </div>
  );
}
