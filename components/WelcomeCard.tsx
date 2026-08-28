"use client";

import { motion } from "framer-motion";
import { useRef } from "react";

import { ArrivalQueue } from "@/components/ArrivalQueue";
import { FitText } from "@/components/FitText";
import { ParticleBurst } from "@/components/ParticleBurst";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "@/lib/gsap";
import { clampPx, useViewport } from "@/hooks/useViewport";
import type { ScreenEvent } from "@/lib/api";

/**
 * One arrival, filling the wall.
 *
 * A centred stack rather than the old photo-left row: greeting, headline, face,
 * name, then the details that qualify it. That order is the order a person
 * actually reads it in from across a lobby — the face confirms who, and the
 * lines under it answer where from and in what capacity. Anyone who only sees it
 * for two seconds still gets the name.
 *
 * Every element that eats vertical space is sized as the SMALLER of a
 * width-derived and a height-derived value. A pure `vw` clamp is enormous on a
 * short landscape phone; a pure `vh` clamp is tiny on the lobby panel. `min()` of
 * both is right on each — measured, not guessed: the first cut of this layout
 * overflowed a 667x375 phone by 48px and clipped the status line.
 *
 * Blue for a visitor, gold for a VIP, and the accent carries the headline, the
 * photo ring, the status chip and the wave at once. Four cues rather than a badge
 * in a corner, because somebody walking past is not looking for it.
 */
export function WelcomeCard({
  event,
  queued = [],
}: {
  event: ScreenEvent;
  queued?: ScreenEvent[];
}) {
  return <ArrivalStage event={event} vip={false} queued={queued} />;
}

export function ArrivalStage({
  event,
  vip,
  queued = [],
}: {
  event: ScreenEvent;
  vip: boolean;
  /** Arrivals waiting behind this one. They get their own column, never an overlay. */
  queued?: ScreenEvent[];
}) {
  const hasQueue = queued.length > 0;
  const { width, height } = useViewport();

  /*
    Sizes in pixels, because FitText measures against pixels.

    Derived from BOTH axes, never one. A width-only rule is enormous on a short
    projector; a height-only rule is tiny on a wide panel. `min()` of the two is
    correct on 1366x768, 1920x1080, 3840x2160 and a rotated panel alike, with no
    breakpoint deciding which case we are in.
  */
  const headline = {
    max: clampPx(28, Math.min(width * 0.075, height * 0.115), 168),
    min: 28,
  };

  /*
    THE LEGIBILITY FLOOR IS 44px, and it is a real limit, not a guess at a nice
    number. A capital letter is about 0.7 of the font size, so 44px is roughly
    8mm of cap height on a 96dpi panel — around the smallest that resolves at
    five metres for someone who is not looking for it. Below that a name is not
    "smaller", it is gone, and the screen has failed at its one job.

    So the name stops there and the PHOTO gives up its height instead. Identity
    beats decoration.
  */
  const name = {
    max: clampPx(44, Math.min(width * 0.055, height * 0.085), 132),
    min: 44,
  };
  const root = useRef<HTMLDivElement | null>(null);
  useArrivalAnimation(root, vip);

  const accent = vip ? "var(--color-vip)" : "var(--color-expo)";
  const deep = vip ? "var(--color-vip-deep)" : "var(--color-expo-deep)";
  const status = vip ? "VIP Visitor" : "Visitor";

  return (
    /*
      A GRID, NOT A STACK WITH OVERLAYS.

      Three reserved regions: the header row, the content row, and the wave
      behind both. The previous layout centred a content column that was taller
      than its container, and centred overflow clips at BOTH ends — which is why
      the headline lost its top edge. A row cannot clip its sibling, and a column
      cannot cover one.
    */
    <div
      ref={root}
      className="relative grid h-full w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
      style={{ ["--accent" as string]: accent, ["--deep" as string]: deep }}
    >
      {/* A wash behind the face, so the photo sits in light rather than on a
          flat field. Deep end of the accent, never the accent itself. */}
      <div
        aria-hidden
        data-wash
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, var(--deep) 0%, transparent 62%)",
        }}
      />

      <Header event={event} />

      <div
        /*
          ORIENTATION, NOT A WIDTH BREAKPOINT.

          `lg:` asks how wide the window is, which gets a rotated 1080x1920 panel
          wrong in the worst way: 1080px clears the `lg` threshold, so a portrait
          wall would put the queue in a column beside a hero that has no width to
          spare. The question is the SHAPE of the viewport, so the query asks
          about the shape — landscape and wide enough for two columns, otherwise
          stacked with the queue underneath.
        */
        className={`relative z-10 grid min-h-0 gap-[clamp(0.5rem,2vw,2.5rem)] px-[clamp(0.75rem,2.5vw,3rem)] pb-[clamp(0.5rem,2.5vh,2rem)] ${
          hasQueue
            ? "grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)] [@media(orientation:landscape)and(min-width:900px)]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [@media(orientation:landscape)and(min-width:900px)]:grid-rows-1"
            : "grid-cols-1"
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-[clamp(0.25rem,1vh,1rem)]">
          <p
            data-greeting
            className="shrink-0 font-serif text-[clamp(1.15rem,min(4.4vw,6vh),4rem)] leading-none text-ink italic"
          >
            Welcome
          </p>

          {/* Measured too. It is a fixed string, but the box it has to fit in
              is not — at some widths the letters were escaping their column. */}
          <div
            data-headline
            className="w-full shrink-0"
            style={{ color: "var(--accent)" }}
          >
            <FitText
              as="h1"
              max={headline.max}
              min={headline.min}
              maxLines={1}
              lineHeight={0.95}
              className="text-center font-bold tracking-[-0.02em] uppercase"
            >
              To the Expo
            </FitText>
          </div>

          {/*
            THE ROW THAT YIELDS, and a size container so the photo can be sized
            from what is left rather than from the viewport.

            `flex-1 min-h-0` means every fixed-height sibling — greeting,
            headline, name plate, detail line — takes its height first and this
            row gets the remainder, however small that is. `container-type:size`
            then publishes that remainder as `cqh`, which is the only honest
            source for the photo's size: `vh` describes the window, not the room
            actually left after a three-line name.
          */}
          <div className="mt-[clamp(0.5rem,2.5vh,3rem)] flex min-h-0 flex-1 items-center justify-center gap-[clamp(0.75rem,4vw,4rem)] [container-type:size]">
            <Dots />

            <div data-photo className="relative flex min-h-0 items-center justify-center self-stretch">
              {/*
                THE SHARED ELEMENT. `ArrivalQueue` renders a row carrying the same
                layoutId, so a promotion animates that avatar into this position
                and size as one continuous move — the face travels rather than one
                card fading out while another fades in.

                NO HARD PIXEL FLOOR. A `min-width: 400px` here read as "hold
                the 3–5 metre spec", but on a 1366x768 projector it forced 400px
                into a 768px-tall viewport and pushed the name off the bottom —
                the floor caused the overflow it was meant to prevent.

                AND NO `vh` EITHER, which was the second attempt and was also
                wrong. `shrink` cannot shrink this: `aspect-square` with an
                explicit width means the width is definite and the height merely
                derived, so flex has nothing to take and `max-h-full` only
                clips. A viewport-derived width is the same size whether the
                name took one line or three.

                `100cqh` is the row's OWN height — the space remaining after the
                text has been served — so a third line of name shrinks the face
                by exactly the height that line consumed. `58cqw` keeps it from
                outgrowing the column on a short wide panel, and 760px stops a
                4K wall turning it into a billboard.
              */}
              <motion.div
                layoutId={`arrival-photo-${event.id}`}
                transition={{ type: "spring", stiffness: 240, damping: 30 }}
                className="aspect-square w-[min(100cqh,58cqw,760px)] overflow-hidden rounded-full bg-stage-raised"
                style={{
                  boxShadow: "0 0 0 clamp(3px,0.55vh,9px) var(--accent)",
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

              {/* Thrown from the centre of the face, so the burst reads as coming
                off the person rather than off the layout. */}
              <ParticleBurst burstKey={event.id} vip={vip} />
            </div>

            <Dots />
          </div>

          {/* The name, in a plate. The reference's strongest move: it lifts the one
            string that matters off the background entirely. */}
          {/*
            `shrink-0`, so the plate keeps whatever height the name needs and the
            photo above gives up the difference. This is the whole ordering rule:
            a face the guest can recognise is worth less than a name they can read.
          */}
          <div
            data-plate
            className="w-full max-w-full shrink-0 rounded-full bg-ink px-[clamp(1rem,3vw,3rem)] py-[clamp(0.4rem,1.2vh,1rem)]"
          >
            <FitText
              max={name.max}
              min={name.min}
              maxLines={3}
              lineHeight={1.04}
              className="text-center font-bold tracking-[-0.01em] text-stage uppercase"
            >
              {event.full_name}
            </FitText>
          </div>

          <p
            data-line
            className="mt-[clamp(0.6rem,2vh,2rem)] shrink-0 text-center text-[clamp(0.8rem,min(2.2vw,3vh),2rem)] leading-tight font-medium text-ink-soft"
          >
            {event.country}
            {event.organization ? (
              <>
                <span aria-hidden className="mx-[0.6em] text-ink-faint">
                  ·
                </span>
                {event.organization}
              </>
            ) : null}
          </p>

          <p
            data-line
            className="mt-[clamp(0.5rem,1.5vh,1.4rem)] rounded-full px-[clamp(0.9rem,2vw,1.6rem)] py-[clamp(0.25rem,0.7vh,0.5rem)] text-[clamp(0.6rem,min(1.5vw,2vh),1.35rem)] font-bold tracking-[0.28em] uppercase"
            style={{
              color: "var(--accent)",
              border:
                "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
            }}
          >
            {status}
          </p>
        </div>

        {hasQueue ? <ArrivalQueue queued={queued} /> : null}
      </div>

      <Wave />
    </div>
  );
}

/** The event's own mark, and the moment. Small, cornered, never near the name. */
function Header({ event }: { event: ScreenEvent }) {
  return (
    <div
      data-header
      className="relative z-10 flex shrink-0 items-center justify-between px-[clamp(1rem,3vw,3rem)] pt-[clamp(0.9rem,2.5vh,2rem)]"
    >
      <div className="flex items-center gap-[clamp(0.5rem,1vw,0.9rem)]">
        <span
          aria-hidden
          className="flex aspect-square w-[clamp(30px,3.4vw,52px)] items-center justify-center rounded-[28%] bg-ink text-[clamp(0.7rem,1.1vw,1.05rem)] font-bold text-stage"
        >
          V
        </span>
        <span className="text-[clamp(0.62rem,1.05vw,1rem)] leading-[1.15] font-semibold tracking-[0.16em] text-ink-soft uppercase">
          Visitor
          <br />
          Management
        </span>
      </div>

      <span className="text-[clamp(0.6rem,1vw,0.95rem)] tracking-[0.16em] text-ink-faint">
        {formatArrived(event.scanned_at)}
      </span>
    </div>
  );
}

/** The reference's three dots, flanking the face. Hidden where there is no room. */
function Dots() {
  return (
    <div
      aria-hidden
      data-dots
      className="hidden items-center gap-[clamp(0.4rem,1vw,0.9rem)] sm:flex"
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="block aspect-square w-[clamp(8px,min(1.6vw,2.2vh),26px)] rounded-full border-2 border-ink-faint"
        />
      ))}
    </div>
  );
}

/**
 * The wave at the foot.
 *
 * Two layers at different opacities so the crest reads as depth rather than as a
 * single flat shape, and `preserveAspectRatio="none"` so it stretches to any
 * panel width instead of cropping.
 */
function Wave() {
  return (
    <div
      aria-hidden
      data-wave
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[clamp(44px,13vh,190px)]"
    >
      <svg
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <path
          d="M0 96 C 240 24, 480 168, 720 116 S 1200 20, 1440 74 L1440 200 L0 200 Z"
          fill="var(--accent)"
          opacity="0.28"
        />
        <path
          d="M0 134 C 260 70, 520 196, 780 148 S 1230 74, 1440 122 L1440 200 L0 200 Z"
          fill="var(--accent)"
        />
      </svg>
    </div>
  );
}

/**
 * The entry: greeting, headline, face, then the plate.
 *
 * Sequenced rather than simultaneous. Everything arriving at once is a flash;
 * arriving in reading order gives the eye somewhere to go, and the sparks land
 * with the face rather than competing with the headline.
 */
export function useArrivalAnimation(
  root: React.RefObject<HTMLDivElement | null>,
  vip: boolean,
) {
  useGSAP(
    () => {
      const host = root.current;
      if (!host) return;

      const pick = <T extends HTMLElement>(selector: string) =>
        host.querySelector<T>(selector);

      // Reduced motion still gets a change of state — it just arrives rather
      // than performs. A card that never appears is worse than one that fades.
      if (prefersReducedMotion()) {
        gsap.from(host, { duration: 0.3, opacity: 0 });
        return;
      }

      let split: SplitText | undefined;
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      const header = pick("[data-header]");
      const wash = pick("[data-wash]");
      const greeting = pick("[data-greeting]");
      const headline = pick("[data-headline]");
      const photo = pick("[data-photo]");
      const plate = pick("[data-plate]");
      const wave = pick("[data-wave]");
      const dots = host.querySelectorAll<HTMLElement>("[data-dots] span");
      const lines = host.querySelectorAll<HTMLElement>("[data-line]");

      if (wash)
        timeline.from(wash, { duration: 1.1, opacity: 0, scale: 0.8 }, 0);
      if (wave)
        timeline.from(
          wave,
          { duration: 0.9, yPercent: 100, ease: "expo.out" },
          0,
        );
      if (header)
        timeline.from(header, { duration: 0.6, y: -24, opacity: 0 }, 0.1);

      if (greeting) {
        timeline.from(greeting, { duration: 0.6, y: 26, opacity: 0 }, 0.15);
      }

      if (headline) {
        /*
          `smartWrap` because this splits characters only: without it a long
          headline can break mid-word, and the docs are explicit about it. The
          default `aria: "auto"` keeps an aria-label on the heading and hides the
          char spans, so a screen reader says the phrase rather than spelling it.
        */
        split = SplitText.create(headline, {
          type: "chars",
          smartWrap: true,
          charsClass: "inline-block will-change-transform",
        });

        timeline.from(
          split.chars,
          {
            duration: 0.7,
            yPercent: 115,
            rotationX: -80,
            opacity: 0,
            transformOrigin: "50% 100%",
            stagger: { each: 0.028, from: "start" },
            ease: "back.out(1.6)",
          },
          0.28,
        );
      }

      if (photo) {
        timeline.from(
          photo,
          { duration: 0.85, scale: 0.72, opacity: 0, ease: "back.out(1.5)" },
          0.5,
        );
      }

      if (dots.length) {
        timeline.from(
          dots,
          {
            duration: 0.45,
            scale: 0,
            opacity: 0,
            stagger: { each: 0.05, from: "center" },
          },
          0.62,
        );
      }

      if (plate) {
        timeline.from(
          plate,
          { duration: 0.6, scaleX: 0.55, opacity: 0, ease: "expo.out" },
          0.82,
        );
      }

      if (lines.length) {
        timeline.from(
          lines,
          { duration: 0.5, y: 22, opacity: 0, stagger: 0.09 },
          0.98,
        );
      }

      // useGSAP reverts the tweens; the split is a DOM change, not a tween, so
      // it is put back by hand. Doing it here rather than on the timeline's
      // completion covers the card being cut short by the next arrival.
      return () => split?.revert();
    },
    { scope: root, dependencies: [vip] },
  );
}

/** Local time of the scan, so the wall shows when they walked in. */
function formatArrived(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
