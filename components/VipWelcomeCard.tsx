"use client";

import { Photo } from "@/components/WelcomeCard";
import type { ScreenEvent } from "@/lib/api";

/**
 * A VIP arrival.
 *
 * The distinction has to survive a glance from across a lobby by someone who is
 * not looking for it, so it is carried by three things at once rather than a
 * badge in a corner: a gold wash behind the whole card, a gold ring around the
 * photo, and the word itself set large above the name. Any one of those alone
 * would be missed by someone walking past.
 *
 * Gold is the only saturated colour on this screen. Spending it anywhere else
 * would make this mean nothing.
 */
export function VipWelcomeCard({ event }: { event: ScreenEvent }) {
  return (
    <div className="animate-arrive relative flex h-full w-full items-center justify-center px-[4vw]">
      {/* Wash rather than a solid fill: the photo still has to read as a face. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_50%,var(--color-vip-deep)_0%,transparent_62%)]"
      />

      <div className="relative flex w-full max-w-[1500px] items-center gap-[clamp(2rem,4vw,4.5rem)]">
        <Photo event={event} accent />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-[0.6em] text-[clamp(1.5rem,2.4vw,2.5rem)] font-bold tracking-[0.34em] text-vip uppercase">
            VIP
            <span aria-hidden className="h-px flex-1 bg-vip/40" />
          </p>

          <h1 className="mt-[0.3em] text-[clamp(72px,7vw,8rem)] leading-[1.02] font-bold tracking-tight text-balance text-ink">
            {event.full_name}
          </h1>

          <p className="mt-[0.5em] text-[clamp(1.75rem,3vw,3rem)] leading-tight font-medium text-vip/90">
            {event.country}
          </p>

          {/* Held back to ink rather than gold: on a VIP card the gold is doing
              the signalling, and a second gold line dilutes it. */}
          {event.organization ? (
            <p className="mt-[0.25em] text-[clamp(1.25rem,2vw,2rem)] leading-tight text-ink-soft">
              {event.organization}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
