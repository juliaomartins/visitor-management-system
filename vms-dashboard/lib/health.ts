import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/**
 * The server's own account of itself: is it there, where is it, what time does
 * it think it is.
 *
 * `GET /api/v1/health` exists for the scanner and the lobby screen, which probe
 * it to find a server whose address has moved. The dashboard has never needed
 * it — it proxies `/api` server-side and follows the backend for free. Settings
 * asks for a different reason: the people running the event need to READ these
 * answers, and today the only way to get the LAN address is to run `ipconfig`
 * on the server itself.
 *
 * NOT POLLED. `useDevices` polls because a door going quiet is news that should
 * reach a desk nobody is watching; none of this is. The clock advances, and
 * that is the only thing a poll would keep fresh — against a backend that is
 * deliberately one process. Fetched on arrival, refetched when asked.
 */

/** Above 60s an arrival can land in the wrong hourly bucket. See `driftState`. */
const DRIFT_ALERT_MS = 60_000;
/** Above 10s something is wrong with a clock, even if nothing has broken yet. */
const DRIFT_WARN_MS = 10_000;

export type DriftState = "ok" | "warn" | "alert";

export type Health = {
  reachable: boolean;
  /** Round trip in milliseconds, measured around the fetch. */
  latencyMs: number;
  service?: string;
  status?: string;
  lanIp?: string;
  /** What the server said the time was. */
  serverTime?: Date;
  /** This browser's clock at the moment the server's reading was current. */
  browserTime?: Date;
  /**
   * Server minus browser, in milliseconds, corrected for latency.
   *
   * Undefined when the server did not answer or sent no time.
   */
  driftMs?: number;
  /** When this reading was taken, by the browser's clock. */
  checkedAt: Date;
};

/**
 * How far apart the two clocks are, corrected for the round trip.
 *
 * A NAIVE COMPARISON WOULD REPORT THE NETWORK AS DRIFT. `server_time` is
 * stamped somewhere in the middle of the request, so comparing it to the clock
 * at the moment the response arrives counts the whole round trip as skew. Half
 * the round trip is the usual estimate of one leg, so that is what is taken
 * off. On a LAN this is single-digit milliseconds either way and the thresholds
 * below are seconds — but reporting a 40 ms network as 40 ms of clock error
 * would make the one row on this page that has to be trusted untrustworthy.
 */
function drift(serverTime: Date, sentAt: number, latencyMs: number): number {
  const serverReadingTakenAt = sentAt + latencyMs / 2;
  return serverTime.getTime() - serverReadingTakenAt;
}

/**
 * WHY DRIFT IS ON THIS PAGE AT ALL, and why these thresholds.
 *
 * The scanner stamps each scan with its OWN `scanned_at` — it has to, because
 * the offline queue may not reach the server for minutes. The entrance report
 * then buckets those timestamps by hour. So a clock that disagrees does not
 * fail: it silently files arrivals in the wrong hour, and the only symptom is a
 * report that looks slightly wrong to somebody who was in the room.
 *
 * A minute is the point where an arrival can cross an hour boundary, so that is
 * `alert`. Ten seconds is nothing yet, but nothing on a LAN should be ten
 * seconds out either, so it is worth saying before it grows.
 */
export function driftState(driftMs: number | undefined): DriftState {
  if (driftMs === undefined) return "ok";
  const size = Math.abs(driftMs);
  if (size >= DRIFT_ALERT_MS) return "alert";
  if (size >= DRIFT_WARN_MS) return "warn";
  return "ok";
}

/**
 * The PARTS of "2s ahead", never the sentence.
 *
 * Returning a formatted string here would have hardcoded English into a
 * three-language app. The caller picks one message per direction —
 * `settings.driftAhead`, `settings.driftBehind`, `settings.driftLevel` — and
 * fills `{amount}`, because a direction glued onto a number produces English
 * word order wearing a translation, which is the thing the languages section of
 * CLAUDE.md exists to prevent.
 */
export type DriftReading =
  | { direction: "level" }
  | { direction: "ahead" | "behind"; amount: string };

export function readDrift(driftMs: number | undefined): DriftReading | null {
  if (driftMs === undefined) return null;

  const size = Math.abs(driftMs);
  // Under a second is two clocks agreeing as closely as this can measure.
  if (size < 1_000) return { direction: "level" };

  const seconds = Math.round(size / 1_000);
  // Seconds up to a minute and a half, then minutes: "90s" is harder to read
  // at a glance than "2m", and past a minute the exact figure stops mattering.
  const amount = seconds < 90 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
  return { direction: driftMs > 0 ? "ahead" : "behind", amount };
}

export function useHealth() {
  return useQuery<Health>({
    queryKey: ["health"],
    queryFn: async ({ signal }) => {
      const sentAt = Date.now();

      /*
        A failed probe is a RESULT here, not an error. TanStack's error state
        would give the page a thrown exception to render, when what the reader
        needs is a row that says "not reachable" beside the rows that did
        answer. `reachable: false` keeps the panel one shape.
      */
      try {
        const { data, error } = await api.GET("/api/v1/health", { signal });
        const latencyMs = Date.now() - sentAt;

        if (error || !data) {
          return { reachable: false, latencyMs, checkedAt: new Date() };
        }

        const serverTime = data.server_time
          ? new Date(data.server_time)
          : undefined;

        return {
          reachable: true,
          latencyMs,
          service: data.service,
          status: data.status,
          lanIp: data.lan_ip,
          serverTime,
          browserTime: new Date(),
          driftMs: serverTime
            ? drift(serverTime, sentAt, latencyMs)
            : undefined,
          checkedAt: new Date(),
        };
      } catch {
        // An aborted request lands here too, and an abort is not a dead server;
        // the query is simply discarded, so the value never reaches the page.
        return {
          reachable: false,
          latencyMs: Date.now() - sentAt,
          checkedAt: new Date(),
        };
      }
    },
    // Read on arrival, then only when asked. See the note at the top.
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
