"use client";

import { motion } from "framer-motion";
import { useRef } from "react";

import { ParticleBurst } from "@/components/ParticleBurst";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "@/lib/gsap";
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
  hasStrip = false,
}: {
  event: ScreenEvent;
  hasStrip?: boolean;
}) {
  return <ArrivalStage event={event} vip={false} hasStrip={hasStrip} />;
}

export function ArrivalStage({
  event,
  vip,
  hasStrip = false,
}: {
  event: ScreenEvent;
  vip: boolean;
  /** True when arrivals are queued behind this one, so the strip has its band. */
  hasStrip?: boolean;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  useArrivalAnimation(root, vip);

  const accent = vip ? "var(--color-vip)" : "var(--color-expo)";
  const deep = vip ? "var(--color-vip-deep)" : "var(--color-expo-deep)";
  const status = vip ? "VIP Visitor" : "Visitor";

  return (
    <div
      ref={root}
      className="relative flex h-full w-full flex-col overflow-hidden"
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
        className={`relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-[5vw] ${
          hasStrip
            ? "pb-[clamp(9rem,20vh,13rem)]"
            : "pb-[clamp(0.75rem,4vh,4rem)]"
        }`}
      >
        <p
          data-greeting
          className={`font-serif leading-none text-ink italic ${
            hasStrip
              ? "text-[clamp(1rem,min(3vw,4vh),2.5rem)]"
              : "text-[clamp(1.15rem,min(4.4vw,6vh),4rem)]"
          }`}
        >
          Welcome
        </p>

        <h1
          data-headline
          className={`mt-[0.12em] text-center leading-[0.92] font-bold tracking-[-0.02em] uppercase ${
            hasStrip
              ? "text-[clamp(1.25rem,min(5.5vw,8vh),5.5rem)]"
              : "text-[clamp(1.5rem,min(8.6vw,12vh),8.5rem)]"
          }`}
          style={{ color: "var(--accent)" }}
        >
          To the Expo
        </h1>

        <div className="mt-[clamp(0.5rem,2.5vh,3rem)] flex items-center gap-[clamp(0.75rem,4vw,4rem)]">
          <Dots />

          <div data-photo className="relative shrink-0">
            {/*
              THE SHARED ELEMENT. `ArrivalStrip` renders a thumbnail carrying the
              same layoutId, so a promotion animates that thumbnail into this
              position and size as one continuous move — the face travels rather
              than one card fading out while another fades in.

              The `lg:` floor is the 3–5 metre constraint made literal: 400px on
              the lobby panel. Below `lg` this is a phone held at arm's length —
              somebody checking the screen is alive — where 400px would overflow
              a 375px-tall viewport, so the min() clamp still governs there.
            */}
            <motion.div
              layoutId={`arrival-photo-${event.id}`}
              transition={{ type: "spring", stiffness: 240, damping: 30 }}
              className="aspect-square w-[clamp(84px,min(26vh,22vw),340px)] overflow-hidden rounded-full bg-stage-raised lg:w-[clamp(400px,min(38vh,26vw),460px)]"
              style={{ boxShadow: "0 0 0 clamp(4px,0.6vh,9px) var(--accent)" }}
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
        <div
          data-plate
          className="mt-[clamp(-1.1rem,-2vh,-0.8rem)] max-w-[92vw] rounded-full bg-ink px-[clamp(1.4rem,4vw,3.5rem)] py-[clamp(0.5rem,1.4vh,1.1rem)]"
        >
          <p
            data-name
            className="text-center text-[clamp(0.85rem,min(3.4vw,4.6vh),3rem)] leading-tight font-bold tracking-[-0.01em] text-stage uppercase lg:text-[clamp(72px,min(4.4vw,7.4vh),92px)]"
          >
            {event.full_name}
          </p>
        </div>

        <p
          data-line
          className="mt-[clamp(0.6rem,2vh,2rem)] text-center text-[clamp(0.8rem,min(2.2vw,3vh),2rem)] leading-tight font-medium text-ink-soft"
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
            border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
          }}
        >
          {status}
        </p>
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
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[clamp(44px,13vh,190px)]"
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

      if (wash) timeline.from(wash, { duration: 1.1, opacity: 0, scale: 0.8 }, 0);
      if (wave)
        timeline.from(wave, { duration: 0.9, yPercent: 100, ease: "expo.out" }, 0);
      if (header) timeline.from(header, { duration: 0.6, y: -24, opacity: 0 }, 0.1);

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
