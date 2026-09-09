"use client";

import { useFormat, useT } from "@/lib/i18n";
import type { EntryReport } from "@/lib/reports";

/**
 * The recapitulation: what the numbers mean, before the table of what they are.
 *
 * Every figure and every sentence here comes from the server's `insights`, which
 * is the same object the PDF and the workbook are built from. The page does not
 * re-derive anything in TypeScript — two implementations of "attendance rate"
 * would agree right up until somebody changed one of them, and then a client
 * would be holding a PDF that disagrees with the screen it was exported from.
 *
 * A table answers "what happened". This answers "so what", which is the half a
 * customer actually reads.
 */
export function Recap({ report }: { report: EntryReport }) {
  const summary = report.summary;

  /*
    `insights` is declared required by the contract, and at runtime it can still
    be missing: the dashboard is rebuilt the moment its source changes, while the
    backend only picks up new code when uvicorn is restarted by hand. Between
    those two moments the page is talking to a server one build behind.

    That window is normal and it will happen again. Reading straight through the
    optimistic type crashed the whole page with "cannot read properties of
    undefined", which is a worse answer than saying what is actually wrong — so
    the type is widened here deliberately rather than trusted.
  */
  const t = useT();
  const format = useFormat();
  const insights = report.insights as EntryReport["insights"] | undefined;

  if (!insights) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="display text-[1.05rem] text-ink">
          {t("recap.unavailable")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          {t("recap.unavailableBody")}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure
            label={t("recap.scans")}
            value={format.number(summary.total)}
            note={t("recap.inRange")}
          />
          <Figure
            label={t("recap.people")}
            value={format.number(summary.unique_visitors)}
            note={t("recap.distinct")}
          />
          <Figure
            label={t("recap.duplicates")}
            value={String(summary.by_result.duplicate)}
            note={t("recap.reEntries")}
          />
          <Figure
            label={t("recap.refused")}
            value={String(summary.by_result.invalid + summary.by_result.revoked)}
            note={t("recap.invalidOrRevoked")}
            tone={
              summary.by_result.invalid + summary.by_result.revoked > 0
                ? "alert"
                : "good"
            }
          />
        </div>
      </section>
    );
  }

  if (summary.total === 0) {
    return (
      <section className="card px-6 py-14 text-center">
        <p className="display text-lg text-ink">
          {t("recap.nothingScanned")}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-3">
          {t("recap.nothingScannedBody")}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label={t("recap.attendance")}
          value={`${insights.attendance_rate}%`}
          note={t("recap.attendanceNote", {
            arrived: insights.arrived,
            registered: insights.registered,
          })}
          tone="accent"
        />
        <Figure
          label={t("recap.scansLogged")}
          value={format.number(summary.total)}
          note={t("recap.repeatNote", { count: insights.repeat_people })}
        />
        <Figure
          label={t("recap.busiestHour")}
          value={insights.peak_hour ? formatHour(insights.peak_hour) : "—"}
          note={
            insights.peak_hour
              ? t("recap.peakNote", {
                  total: insights.peak_total,
                  share: insights.peak_share,
                })
              : t("recap.noArrivals")
          }
        />
        <Figure
          label={t("recap.refused")}
          value={String(insights.refused)}
          note={
            insights.refused > 0
              ? t("recap.refusalNote", { rate: insights.refusal_rate })
              : t("recap.noneTurnedAway")
          }
          tone={insights.refused > 0 ? "alert" : "good"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* The report in sentences. Written server-side so the PDF says the
            same words. */}
        <div className="card p-5 sm:p-6">
          <h2 className="display text-[1.05rem] text-ink">
            {t("recap.whatNumbersSay")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {t("recap.whatNumbersSayNote")}
          </p>

          <ul className="mt-4 space-y-2.5">
            {/*
              THESE SENTENCES ARE WRITTEN BY THE BACKEND AND ARRIVE IN ENGLISH.

              `apps/reports/services.py` composes the narrative so the PDF and
              this panel say the same words, which is the right call and the
              reason they cannot be translated here: there is no key to look up,
              only prose. Making the report multilingual is a change to that
              service -- and to the PDF it also writes -- not to this component.
            */}
            {insights.narrative.map((line, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                <span
                  aria-hidden
                  className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5 sm:p-6">
          <h2 className="display text-[1.05rem] text-ink">
            {t("recap.loadByDoor")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {t("recap.loadByDoorNote")}
          </p>

          {insights.doors.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">
              {t("recap.noDoorScan")}
            </p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {insights.doors.map((door) => (
                <li key={door.device}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-ink">
                      {door.device}
                    </span>
                    <span className="mono shrink-0 text-xs text-ink-3">
                      {door.total} · {door.share}%
                    </span>
                  </div>

                  {/* Share of traffic, with refusals split out rather than
                      folded into the same bar. */}
                  <div className="mt-1.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-card-2">
                    <span
                      className="rounded-full bg-accent"
                      style={{ width: `${(door.valid / door.total) * 100}%` }}
                    />
                    {door.refused > 0 ? (
                      <span
                        className="rounded-full bg-revoked"
                        style={{ width: `${(door.refused / door.total) * 100}%` }}
                      />
                    ) : null}
                  </div>

                  {door.refused > 0 ? (
                    <p className="mt-1 text-xs text-revoked">
                      {t("recap.refusedHere", { count: door.refused })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* The one list nothing else in the app produces. During the event it is a
          call sheet; afterwards it is the no-show record. */}
      {insights.not_arrived_count > 0 ? (
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display text-[1.05rem] text-ink">
              {t("recap.notArrived")}
            </h2>
            <span className="pill-status bg-vip-soft text-vip">
              {t("recap.notArrivedCount", {
                count: insights.not_arrived_count,
                registered: insights.registered,
              })}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-3">
            {t("recap.notArrivedNote")}
          </p>

          <ul className="mt-4 flex flex-wrap gap-2">
            {insights.not_arrived.slice(0, 24).map((visitor) => (
              <li
                key={visitor.badge_serial}
                className="flex items-center gap-2 rounded-lg bg-card-2 px-3 py-1.5"
              >
                <span className="text-sm text-ink">{visitor.full_name}</span>
                <span className="mono text-[11px] text-ink-3">
                  {visitor.country}
                </span>
                {visitor.category === "vip" ? (
                  <span className="pill-status bg-vip-soft text-vip">VIP</span>
                ) : null}
              </li>
            ))}
          </ul>

          {insights.not_arrived_count > 24 ? (
            <p className="mt-3 text-xs text-ink-3">
              and {insights.not_arrived_count - 24} more.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Figure({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "accent" | "good" | "alert";
}) {
  const valueTone =
    tone === "accent"
      ? "text-accent"
      : tone === "good"
        ? "text-valid"
        : tone === "alert"
          ? "text-revoked"
          : "text-ink";

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[0.8rem] text-ink-3">{label}</p>
      <p className={`display mt-2 text-[1.85rem] leading-none ${valueTone}`}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">{note}</p>
    </div>
  );
}

/**
 * The server sends an offset-aware timestamp in the event's zone, so this renders
 * it in the reader's zone. On the laptop at the registration desk those are the
 * same.
 */
function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
