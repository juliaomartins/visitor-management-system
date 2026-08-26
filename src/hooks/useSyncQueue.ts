/**
 * Draining the queue.
 *
 * Three things wake this loop, because any one of them alone leaves scans
 * stranded:
 *
 *   - a timer, for the ordinary case of a router that comes back on its own
 *   - the app returning to the foreground, since a backgrounded phone gets its
 *     timers throttled or frozen outright
 *   - the network reporting a connection, which turns a five-minute backoff into
 *     an immediate attempt
 *
 * `isConnected` is a hint, never a gate. This event runs on a closed LAN with no
 * route to the internet, so `isInternetReachable` is false all day and anything
 * gated on it would never sync at all. The only real test of reachability is a
 * request to the server, so the loop always tries and lets the result decide.
 */
import { useNetworkState } from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { ApiError, NetworkError } from "@/api/client";
import { recordScan } from "@/api/scans";
import {
  cacheVisitor,
  discard,
  dueScans,
  markFailed,
  markSynced,
  oldestPendingAt,
  pendingCount,
} from "@/storage/queue";

/** Idle poll. Short enough to feel prompt, long enough not to warm the phone. */
const TICK_MS = 5000;

/** Per pass. A phone back from a long outage catches up over several passes. */
const BATCH = 10;

export type SyncStatus = {
  pending: number;
  syncing: boolean;
  /** ISO timestamp of the oldest unsynced scan, or null when the queue is empty. */
  oldestPending: string | null;
  lastError: string | null;
};

export function useSyncQueue() {
  const [status, setStatus] = useState<SyncStatus>({
    pending: 0,
    syncing: false,
    oldestPending: null,
    lastError: null,
  });

  const running = useRef(false);
  const mounted = useRef(true);
  const network = useNetworkState();

  const refresh = useCallback(async () => {
    const [pending, oldest] = await Promise.all([pendingCount(), oldestPendingAt()]);
    if (!mounted.current) return;
    setStatus((current) => ({ ...current, pending, oldestPending: oldest }));
  }, []);

  const sync = useCallback(async () => {
    // One pass at a time. Two overlapping drains would send the same row twice;
    // client_uuid makes that harmless on the server, but it still wastes the
    // device's 30/min budget on work already done.
    if (running.current) return;
    running.current = true;

    if (mounted.current) setStatus((current) => ({ ...current, syncing: true }));

    try {
      const batch = await dueScans(BATCH);

      for (const scan of batch) {
        try {
          const response = await recordScan(scan.badgeToken, {
            scannedAt: new Date(scan.scannedAt),
            // Idempotency: this row may already have reached the server on an
            // attempt whose response never came back.
            clientUuid: scan.clientUuid,
          });
          await markSynced(scan.clientUuid);

          // Learn the identity so this badge can be recognised offline next time.
          if (response.visitor) {
            await cacheVisitor(scan.badgeToken, response.visitor);
          }

          if (mounted.current) {
            setStatus((current) => ({ ...current, lastError: null }));
          }
        } catch (cause) {
          if (cause instanceof NetworkError) {
            // The server is unreachable, so the rest of the batch will fail the
            // same way. Record the backoff on this row and stop — hammering a
            // dead router drains the battery and delays nothing.
            await markFailed(scan.clientUuid, cause.message);
            if (mounted.current) {
              setStatus((current) => ({ ...current, lastError: cause.message }));
            }
            break;
          }

          if (cause instanceof ApiError && cause.status === 400) {
            // Malformed beyond saving. Anything else — 401 revoked device, 429
            // throttled, 5xx — stays queued, because all of those can come good,
            // including after this phone is paired again.
            await discard(scan.clientUuid);
            continue;
          }

          const message =
            cause instanceof Error ? cause.message : "The scan could not be synced.";
          await markFailed(scan.clientUuid, message);
          if (mounted.current) {
            setStatus((current) => ({ ...current, lastError: message }));
          }

          // A 429 means this device is over its 30/min budget; the backoff on the
          // row is the right answer and the rest of the batch can wait with it.
          if (cause instanceof ApiError && cause.status === 429) break;
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setStatus((current) => ({ ...current, syncing: false }));
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    refresh();

    const timer = setInterval(sync, TICK_MS);

    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") sync();
    });

    return () => {
      mounted.current = false;
      clearInterval(timer);
      appState.remove();
    };
  }, [sync, refresh]);

  // Connectivity returning is the strongest signal there is: try at once rather
  // than waiting out whatever backoff the last failure set.
  useEffect(() => {
    if (network.isConnected) sync();
  }, [network.isConnected, sync]);

  return { status, sync, refresh };
}
