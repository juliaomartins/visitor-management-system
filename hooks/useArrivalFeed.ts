"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, fetchFeed, feedSocketUrl, type ScreenEvent } from "@/lib/api";

/**
 * WebSocket for speed, backfill for recovery. Both, always (CLAUDE.md #6).
 *
 * The socket delivers an arrival in about 200ms, which is what makes the screen
 * feel alive. It is not reliable: `InMemoryChannelLayer` has no queue, so a
 * backend restart drops every group membership and silently loses whatever was
 * in flight. `GET /screen/feed?since=<last id>` runs on every `onopen` — first
 * connection and every reconnection — and fills the gap.
 *
 * Both paths carry the same serializer output, so an event arriving twice is
 * harmless: dedupe is by `id`, which is a BigAutoField and therefore also the
 * monotonic cursor.
 */

/** Long enough not to hammer a rebooting server, short enough to feel instant. */
const RECONNECT_MS = 2000;

/**
 * Idle sockets get dropped — by the router, by a proxy, by Chrome throttling a
 * background tab — and a lobby has long quiet stretches between arrival waves.
 *
 * The payload is JSON, not the string "ping". `ScreenConsumer` inherits
 * `AsyncJsonWebsocketConsumer`, whose `receive` runs `json.loads` on every inbound
 * frame; a bare "ping" raises JSONDecodeError, kills the consumer task and closes
 * the socket. Valid JSON lands in `receive_json`, which is an inherited no-op and
 * ignores it. Verified against the real consumer.
 */
const PING_MS = 30_000;
const PING_FRAME = JSON.stringify({ type: "ping" });

export type ArrivalFeed = {
  arrivals: ScreenEvent[];
  connected: boolean;
  /** False until the first backfill settles, so the idle screen does not flash. */
  ready: boolean;
};

/**
 * The close code the consumer sends when a device is revoked mid-session.
 *
 * IT ONLY ARRIVES ON A SOCKET THAT WAS ALREADY OPEN. `ScreenConsumer.connect()`
 * rejects an unauthorised token by calling `close()` BEFORE `accept()`, which
 * makes the server refuse the handshake with HTTP 403 — and a browser reports a
 * failed handshake as CloseEvent.code 1006, never as the code the server named.
 * Verified against the running server.
 *
 * So this code catches the push that disconnects a live screen, and nothing else.
 * A screen whose token died while it was disconnected, or which boots already
 * revoked, only ever sees 1006 — which is also what an unplugged network looks
 * like. Telling those two apart is what `checkToken` below is for.
 */
const CLOSE_UNAUTHORIZED = 4401;

export function useArrivalFeed(
  deviceToken: string | null,
  /** Resolved by lib/server; null until a live backend has been found. */
  serverOrigin: string | null,
  /** Called when the backend says this token is finished. */
  onRevoked?: () => void,
): ArrivalFeed {
  const [arrivals, setArrivals] = useState<ScreenEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);

  // Held in a ref so a caller passing an inline arrow does not tear down and
  // rebuild the socket on every render. Written in an effect, not during render:
  // a ref mutated while rendering is a value React is entitled to discard.
  const revoked = useRef(onRevoked);
  useEffect(() => {
    revoked.current = onRevoked;
  }, [onRevoked]);

  const seen = useRef<Set<number>>(new Set());
  const lastId = useRef(0);
  const socket = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);

  const add = useCallback((event: ScreenEvent) => {
    if (!event || typeof event.id !== "number") return;
    if (seen.current.has(event.id)) return;

    seen.current.add(event.id);
    if (event.id > lastId.current) lastId.current = event.id;

    // Newest first. Capped because a screen left running all day would otherwise
    // hold every arrival of the event in memory for no one to look at.
    setArrivals((current) => [event, ...current].slice(0, 50));
  }, []);

  const backfill = useCallback(
    async (origin: string, token: string) => {
      try {
        const feed = await fetchFeed(origin, lastId.current, token);
        // Ascending from the server; add oldest first so `arrivals[0]` really is
        // the most recent once they are all in.
        feed.events.forEach(add);
        if (feed.last_id > lastId.current) lastId.current = feed.last_id;
      } catch (cause) {
        // A failed backfill is usually not fatal — the socket still delivers new
        // arrivals and the next reconnect tries again. A 401 is different: the
        // token is dead, so every retry from here is wasted and the screen has to
        // go and get a new one.
        if (cause instanceof ApiError && cause.status === 401) {
          alive.current = false;
          revoked.current?.();
        }
      } finally {
        if (alive.current) setReady(true);
      }
    },
    [add],
  );

  /**
   * Is this token dead, or is the server simply unreachable?
   *
   * Both look identical from a closed socket. HTTP can tell them apart: the feed
   * endpoint answers 401 for a revoked device and fails at the transport layer
   * when nothing is listening. This is the only reliable revocation signal the
   * screen has, because the handshake rejection never carries one.
   */
  const checkToken = useCallback(
    async (origin: string, token: string): Promise<"revoked" | "unknown"> => {
      try {
        await fetchFeed(origin, lastId.current, token);
        return "unknown";
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) return "revoked";
        // Anything else — no route, 5xx, timeout — is not evidence about the
        // token. Keep reconnecting; a revoked screen will be caught next time.
        return "unknown";
      }
    },
    [],
  );

  useEffect(() => {
    if (!deviceToken || !serverOrigin) return;

    alive.current = true;

    const clearTimers = () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
      reconnectTimer.current = null;
      pingTimer.current = null;
    };

    const connect = () => {
      if (!alive.current) return;

      const ws = new WebSocket(feedSocketUrl(serverOrigin, deviceToken));
      socket.current = ws;

      ws.onopen = () => {
        if (!alive.current) return;
        setConnected(true);
        void backfill(serverOrigin, deviceToken);

        if (pingTimer.current) clearInterval(pingTimer.current);
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(PING_FRAME);
        }, PING_MS);
      };

      ws.onmessage = (message) => {
        try {
          add(JSON.parse(message.data as string) as ScreenEvent);
        } catch {
          // A frame we cannot parse is not worth tearing the socket down for.
        }
      };

      ws.onclose = (event) => {
        if (pingTimer.current) clearInterval(pingTimer.current);
        pingTimer.current = null;
        if (!alive.current) return;

        setConnected(false);

        // Pushed off a live socket by a revoke. Unambiguous, so act at once.
        if (event.code === CLOSE_UNAUTHORIZED) {
          alive.current = false;
          revoked.current?.();
          return;
        }

        /*
          Everything else arrives as 1006 — a refused handshake and a pulled
          network cable are indistinguishable at this point. Ask HTTP which one it
          is before deciding, because guessing either way is wrong: assume revoked
          and a Wi-Fi blip drops a working screen to the pairing form; assume
          offline and a revoked screen loops on "Reconnecting" forever, which is
          exactly what it used to do.
        */
        void checkToken(serverOrigin, deviceToken).then((verdict) => {
          if (!alive.current) return;

          if (verdict === "revoked") {
            alive.current = false;
            revoked.current?.();
            return;
          }

          // Reconnecting re-runs onopen, which re-runs the backfill. That is the
          // whole recovery story: nothing else needs to know an outage happened.
          reconnectTimer.current = setTimeout(connect, RECONNECT_MS);
        });
      };

      // onerror is always followed by onclose; let that one handler own retrying.
      ws.onerror = () => {};
    };

    connect();

    return () => {
      alive.current = false;
      clearTimers();
      const ws = socket.current;
      socket.current = null;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [deviceToken, serverOrigin, add, backfill, checkToken]);

  // `ready` is derived rather than set: with no token there is nothing to wait
  // for, and writing that into state from an effect would be a cascading render
  // for a value already known during this one.
  return { arrivals, connected, ready: deviceToken && serverOrigin ? ready : true };
}
