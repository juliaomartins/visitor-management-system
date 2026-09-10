/**
 * Finding the server from a phone.
 *
 * The lobby screen can look at its own URL to work out where the backend is. A
 * native app cannot, so this probes a list of candidates instead: whatever was
 * last confirmed to work, then the address baked in at build time.
 *
 * When both fail, the phone asks. That is the whole point — a guard at a door
 * with a phone that cannot reach the server should be able to fix it themselves
 * in thirty seconds, not wait for someone to rebuild the app.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { probeServer, setApiOrigin } from "@/api/client";
import {
  candidateOrigins,
  normaliseOrigin,
  storeOrigin,
  subscribeToOriginChange,
} from "@/storage/server";

export type ServerState = {
  origin: string | null;
  /** Tried and rejected, so nobody retypes an address that just failed. */
  attempted: string[];
  searching: boolean;
  /** Every candidate failed; a person has to supply one. */
  lost: boolean;
  /** The address the server reports for itself, when one answered. */
  reportedIp: string | null;
};

export function useServer() {
  const [state, setState] = useState<ServerState>({
    origin: null,
    attempted: [],
    searching: true,
    lost: false,
    reportedIp: null,
  });

  const mounted = useRef(true);

  const search = useCallback(async () => {
    // Reading the stored address first keeps every setState below off the
    // synchronous path out of the mount effect, which would otherwise cascade a
    // second render before the first has painted. Initial state is already
    // `searching`, so nothing is lost by waiting a tick to say so.
    const candidates = await candidateOrigins();

    if (mounted.current) {
      setState((current) => ({ ...current, searching: true, lost: false }));
    }

    for (const origin of candidates) {
      const health = await probeServer(origin);
      if (!mounted.current) return;

      if (health) {
        // Tell the client before anything can issue a request against the old one.
        setApiOrigin(origin);
        setState({
          origin,
          attempted: candidates,
          searching: false,
          lost: false,
          reportedIp: health.lan_ip ?? null,
        });
        return;
      }
    }

    if (!mounted.current) return;
    setState({
      origin: null,
      attempted: candidates,
      searching: false,
      lost: true,
      reportedIp: null,
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Kicked off on its own task rather than in the effect body: discovery
    // updates state, and doing that synchronously on mount cascades a second
    // render before the first has painted.
    const start = setTimeout(() => void search(), 0);

    /*
      RESOLVING ONCE ON MOUNT IS NOT ENOUGH.

      Settings is a route pushed on top of this screen, so saving an address
      there and going back does not remount anything here — the effect above
      had already run, and the app carried on sending requests to the previous
      address until something else happened to remount. That is what made a new
      server IP need entering twice.
    */
    const unsubscribe = subscribeToOriginChange(() => void search());

    return () => {
      mounted.current = false;
      clearTimeout(start);
      unsubscribe();
    };
  }, [search]);

  /**
   * Adopt an address a person typed, but only after it has answered.
   *
   * Saving one that does not respond is the worst outcome available here: it
   * looks like it worked and fails again at the next badge.
   */
  const adopt = useCallback(async (input: string): Promise<boolean> => {
    const origin = normaliseOrigin(input);
    if (!origin) return false;

    const health = await probeServer(origin);
    if (!health) return false;

    await storeOrigin(origin);
    setApiOrigin(origin);

    if (mounted.current) {
      setState({
        origin,
        attempted: [],
        searching: false,
        lost: false,
        reportedIp: health.lan_ip ?? null,
      });
    }
    return true;
  }, []);

  const rescan = useCallback(() => {
    void search();
  }, [search]);

  return { ...state, adopt, rescan };
}
