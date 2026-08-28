"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { ConnectionDot } from "@/components/ConnectionDot";
import { ServerSetup } from "@/components/ServerSetup";
import { IdleScreen } from "@/components/IdleScreen";
import { VipWelcomeCard } from "@/components/VipWelcomeCard";
import { WelcomeCard } from "@/components/WelcomeCard";
import { useArrivalFeed } from "@/hooks/useArrivalFeed";
import { useServer } from "@/hooks/useServer";
import type { ScreenEvent } from "@/lib/api";
import {
  clearDeviceToken,
  getDeviceToken,
  subscribeToDeviceToken,
} from "@/lib/device-token";

/** Long enough to read a name across a lobby and look up at the person. */
const DISPLAY_MS = 8000;

/**
 * A rush shortens each card so the queue drains. Ten arrivals at 8s each is 80
 * seconds of backlog, and a welcome shown a minute after someone walked past is
 * worse than no welcome.
 */
const BUSY_DISPLAY_MS = 3500;
const BUSY_QUEUE = 3;

/** Same window the backend uses, applied again here — see the note below. */
const REPEAT_SUPPRESSION_MS = 60_000;

/**
 * Arrivals older than this are never shown on a cold start.
 *
 * The backfill hands over everything since the last cursor, which on a fresh boot
 * is the whole day. Replaying this morning's arrivals onto the wall at 4pm would
 * be a bizarre thing for a lobby screen to do.
 */
const STALE_ARRIVAL_MS = 2 * 60_000;

/** localStorage never changes under us here, so there is nothing to subscribe to. */
export default function ScreenPage() {
  const router = useRouter();

  // Read through useSyncExternalStore rather than an effect: localStorage is a
  // client-only external store, and this gives the value during render without a
  // mount-then-setState round trip.
  const deviceToken = useSyncExternalStore(
    subscribeToDeviceToken,
    getDeviceToken,
    () => null,
  );

  useEffect(() => {
    if (!deviceToken) router.replace("/pair");
  }, [deviceToken, router]);

  // Where the backend is, before anything tries to talk to it. Falls back to
  // this page's own hostname, which on a single-machine deployment is always the
  // server — so the screen usually reconfigures itself when the IP changes.
  const server = useServer();
  /*
    Revoked from the dashboard.

    Dropping the token is all this has to do: the store notifies, the effect
    above sees a null token and routes to the pairing form, and whoever revoked
    the screen can hand over a fresh code. Nobody is standing at the kiosk to
    press reload, so it has to happen on its own.
  */
  const { arrivals, connected, ready } = useArrivalFeed(
    deviceToken,
    server.origin,
    clearDeviceToken,
  );

  const [showing, setShowing] = useState<ScreenEvent | null>(null);
  const queue = useRef<ScreenEvent[]>([]);
  const handled = useRef<Set<number>>(new Set());
  const lastShownFor = useRef<Map<string, number>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Newest arrivals first from the hook; take them oldest-first so a burst plays
  // in the order people actually walked through the door.
  const incoming = useMemo(() => [...arrivals].reverse(), [arrivals]);

  useEffect(() => {
    if (!ready) return;

    for (const event of incoming) {
      if (handled.current.has(event.id)) continue;
      handled.current.add(event.id);

      // Do not replay history onto the wall after a restart.
      const age = Date.now() - new Date(event.scanned_at).getTime();
      if (age > STALE_ARRIVAL_MS) continue;

      /*
       * Suppress a repeat of the same visitor within a minute.
       *
       * The backend already marks a rescan `duplicate` and keeps it out of the
       * feed, so this is the second line rather than the first — it catches the
       * case that one cannot: the same guest scanned at two different doors, which
       * the server sees as two legitimate arrivals but the lobby would show as the
       * same face twice in a row.
       *
       * Keyed on photo_url and falling back to the name, because ScreenEvent
       * carries no visitor id.
       */
      const identity = event.photo_url || event.full_name;
      const previous = lastShownFor.current.get(identity);
      const scannedAt = new Date(event.scanned_at).getTime();
      if (previous !== undefined && scannedAt - previous < REPEAT_SUPPRESSION_MS) {
        continue;
      }
      lastShownFor.current.set(identity, scannedAt);

      queue.current.push(event);
    }

    if (!showing && queue.current.length > 0) {
      setShowing(queue.current.shift() ?? null);
    }
  }, [incoming, ready, showing]);

  // Hold the current card, then move on.
  useEffect(() => {
    if (!showing) return;

    const duration = queue.current.length >= BUSY_QUEUE ? BUSY_DISPLAY_MS : DISPLAY_MS;
    timer.current = setTimeout(() => {
      setShowing(queue.current.shift() ?? null);
    }, duration);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [showing]);

  // Unpaired, or the very first paint before hydration resolves the token.
  if (!deviceToken) {
    return <main className="h-dvh w-dvw bg-stage" />;
  }

  // Every candidate address failed. Nothing else on this screen can work until
  // somebody says where the server is, so it is the whole screen rather than a
  // banner over a clock that will never update.
  if (server.lost) {
    return (
      <ServerSetup attempted={server.attempted} onResolved={server.adopt} />
    );
  }

  if (server.searching && !server.origin) {
    return (
      <main className="flex h-dvh w-dvw items-center justify-center bg-stage">
        <p className="text-2xl tracking-[0.2em] text-ink-faint uppercase">
          Finding the server
        </p>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-stage">
      {showing ? (
        // Keyed on the event id so React remounts the card and the entry
        // animation replays for each arrival rather than only the first.
        showing.category === "vip" ? (
          <VipWelcomeCard key={showing.id} event={showing} />
        ) : (
          <WelcomeCard key={showing.id} event={showing} />
        )
      ) : (
        <IdleScreen waiting={connected} />
      )}

      <ConnectionDot connected={connected} />
    </main>
  );
}
