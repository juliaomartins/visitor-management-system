"use client";

import type { Entry, ScanResult } from "@/lib/reports";

/**
 * Every badge presented, refusals included.
 *
 * The result column is the point of this table, so it is not a quiet grey chip in
 * the last column. A refused scan tints its whole row and carries a filled badge
 * on the left edge, because someone scanning this list for trouble is scanning
 * down the page, not reading each row.
 *
 * Colour is never the only signal — each result has its own word, and refusals
 * carry a leading marker — so the table survives being printed in black and white
 * or read by someone colour-blind.
 */
const RESULTS: Record<
  ScanResult,
  { label: string; chip: string; row: string; marker: string; refused: boolean }
> = {
  valid: {
    label: "Valid",
    chip: "bg-ink/5 text-ink",
    row: "",
    marker: "bg-transparent",
    refused: false,
  },
  duplicate: {
    label: "Duplicate",
    chip: "bg-line text-ink-2",
    row: "",
    marker: "bg-line-strong",
    refused: false,
  },
  revoked: {
    label: "Revoked",
    chip: "bg-vip text-white",
    row: "bg-vip-soft",
    marker: "bg-vip",
    refused: true,
  },
  invalid: {
    label: "Invalid",
    chip: "bg-revoked text-white",
    row: "bg-revoked-soft",
    marker: "bg-revoked",
    refused: true,
  },
};

export function EntryTable({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="display text-lg text-ink">Nothing scanned in this range</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
          Widen the dates, or clear the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="w-1.5 px-0 py-2.5" />
            <Th>Time</Th>
            <Th>Result</Th>
            <Th>Name</Th>
            <Th>Country</Th>
            <Th>Category</Th>
            <Th>Device</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const result = RESULTS[entry.result];

            return (
              <tr
                key={entry.id}
                className={`border-b border-line last:border-0 ${result.row}`}
              >
                {/* Edge marker: readable down the page at a glance, and it
                    survives a monochrome print where the tint would not. */}
                <td className={`w-1.5 p-0 ${result.marker}`} />

                <td className="px-4 py-3 whitespace-nowrap text-ink tabular-nums">
                  {formatTime(entry.scanned_at)}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`pill-status ${result.chip}`}
                  >
                    {result.refused ? <span aria-hidden>&#9888;</span> : null}
                    {result.label.toUpperCase()}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {entry.full_name ? (
                    <>
                      <span className="font-medium text-ink">
                        {entry.full_name}
                      </span>
                      {entry.badge_serial ? (
                        <span className="mono mt-0.5 block text-[11px] text-ink-3">
                          {entry.badge_serial}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    /* An invalid scan matched no badge. Saying so beats an empty
                       cell that reads as missing data. */
                    <span className="text-ink-3 italic">Unrecognised badge</span>
                  )}
                </td>

                <td className="px-4 py-3 text-ink-2">{entry.country ?? "—"}</td>

                <td className="px-4 py-3">
                  {entry.category === "vip" ? (
                    <span className="pill-status bg-vip-soft text-vip">
                      VIP
                    </span>
                  ) : (
                    <span className="text-ink-2">{entry.category ?? "—"}</span>
                  )}
                </td>

                <td className="px-4 py-3 text-ink-2">{entry.device_name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-xs font-medium text-ink-3">{children}</th>;
}

/**
 * The server sends an offset-aware timestamp in the event's zone, so this renders
 * it in the reader's zone. On a laptop set to the event's timezone — which the one
 * at the registration desk will be — those are the same.
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
