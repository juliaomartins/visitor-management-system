"use client";

import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import Link from "next/link";

import type { Entry, ScanResult } from "@/lib/reports";

/**
 * The last badges presented at any door.
 *
 * Refusals are in here with everything else. This is the security record as much
 * as the attendance one, and a list that quietly showed only the successes would
 * be the wrong thing to put on the page somebody watches during the event.
 *
 * Status is a word plus a colour, never a colour — the amber used for a revoked
 * badge sits below 3:1 on white, so the label is doing the real work.
 */
/* Keys, not words -- a module constant, built before any translator. */
const RESULTS: Record<
  ScanResult,
  { labelKey: MessageKey; className: string; refused: boolean }
> = {
  valid: {
    labelKey: "scan.valid",
    className: "bg-valid-soft text-valid",
    refused: false,
  },
  duplicate: {
    labelKey: "scan.duplicate",
    className: "bg-card-2 text-ink-2",
    refused: false,
  },
  revoked: {
    labelKey: "scan.revoked",
    className: "bg-vip-soft text-vip",
    refused: true,
  },
  invalid: {
    labelKey: "scan.invalid",
    className: "bg-revoked-soft text-revoked",
    refused: true,
  },
};

export function RecentArrivals({ entries }: { entries: Entry[] }) {
  const t = useT();
  if (entries.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="font-medium text-ink">Nothing scanned yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
          {t("overview.arrivalsAppear")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-line bg-card-2 text-left">
            <Th>Time</Th>
            <Th>{t("overview.colVisitor")}</Th>
            <Th>{t("form.country")}</Th>
            <Th>{t("visitor.col.result")}</Th>
            <Th>Door</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const result = RESULTS[entry.result];

            return (
              <tr
                key={entry.id}
                className="border-b border-line last:border-0 hover:bg-card-2"
              >
                <td className="mono px-4 py-3 whitespace-nowrap text-ink-2">
                  {formatTime(entry.scanned_at)}
                </td>

                <td className="px-4 py-3">
                  {entry.full_name ? (
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent"
                      >
                        {initials(entry.full_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {entry.full_name}
                        </span>
                        {entry.badge_serial ? (
                          <span className="mono block truncate text-[11px] text-ink-3">
                            {entry.badge_serial}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : (
                    /* An invalid scan matched no badge. Saying so beats an empty
                       cell that reads as missing data. */
                    <span className="text-ink-3 italic">Unrecognised badge</span>
                  )}
                </td>

                <td className="px-4 py-3 text-ink-2">{entry.country ?? "—"}</td>

                <td className="px-4 py-3">
                  <span className={`pill-status ${result.className}`}>
                    {result.refused ? <span aria-hidden>&#9888;</span> : null}
                    {t(result.labelKey)}
                  </span>
                </td>

                <td className="px-4 py-3 text-ink-2">{entry.device_name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-line px-4 py-3">
        <Link
          href="/reports"
          className="text-sm font-medium text-accent hover:underline"
        >
          {t("overview.openLog")}
        </Link>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-medium text-ink-3">{children}</th>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * The server sends an offset-aware timestamp in the event's zone, so this renders
 * it in the reader's zone. On the laptop at the registration desk those are the
 * same.
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
