/**
 * One badge in frame, one request — and one row in SQLite before that.
 *
 * Every read is committed locally before the network is touched. A guard must
 * never lose a scan to a router hiccup, so the order is: write, then send, then
 * delete on confirmation. If the send fails the row stays and `useSyncQueue`
 * takes it from there.
 *
 * `expo-camera` reports a barcode on nearly every preview frame, so a badge held
 * still under the lens fires dozens of times a second. Unguarded that would blow
 * the 30/min device throttle in two seconds and fill the queue with duplicates
 * the moment a guard set the phone down facing a lanyard.
 *
 * Three gates, in order of cheapness:
 *
 *   1. Anything but `idle` ignores the camera outright — while a request is in
 *      flight, and while a verdict is on screen.
 *   2. The same payload is refused for COOLDOWN_MS after it was accepted, so
 *      re-reading the badge still in frame does nothing.
 *   3. A different badge is accepted immediately. Two guests presenting back to
 *      back must not wait out someone else's cooldown.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, NetworkError } from "@/api/client";
import { recordScan, type ScanResponse } from "@/api/scans";
import {
  cacheVisitor,
  discard,
  enqueueScan,
  lookupCachedVisitor,
  markFailed,
  markSynced,
  type CachedVisitor,
} from "@/storage/queue";

/** Long enough to lower the phone and raise it again deliberately. */
const COOLDOWN_MS = 3000;

/** A valid arrival clears itself; the guard is already looking at the next guest. */
const VALID_DISMISS_MS = 2200;

/** A repeat is informational — shorter still. */
const DUPLICATE_DISMISS_MS = 1600;

/**
 * A queued scan does NOT auto-dismiss. It is the one state where the guard has to
 * make the call themselves, so it waits for a deliberate tap.
 */
export type ScanState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "result"; response: ScanResponse }
  /** Saved locally, unverified. Never rendered as a verdict. */
  | { phase: "queued"; visitor: CachedVisitor | null; scannedAt: Date }
  /**
   * Distinct from a `result`, deliberately. An invalid badge means "this person
   * cannot come in"; a failure here means the server refused the request for a
   * reason that is not about the badge at all.
   */
  | { phase: "error"; message: string; recoverable: boolean };

export function useScanner(onQueueChanged?: () => void) {
  const [state, setState] = useState<ScanState>({ phase: "idle" });

  // Refs, not state: the camera callback fires far too often to re-render on,
  // and these must be readable synchronously inside it.
  const phaseRef = useRef<ScanState["phase"]>("idle");
  const lastTokenRef = useRef<string | null>(null);
  const lastAtRef = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const move = useCallback((next: ScanState) => {
    if (!mounted.current) return;
    phaseRef.current = next.phase;
    setState(next);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
    move({ phase: "idle" });
  }, [move]);

  const scheduleDismiss = useCallback(
    (ms: number) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => move({ phase: "idle" }), ms);
    },
    [move],
  );

  const submit = useCallback(
    async (badgeToken: string) => {
      move({ phase: "sending" });

      const scannedAt = new Date();

      // LOCAL FIRST. Everything below can fail; this cannot be skipped.
      let queued: { clientUuid: string } | null = null;
      try {
        queued = await enqueueScan(badgeToken, scannedAt);
      } catch {
        // SQLite itself failed — a full disk, a corrupted database. Do not pretend
        // the scan was saved; that is the one lie this app must never tell.
        move({
          phase: "error",
          message:
            "This phone could not save the scan. Record the badge serial by hand and tell an organiser.",
          recoverable: false,
        });
        return null;
      }

      try {
        const response = await recordScan(badgeToken, {
          scannedAt,
          clientUuid: queued.clientUuid,
        });

        await markSynced(queued.clientUuid);
        if (response.visitor) await cacheVisitor(badgeToken, response.visitor);
        onQueueChanged?.();

        move({ phase: "result", response });

        // Only the outcomes that need no action clear themselves. A refused badge
        // stays until the guard dismisses it — it is a decision, not a
        // notification, and it must not vanish while they look up at the guest.
        if (response.result === "valid") scheduleDismiss(VALID_DISMISS_MS);
        else if (response.result === "duplicate") scheduleDismiss(DUPLICATE_DISMISS_MS);

        return response;
      } catch (cause) {
        if (cause instanceof NetworkError) {
          // The row stays queued. Show whoever this phone remembers, clearly
          // labelled as a memory rather than a check.
          await markFailed(queued.clientUuid, cause.message);
          onQueueChanged?.();

          const cached = await lookupCachedVisitor(badgeToken).catch(() => null);
          move({ phase: "queued", visitor: cached, scannedAt });
          return null;
        }

        if (cause instanceof ApiError) {
          // 400 is the badge, not the network — it will never succeed, so it must
          // not sit in the queue forever.
          if (cause.status === 400) await discard(queued.clientUuid);
          else await markFailed(queued.clientUuid, cause.message);
          onQueueChanged?.();

          move({
            phase: "error",
            // 401 means this phone was revoked from the dashboard; retrying will
            // not fix it, and the guard needs to fetch someone rather than keep
            // pressing a button.
            message:
              cause.status === 401
                ? `${cause.message} Pair this phone again from the dashboard. Scans already saved here will sync once you do.`
                : cause.message,
            recoverable: cause.status !== 401,
          });
          return null;
        }

        await markFailed(queued.clientUuid, "Unknown error");
        onQueueChanged?.();
        move({ phase: "error", message: "Something went wrong.", recoverable: true });
        return null;
      }
    },
    [move, scheduleDismiss, onQueueChanged],
  );

  /**
   * Handed to `<CameraView onBarcodeScanned>`. Returns the accepted token, or
   * null when the read was swallowed by one of the gates.
   */
  const onBarcodeScanned = useCallback(
    (data: string): string | null => {
      if (phaseRef.current !== "idle") return null;

      const token = data.trim();
      if (!token) return null;

      const now = Date.now();
      if (token === lastTokenRef.current && now - lastAtRef.current < COOLDOWN_MS) {
        return null;
      }

      lastTokenRef.current = token;
      lastAtRef.current = now;

      // Claim the gate before awaiting, or the next camera frame slips through
      // while this one is still in `submit`.
      phaseRef.current = "sending";
      void submit(token);
      return token;
    },
    [submit],
  );

  /**
   * There is deliberately no re-submit here.
   *
   * The scan is already a row in the queue, so "try again" means draining the
   * queue, not scanning again. Re-submitting would enqueue a second row with a
   * second client_uuid, and the server would rightly treat that as a second
   * presentation of the card — idempotency protects against a replayed request,
   * not against the app asking twice.
   */
  return { state, onBarcodeScanned, dismiss };
}
