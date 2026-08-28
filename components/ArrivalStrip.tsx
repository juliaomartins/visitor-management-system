"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { ScreenEvent } from "@/lib/api";

/**
 * Who is waiting behind the person on the wall.
 *
 * Two guards working side by side means two badges scanned within a second of
 * each other, and the second visitor should not vanish for eight seconds. The
 * strip shows them queued in arrival order, so somebody standing there can see
 * their own face is next rather than wondering whether the scan registered.
 *
 * THE AVATAR CARRIES A `layoutId` SHARED WITH THE HERO. That is the whole
 * mechanism behind the promotion: when the hero dismisses, this thumbnail and
 * the new hero are two different DOM nodes wearing the same layoutId, so
 * framer-motion animates one into the other's position and size. Nothing fades
 * out and separately fades in — the face travels.
 *
 * It is a circle here because it is a circle in the hero. A rounded rectangle
 * would have to animate its border-radius across the promotion, and any mismatch
 * shows up as the face changing shape mid-flight.
 *
 * CAPPED, NOT SHRUNK. Past the cap the thumbnails would keep getting smaller
 * until the names stopped being readable at five metres, and a name too small to
 * read is decoration rather than information — so the overflow becomes a count.
 */
export const MAX_VISIBLE = 4;

export function ArrivalStrip({ queued }: { queued: ScreenEvent[] }) {
  const visible = queued.slice(0, MAX_VISIBLE);
  const overflow = queued.length - visible.length;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-[3vw] pb-[clamp(0.75rem,2.5vh,2rem)]">
      <div className="flex items-center justify-center gap-[clamp(0.6rem,1.2vw,1.25rem)]">
        {/* `popLayout` takes a leaving thumbnail out of flow before the others
            move, so the strip closes the gap in one motion instead of jumping. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((event, index) => (
            <Thumbnail key={event.id} event={event} position={index} />
          ))}

          {overflow > 0 ? (
            <motion.div
              key="overflow"
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex shrink-0 items-center rounded-full bg-stage-raised px-[clamp(0.9rem,1.5vw,1.6rem)] py-[clamp(0.6rem,1.2vh,1.1rem)] ring-1 ring-edge"
            >
              <span className="text-[clamp(1.25rem,1.7vw,1.875rem)] leading-none font-bold text-ink-soft">
                +{overflow}
                <span className="ml-[0.4em] text-[0.6em] font-medium tracking-[0.14em] text-ink-faint uppercase">
                  more
                </span>
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Thumbnail({ event, position }: { event: ScreenEvent; position: number }) {
  const vip = event.category === "vip";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 44, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="flex shrink-0 items-center gap-[clamp(0.55rem,0.9vw,0.95rem)] rounded-full bg-stage-raised py-[clamp(0.4rem,0.7vh,0.7rem)] pr-[clamp(1rem,1.6vw,1.6rem)] pl-[clamp(0.4rem,0.7vh,0.7rem)] ring-1 ring-edge"
    >
      <motion.div
        layoutId={`arrival-photo-${event.id}`}
        transition={{ type: "spring", stiffness: 240, damping: 30 }}
        className="aspect-square w-[clamp(72px,9vh,112px)] shrink-0 overflow-hidden rounded-full bg-stage"
        style={{
          // The VIP ring survives the shrink — it is the one cue that has to
          // read from across a lobby, in the strip as much as in the hero.
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

      <div className="min-w-0 max-w-[clamp(8rem,13vw,14rem)]">
        {/* Answers "am I next?" without anybody counting along the row. */}
        <p
          className={`text-[clamp(0.62rem,0.8vw,0.85rem)] leading-none font-bold tracking-[0.2em] uppercase ${
            vip ? "text-vip" : "text-ink-faint"
          }`}
        >
          {vip ? "VIP · " : ""}
          {position === 0 ? "Next" : `${position + 1}${ordinal(position + 1)}`}
        </p>

        {/*
          Floor of 24px. The hero name is 72px for the 3–5 metre read; a
          thumbnail is read from the same distance, and below roughly this size
          it stops carrying information and becomes texture.
        */}
        <p className="mt-[0.3em] truncate text-[clamp(1.5rem,1.75vw,2rem)] leading-tight font-bold text-ink">
          {event.full_name}
        </p>

        <p className="truncate text-[clamp(0.9rem,1.05vw,1.15rem)] leading-tight text-ink-soft">
          {event.country}
        </p>
      </div>
    </motion.div>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
