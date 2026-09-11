"use client";

import { OUTCOMES } from "@/components/charts/outcomes";
import { useT } from "@/lib/i18n";
import type { EntrySummary } from "@/lib/reports";

/**
 * How the day's scans divided, by outcome.
 *
 * FOUR outcomes, not three. The hour chart on the reports page folds revoked
 * and invalid into one "refused" bar because its question is how busy an hour
 * was; this panel's question is what KIND of refusal, which is the one a
 * security review actually asks. A duplicate is somebody already inside coming
 * back through a door -- not a refusal at all.
 *
 * THIS PANEL WAS SHOWING 1 / 1 / 1 / 1 AGAINST A DAY OF 91 SCANS, and the
 * component was innocent. `counts_by_result` in the backend inherited an
 * explicit `.order_by("-scanned_at", "-id")` from `entry_log()`, Django folded
 * it into the `GROUP BY`, and grouping by the primary key made every count 1.
 * See the docstring there -- it is the reason this panel is worth looking at
 * again at all.
 *
 * REVOKED CARRIES A HATCH, and it is not decoration. Green, gold and red all
 * collapse toward one axis under red-green colour blindness, so lightness is
 * the only escape, and the dark theme's usable band (OKLCH L 0.48-0.67) is too
 * narrow to hold four hues apart: measured, revoked against invalid came out at
 * dE 1.9 for a deuteranope -- one colour. Those are precisely the two that add
 * up to "refused at the door". Re-stepping the gold fixed the light theme and
 * could not fix the dark one, so the fourth series is separated by texture
 * instead. Every row also carries its word and its number, and the reports page
 * is the table view; none of this is ever colour alone.
 */
export function OutcomeSplit({ summary }: { summary: EntrySummary }) {
  const t = useT();
  const total = summary.total || 0;

  return (
    <div className="px-5 pb-5">
      {/* One stacked strip: the shape of the day in a single glance. A 2px
          surface gap keeps the segments from reading as one block. */}
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-card-2"
        role="img"
        aria-label={OUTCOMES.map(
          (row) => `${t(row.labelKey)} ${summary.by_result[row.key] ?? 0}`,
        ).join(", ")}
      >
        {OUTCOMES.map((row) => {
          const value = summary.by_result[row.key] ?? 0;
          if (value === 0) return null;

          return (
            <span
              key={row.key}
              className="first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(value / Math.max(total, 1)) * 100}%`,
                ...(row.hatch
                  ? {
                      // The hatch is drawn against the card, so it reads as
                      // texture rather than as a second colour.
                      backgroundImage: `repeating-linear-gradient(45deg, ${row.fill} 0 3px, var(--color-card) 3px 5px)`,
                    }
                  : { background: row.fill }),
              }}
            />
          );
        })}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        {OUTCOMES.map((row) => {
          const value = summary.by_result[row.key] ?? 0;
          const share = total === 0 ? 0 : Math.round((value / total) * 100);

          return (
            <div key={row.key}>
              <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={
                    row.hatch
                      ? {
                          backgroundImage: `repeating-linear-gradient(45deg, ${row.fill} 0 2px, var(--color-card) 2px 4px)`,
                        }
                      : { background: row.fill }
                  }
                />
                {t(row.labelKey)}
              </dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                {/*
                  The figure wears the outcome's INK, not its fill. Amber's fill
                  is 2.77:1 on white -- fine for a block beside a word, not for
                  a numeral that has to be read.
                */}
                <span
                  className="display text-xl leading-none tabular-nums"
                  style={{ color: row.ink }}
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
        {/*
          Two counts in one sentence, so all four combinations are their own
          message. Portuguese conjugates the verb for the first and agrees the
          noun with the second; no amount of fragment-gluing produces that.
        */}
        {total === 0
          ? t("overview.nothingToday")
          : t(
              summary.unique_visitors === 1
                ? total === 1
                  ? "overview.arrivedSummary.oneOne"
                  : "overview.arrivedSummary.oneMany"
                : total === 1
                  ? "overview.arrivedSummary.manyOne"
                  : "overview.arrivedSummary.manyMany",
              { people: summary.unique_visitors, scans: total },
            )}
      </p>
    </div>
  );
}
