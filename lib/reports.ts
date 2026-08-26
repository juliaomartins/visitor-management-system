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

function fail(error: unknown, fallback: string): never {
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
      if (error) fail(error, "The entrance log could not be loaded.");
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
export async function downloadEntriesCsv(filters: ReportFilters): Promise<void> {
  await ensureAccessToken();

  const response = await fetch(
    `/api/v1/reports/entries.csv?${new URLSearchParams(toQuery(filters))}`,
    { headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` } },
  );

  if (!response.ok) {
    throw new ApiError(`The export failed (HTTP ${response.status}).`);
  }

  // Prefer the filename the server chose — it carries the event's local date.
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const named = /filename="?([^";]+)"?/.exec(disposition)?.[1];

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = named ?? `entrance-log-${filters.from}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
