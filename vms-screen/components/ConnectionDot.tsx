"use client";

import { useT } from "@/lib/i18n";
/**
 * Is the feed alive?
 *
 * Small, cornered, and never in the way of a name — but present, because the one
 * failure this screen cannot show you is its own. A screen with a dead socket and
 * no arrivals looks exactly like a screen with a live socket and no arrivals, and
 * the difference matters at 9am when the first delegation is at the door.
 *
 * Green breathes rather than sitting still: a static dot could be a rendering
 * artefact on a frozen panel, a moving one could not.
 */
export function ConnectionDot({ connected }: { connected: boolean }) {
  const t = useT();
  return (
    <div
      className="pointer-events-none absolute right-6 bottom-6 flex items-center gap-2"
      role="status"
      aria-label={t(
        connected ? "feed.connected" : "feed.disconnected",
      )}
    >
      <span
        className={`block h-3 w-3 rounded-full ${
          connected ? "animate-breathe bg-live" : "bg-down"
        }`}
      />
      {/* The label appears only when something is wrong. Staff should not have to
          learn what a green dot means; a red one explains itself. */}
      {connected ? null : (
        <span className="text-sm font-semibold tracking-wide text-down uppercase">
          Reconnecting
        </span>
      )}
    </div>
  );
}
