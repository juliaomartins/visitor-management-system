/**
 * The entrance log.
 *
 * Two documents from one query: who attended, and what was refused at the door.
 * The filters below never default to hiding failures — `result` is opt-in, so the
 * first thing anyone opening this page sees is everything that happened.
 *
 * Dates are plain `YYYY-MM-DD` strings and the backend interprets them in the
 * event's timezone, which it names back in `timezone`. Nothing here constructs a
 * date from the browser's clock beyond "today", because a laptop set to the wrong
 * zone would otherwise silently ask for the wrong day.
 */
import {
  DEFAULT_LOCALE,
  translate,
  type MessageKey,
} from "@/lib/locales";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { components } from "@vms/contracts";
import { ensureAccessToken, getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/visitors";

export type Entry = components["schemas"]["Entry"];
export type EntryReport = components["schemas"]["EntryReport"];
export type EntrySummary = components["schemas"]["EntrySummary"];
export type HourBucket = components["schemas"]["HourBucket"];
export type ScanResult = components["schemas"]["ResultEnum"];

export type ReportFilters = {
  from: string;
  to: string;
  country?: string;
  category?: string;
  result?: string;
};

/** Local today as YYYY-MM-DD, without a UTC round trip that could shift the day. */
export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function fail(error: unknown, fallback: MessageKey): never {
  if (error && typeof error === "object") {
    const body = error as Record<string, unknown>;
    if (typeof body.detail === "string") throw new ApiError(body.detail);
    const first = Object.values(body).find(Array.isArray) as string[] | undefined;
    if (first?.[0]) throw new ApiError(String(first[0]));
  }
  throw new ApiError(fallback);
}

function toQuery(filters: ReportFilters): Record<string, string> {
  const query: Record<string, string> = { from: filters.from, to: filters.to };
  if (filters.country) query.country = filters.country;
  if (filters.category) query.category = filters.category;
  if (filters.result) query.result = filters.result;
  return query;
}

export function useEntryReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "entries", filters],
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/reports/entries", {
        params: { query: toQuery(filters) },
        signal,
      });
      if (error) fail(error, "error.reportLoad");
      return data;
    },
  });
}

/**
 * The CSV has to be fetched, not linked.
 *
 * A plain `<a href>` would carry no Authorization header, and the only cookie the
 * browser holds is `vms_session` — a routing hint that grants nothing — while the
 * refresh cookie is path-scoped to `/api/v1/auth` and never sent here. So the
 * link would simply 401. Fetching with the bearer token and handing the browser a
 * blob is the way to get an authenticated download.
 */
/**
 * Turn a failed download into something actionable.
 *
 * A 404 on an export route means exactly one thing: the server does not have
 * that route, so it is running an older build than this page. The dashboard
 * rebuilds the instant its source changes; the backend only picks up new code
 * when uvicorn is restarted by hand, and there is always a window between the
 * two. "HTTP 404" is true and tells nobody what to do about it.
 */
/*
  THE FORMAT'S NAME IS NO LONGER SPLICED INTO THE SENTENCE.

  It used to read `${what.toLowerCase()}` mid-clause, which needs the noun to
  behave the way an English noun behaves: lowercase in the middle, no article,
  no gender. "o relatório PDF" and "Relatóriu PDF" do not oblige. The operator
  already knows which of the three buttons they pressed, so the message says
  "that export" and stays a sentence in every language.
*/
function describeExportFailure(status: number): MessageKey {
  if (status === 404) return "reports.export.stale";
  if (status === 401 || status === 403) return "reports.export.expired";
  if (status >= 500) return "reports.export.serverError";
  return "reports.export.downloadFailed";
}

export type ReportFormat = "csv" | "xlsx" | "pdf";

/** What each format is actually for, in the words the button uses. */
export const REPORT_FORMATS: {
  format: ReportFormat;
  labelKey: MessageKey;
  hintKey: MessageKey;
}[] = [
  {
    format: "pdf",
    labelKey: "reports.format.pdf",
    hintKey: "reports.format.pdfHint",
  },
  {
    format: "xlsx",
    labelKey: "reports.format.xlsx",
    hintKey: "reports.format.xlsxHint",
  },
  {
    format: "csv",
    labelKey: "reports.format.csv",
    hintKey: "reports.format.csvHint",
  },
];

/**
 * Fetch an export and hand it to the browser.
 *
 * Every format goes through a blob for the same reason: a plain anchor carries
 * no Authorization header and would simply 401.
 *
 * The filename comes from the server where it offers one — it carries the
 * event's local date range, which is the thing that makes a folder of these
 * navigable a month later.
 */
export async function downloadEntriesExport(
  filters: ReportFilters,
  format: ReportFormat,
): Promise<void> {
  await ensureAccessToken();

  const response = await fetch(
    `/api/v1/reports/entries.${format}?${new URLSearchParams(toQuery(filters))}`,
    { headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` } },
  );

  if (!response.ok) {
    const key = describeExportFailure(response.status);
    throw new ApiError(
      translate(DEFAULT_LOCALE, key, { status: response.status }),
      {},
      key,
    );
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const named = /filename="?([^";]+)"?/.exec(disposition)?.[1];

  const url = URL.createObjectURL(await response.blob());

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = named ?? `entrance-report-${filters.from}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/** Kept so nothing that already asked for a CSV has to change. */
export async function downloadEntriesCsv(filters: ReportFilters): Promise<void> {
  return downloadEntriesExport(filters, "csv");
}
