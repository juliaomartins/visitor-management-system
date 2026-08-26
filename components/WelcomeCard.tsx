"use client";

import type { ScreenEvent } from "@/lib/api";

/**
 * One arrival, filling the wall.
 *
 * Sized for three to five metres: the name never drops below 72px, the photo
 * never below 400px tall. Both use `clamp()` with that floor rather than a fixed
 * size, so a 4K panel in a big lobby gets proportionally larger type instead of a
 * small card marooned in the middle of a black field.
 *
 * The photo is 3:4 portrait — the aspect the dashboard crops to, not the shape of
 * the card it prints on. It sits left because a name read left-to-right should not
 * have to travel back past a face to be read.
 */
export function WelcomeCard({ event }: { event: ScreenEvent }) {
  return (
    <div className="animate-arrive flex h-full w-full items-center justify-center px-[4vw]">
      <div className="flex w-full max-w-[1500px] items-center gap-[clamp(2rem,4vw,4.5rem)]">
        <Photo event={event} />

        <div className="min-w-0 flex-1">
          <p className="text-[clamp(1.25rem,2vw,2rem)] font-medium tracking-[0.3em] text-ink-faint uppercase">
            Welcome
          </p>

          <h1 className="mt-[0.35em] text-[clamp(72px,7vw,8rem)] leading-[1.02] font-bold tracking-tight text-balance text-ink">
            {event.full_name}
          </h1>

          <p className="mt-[0.5em] text-[clamp(1.75rem,3vw,3rem)] leading-tight font-medium text-ink-soft">
            {event.country}
          </p>

          {/* Optional on the Visitor model, so blank for plenty of guests. */}
          {event.organization ? (
            <p className="mt-[0.25em] text-[clamp(1.25rem,2vw,2rem)] leading-tight text-ink-faint">
              {event.organization}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Shared by both cards.
 *
 * `photo_url` is absolute, built from the backend's MEDIA_BASE_URL, so it loads
 * straight from the server rather than through the Next rewrite. If it is missing
 * or fails, the frame stays and holds the layout — a card that reflows because an
 * image 404'd is more distracting than a blank frame.
 */
export function Photo({
  event,
  accent = false,
}: {
  event: ScreenEvent;
  accent?: boolean;
}) {
  return (
    <div
      className={`aspect-3/4 h-[clamp(400px,52vh,760px)] shrink-0 overflow-hidden rounded-[1.5rem] bg-stage-raised ${
        accent ? "ring-[6px] ring-vip" : "ring-1 ring-edge"
      }`}
    >
      {event.photo_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={event.photo_url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : null}
    </div>
  );
}
