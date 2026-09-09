"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  candidateOrigins,
  resolveServer,
  setOverride,
  type ProbeResult,
} from "@/lib/server";

/**
 * Which address is the backend actually on?
 *
 * Resolved once at startup by probing candidates in order, then re-probed if the
 * socket cannot stay up — because "the server moved" and "the server is briefly
 * down" look identical from a lobby, and only one of them is fixed by waiting.
 *
 * Re-probing is deliberately slow to trigger. A screen that shows a setup form
 * every time a router hiccups is worse than one that says "reconnecting" for a
 * minute, so it takes a sustained failure to give up on the known address.
 */

/** Consecutive failed reconnects before the screen suspects the address itself. */
const FAILURES_BEFORE_RESCAN = 5;

export type ServerState = {
  origin: string | null;
  /** Addresses tried and rejected, shown to whoever has to type the right one. */
  attempted: string[];
  searching: boolean;
  /** True once every candidate has failed and a person needs to intervene. */
  lost: boolean;
  /** The LAN address the server reports for itself; useful when config is stale. */
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
    if (mounted.current) {
      setState((current) => ({ ...current, searching: true, lost: false }));
    }

    const tried = candidateOrigins();
    const found: ProbeResult | null = await resolveServer();

    if (!mounted.current) return;

    setState({
      origin: found?.origin ?? null,
      attempted: tried,
      searching: false,
      lost: found === null,
      reportedIp: found?.lanIp ?? null,
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Same reasoning as the scanner's copy: discovery sets state, so it starts on
    // its own task rather than synchronously inside the mount effect.
    const start = setTimeout(() => void search(), 0);

    return () => {
      mounted.current = false;
      clearTimeout(start);
    };
  }, [search]);

  /** Called from the manual setup form once an address has been verified live. */
  const adopt = useCallback((origin: string) => {
    setOverride(origin);
    setState({
      origin,
      attempted: [],
      searching: false,
      lost: false,
      reportedIp: null,
    });
  }, []);

  /** Give up on the current address and look again from scratch. */
  const rescan = useCallback(() => {
    void search();
  }, [search]);

  return { ...state, adopt, rescan, FAILURES_BEFORE_RESCAN };
}
