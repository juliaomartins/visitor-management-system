"use client";

import { AnimatePresence, motion } from "framer-motion";

import { FitText } from "@/components/FitText";
import { clampPx, useViewport } from "@/hooks/useViewport";

import type { ScreenEvent } from "@/lib/api";

/**
 * Who is waiting behind the person on the wall.
 *
 * A COLUMN, NOT AN OVERLAY. The previous version was absolutely positioned over
 * the bottom of the hero and covered the country and organisation lines — the
 * two facts this screen exists to show. It now occupies its own grid track, so
 * it cannot overlap the hero at any viewport: the layout reserves the space
 * rather than the strip borrowing it.
 *
 * Vertical, because that is what buys the width. A horizontal row of four had
 * roughly 200px per name and truncated them; a column has the better part of
 * 500px, which fits "Katherine Johnson" on one line and wraps anything longer.
 *
 * NOTHING IS ELLIPSIZED. A name cut to "Katherine J…" at five metres is not a
 * shortened name, it is an unreadable one — the person standing there cannot
 * tell whether the screen means them. Names wrap to two lines and the cap drops
 * instead.
 *
 * The avatar carries the `layoutId` the hero shares, which is what makes a
 * promotion one continuous move rather than a crossfade.
 */
export const MAX_VISIBLE = 3;

/** Three lines before the size steps down. A queue row can afford the height. */
const NAME_LINE_CLAMP = 3;

export function ArrivalQueue({ queued }: { queued: ScreenEvent[] }) {
  const visible = queued.slice(0, MAX_VISIBLE);
  const overflow = queued.length - visible.length;
  const { width, height } = useViewport();

  /*
    A queued name gets the same treatment as the hero's, one step smaller.

    THE FLOOR IS 22px. That is roughly 4mm of cap height at 96dpi — legible at
    five metres for someone who is looking, which is what a queue row is for: the
    person waiting is watching for their own name. The hero's 44px floor is for
    somebody who is NOT looking, walking past. Different jobs, different floors.
  */
  const name = {
    max: clampPx(22, Math.min(width * 0.019, height * 0.032), 40),
    min: 22,
  };

  return (
    <aside className="relative z-10 flex min-h-0 min-w-0 flex-col justify-center gap-[clamp(0.5rem,1.4vh,1.1rem)]">
      <p className="shrink-0 text-[clamp(0.6rem,min(1vw,1.4vh),0.95rem)] leading-none font-bold tracking-[0.28em] text-ink-faint uppercase">
        Next in
      </p>

      {/* `popLayout` takes a leaving row out of flow before the others move, so
          the list closes the gap in one motion instead of jumping. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((event, index) => (
          <QueueRow key={event.id} event={event} position={index} name={name} />
        ))}

        {overflow > 0 ? (
          <motion.p
            key="overflow"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="shrink-0 pl-[clamp(0.5rem,1vw,1rem)] text-[clamp(0.85rem,min(1.3vw,1.9vh),1.4rem)] font-semibold text-ink-faint"
          >
            +{overflow} more waiting
          </motion.p>
        ) : null}
      </AnimatePresence>
    </aside>
  );
}

function QueueRow({
  event,
  position,
  name,
}: {
  event: ScreenEvent;
  position: number;
  name: { max: number; min: number };
}) {
  const vip = event.category === "vip";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="flex min-w-0 shrink-0 items-center gap-[clamp(0.6rem,1.1vw,1.15rem)] rounded-[1.5rem] bg-stage-raised p-[clamp(0.5rem,1vh,0.9rem)] ring-1 ring-edge"
    >
      <motion.div
        layoutId={`arrival-photo-${event.id}`}
        transition={{ type: "spring", stiffness: 240, damping: 30 }}
        className="aspect-square w-[clamp(56px,min(6.5vw,11vh),120px)] shrink-0 overflow-hidden rounded-full bg-stage"
        style={{
          // The VIP ring survives the shrink. It is the one cue that has to read
          // from across a lobby, in the queue as much as in the hero.
          boxShadow: vip
            ? "0 0 0 clamp(3px,0.45vh,5px) var(--color-vip)"
            : "0 0 0 2px var(--color-edge)",
        }}
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
      </motion.div>

      <div className="min-w-0 flex-1 pr-[clamp(0.25rem,0.6vw,0.75rem)]">
        <p
          className={`text-[clamp(0.55rem,min(0.85vw,1.2vh),0.85rem)] leading-none font-bold tracking-[0.2em] uppercase ${
            vip ? "text-vip" : "text-ink-faint"
          }`}
        >
          {vip ? "VIP · " : ""}
          {position === 0 ? "Next" : `${position + 1}${ordinal(position + 1)}`}
        </p>

        {/*
          Measured, not clamped and not line-clamped.

          `-webkit-line-clamp` was still a truncation: a 45-character name simply
          lost its end, which is the exact failure this screen cannot have. It
          now shrinks to fit across up to three lines and stops at the floor.
        */}
        <div className="mt-[0.3em]">
          <FitText
            max={name.max}
            min={name.min}
            maxLines={NAME_LINE_CLAMP}
            lineHeight={1.12}
            className="font-bold text-ink"
          >
            {event.full_name}
          </FitText>
        </div>

        {/* Country and organisation both, because the brief is that every
            visitor on screen has all three readable — not just the hero. */}
        <p className="mt-[0.15em] text-[clamp(0.75rem,min(1.15vw,1.6vh),1.25rem)] leading-tight break-words text-ink-soft">
          {event.country}
          {event.organization ? (
            <>
              <span aria-hidden className="mx-[0.45em] text-ink-faint">
                ·
              </span>
              {event.organization}
            </>
          ) : null}
        </p>
      </div>
    </motion.div>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
