"use client";

import { useT } from "@/lib/i18n";
import { motion } from "framer-motion";
import { useRef } from "react";

import { ArrivalQueue } from "@/components/ArrivalQueue";
import { EventMark, Organisers } from "@/components/Brand";
import { FitText } from "@/components/FitText";
import { SealRing } from "@/components/SealRing";
import { SparkEmitter } from "@/components/SparkEmitter";
import { SprinkleField } from "@/components/SprinkleField";
import { TaisWave } from "@/components/TaisWave";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "@/lib/gsap";
import { clampPx, useViewport } from "@/hooks/useViewport";
import type { ScreenEvent } from "@/lib/api";

/**
 * One arrival, filling the wall.
 *
 * A centred stack: seal, greeting, name, then the details that qualify it.
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
 * Blue for a visitor, gold for a VIP, and the accent carries the seal ring, the
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
  /*
    THE NAME IS THE DISPLAY TYPE NOW, and that is the whole point of this pass.

    The old stage spent its largest element -- a 124px "TO THE EXPO" -- on the
    one string that is identical for all 250 visitors, and gave the name, the
    only thing on screen that changes, a pill squeezed between the photo and the
    wave. The hierarchy was upside down. The event name is constant, so it
    belongs with the logo in the header; the space it was using goes to the
    person standing there.

    Two lines, not three. With this much size available a 45-character name that
    is allowed three lines takes them, and a tall stack of smaller text reads
    worse at five metres than two lines of large text. Capping the lines forces
    the search to trade height for size, which is the trade that helps.
  */
  const name = {
    max: clampPx(44, Math.min(width * 0.062, height * 0.098), 140),
    min: 44,
  };

  const root = useRef<HTMLDivElement | null>(null);
  useArrivalAnimation(root, vip);

  const accent = vip ? "var(--color-vip)" : "var(--color-expo)";
  const deep = vip ? "var(--color-vip-deep)" : "var(--color-expo-deep)";
  const t = useT();
  const status = t(
    vip ? "welcome.statusVip" : "welcome.statusVisitor",
  );

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

      {/* The room, not the event. A slow drift so the panel still has a
          pulse for the seven seconds after the burst has finished. */}
      <SprinkleField vip={vip} />

      <Header event={event} />

      <div
        /*
          ORIENTATION, NOT A WIDTH BREAKPOINT.

          `lg:` asks how wide the window is, which gets a rotated 1080x1920 panel
          wrong in the worst way: 1080px clears the `lg` threshold, so a portrait
          wall would put the queue in a column beside a hero that has no width to
          spare. The question is the SHAPE of the viewport, so the query asks
          about the shape instead: `wall:` is landscape and wide enough for two
          columns, defined in globals.css, otherwise stacked with the queue
          underneath.

          THE SIDE PADDING IS ORDINARY, AND THAT IS A DECISION. The tais below
          is a bowl — low at the centre of the panel, tall in both corners — so
          the tempting economy is to clear only the middle here and hold content
          out of the corners with a wide gutter instead. That was built, at
          `wall:px-[13vw]`, and it is wrong: it starves FitText of width, and at
          1366x768 a 31-character name answers by wrapping to four lines and
          overrunning the header. The panel that most needs the economy is the
          one that cannot afford it.

          `--tais-clear` therefore clears the cloth at its tallest, everywhere,
          and this padding stays out of it. One number, in globals.css, where
          the measurements behind it are written down. Do not reintroduce a
          gutter here to buy the clearance back.
        */
        className={`relative z-10 grid min-h-0 gap-[clamp(0.5rem,2vw,2.5rem)] px-[clamp(0.75rem,2.5vw,3rem)] pb-(--tais-clear) ${
          hasQueue
            ? "grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)] wall:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] wall:grid-rows-1"
            : "grid-cols-1"
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-[clamp(0.25rem,1vh,1rem)]">
          {/*
            THE ROW THAT YIELDS, and a size container so the seal can be sized
            from what is left rather than from the viewport.

            `flex-1 min-h-0` means every fixed-height sibling -- greeting, name,
            meta -- takes its height first and this row gets the remainder,
            however small. `container-type:size` then publishes that remainder as
            `cqh`, which is the only honest source for the seal's size: `vh`
            describes the window, not the room left after a two-line name.

            `w-full` IS LOAD-BEARING. The column is `items-center`, so this row
            does not stretch -- it shrink-wraps. But `contain:size` sizes an
            element as though it had no contents, so without an explicit width
            the shrink-wrap collapses the row to 0, and the face renders at zero
            pixels while everything around it looks correct.
          */}
          <div className="flex w-full min-h-0 flex-1 items-center justify-center [container-type:size]">
            <div
              data-seal
              className="relative aspect-square w-[min(88cqh,40cqw,560px)]"
            >
              {/*
                THE SHARED ELEMENT. `ArrivalQueue` renders a row carrying the
                same layoutId, so a promotion animates that avatar into this
                position and size as one continuous move -- the face travels
                rather than one card fading out while another fades in.

                The ring and the sparks are siblings, not children, so neither
                takes part in the morph. A rotating seal interpolating down into
                a 90px queue avatar would be a mess; this way the face travels
                and the seal belongs to whoever is currently on the wall.
              */}
              <motion.div
                layoutId={`arrival-photo-${event.id}`}
                transition={{ type: "spring", stiffness: 240, damping: 30 }}
                className="absolute inset-0 overflow-hidden rounded-full bg-stage-raised"
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

              <SealRing country={event.country} vip={vip} />
              <SparkEmitter vip={vip} delay={0.5} />
            </div>
          </div>

          {/* The one warm note on a dark panel, and the only serif. Small on
              purpose: it greets, the name announces. */}
          <p
            data-greeting
            className="mt-[clamp(0.6rem,2.4vh,2.2rem)] shrink-0 font-serif text-[clamp(1rem,min(3.2vw,4.4vh),2.75rem)] leading-none text-ink-soft italic"
          >
            {t("welcome.greeting")}
          </p>

          {/*
            THE WHITE PILL IS GONE, and it was not removed for taste.

            The name is blasted in character by character, and a character has to
            be visible while it is in flight. Dark-on-white letters converging
            across a near-black stage are invisible until the moment they land
            inside the pill, which turns the blast into a plain fade. Ink-white
            letters on the stage are legible the whole way in.

            It costs the panel its one light field. What replaces it is size: the
            pill's padding was eating about 90px of height that the name now
            uses, and white on #0a0f16 is around 17:1 -- more contrast than the
            pill gave, not less.

            `shrink-0`, so the name keeps whatever height it needs and the seal
            above gives up the difference. That is the ordering rule: a face the
            guest can recognise is worth less than a name they can read.
          */}
          <div data-plate className="w-full max-w-full shrink-0">
            <FitText
              max={name.max}
              min={name.min}
              maxLines={2}
              lineHeight={1.02}
              className="text-center font-bold tracking-[-0.015em] text-ink uppercase"
            >
              {event.full_name}
            </FitText>
          </div>

          {/*
            Where they came from, and in what capacity, on one line.

            The status used to be a chip on its own row at the very bottom, half
            behind the wave. It answers the same question as the country line --
            who is this -- so it sits with it.
          */}
          <div
            data-line
            className="mt-[clamp(0.5rem,1.8vh,1.8rem)] flex shrink-0 flex-wrap items-center justify-center gap-x-[clamp(0.6rem,1.6vw,1.6rem)] gap-y-[0.4rem]"
          >
            <p className="text-center text-[clamp(0.8rem,min(2.1vw,2.9vh),1.9rem)] leading-tight font-medium text-ink-soft">
              {event.country}
              {event.organization ? (
                <>
                  <span aria-hidden className="mx-[0.6em] text-ink-faint">
                    &middot;
                  </span>
                  {event.organization}
                </>
              ) : null}
            </p>

            <span
              className="rounded-full px-[clamp(0.7rem,1.6vw,1.3rem)] py-[clamp(0.15rem,0.5vh,0.4rem)] text-[clamp(0.55rem,min(1.3vw,1.8vh),1.15rem)] font-bold tracking-[0.28em] uppercase"
              style={{
                color: "var(--accent)",
                border:
                  "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
              }}
            >
              {status}
            </span>
          </div>
        </div>

        {hasQueue ? <ArrivalQueue queued={queued} /> : null}
      </div>

      <TaisWave />
    </div>
  );
}

/**
 * The event's own mark, and the moment.
 *
 * "The Expo" lives up here now. It used to be the largest thing on the panel, at
 * 124px, and it is the same on every one of 250 arrivals -- the most space spent
 * on the least information. A constant belongs with the other constants: the
 * logo, the system's name, the clock. What it frees goes to the visitor.
 */
function Header({ event }: { event: ScreenEvent }) {
  return (
    <div
      data-header
      className="relative z-10 flex shrink-0 items-center justify-between px-[clamp(1rem,3vw,3rem)] pt-[clamp(0.9rem,2.5vh,2rem)]"
    >
      <EventMark />

      <div className="flex shrink-0 items-center gap-[clamp(0.6rem,1.4vw,1.6rem)]">
        <Organisers />
        <span className="text-[clamp(0.6rem,1vw,0.95rem)] tracking-[0.16em] text-ink-faint">
          {formatArrived(event.scanned_at)}
        </span>
      </div>
    </div>
  );
}

/**
 * The entry: room, seal, greeting, name blast, details.
 *
 * Sequenced rather than simultaneous. Everything arriving at once is a flash;
 * arriving in reading order gives the eye somewhere to go, and the sparks land
 * with the face rather than competing with the name.
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
      const seal = pick("[data-seal]");
      const greeting = pick("[data-greeting]");
      const nameEl = pick("[data-plate] [data-fit-text]");
      const wave = pick("[data-wave]");
      const lines = host.querySelectorAll<HTMLElement>("[data-line]");

      /*
        THE ORDER IS THE READING ORDER: room, then face, then name, then the
        details that qualify it. Everything arriving at once is a flash; arriving
        in sequence gives the eye somewhere to go, and it means a visitor who
        catches only the last second of the card still gets the name.

        The whole thing is under 1.6s. The card holds for eight seconds -- or 3.5
        when a queue is backing up -- so the animation has to be finished long
        before anyone could get bored of it.
      */
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

      // The seal is struck: it lands slightly rotated and settles. The spark
      // burst is fired from the rim at 0.5 by SparkEmitter's own delay, which
      // is why the overshoot is still finishing when the sparks appear.
      if (seal)
        timeline.from(
          seal,
          {
            duration: 0.9,
            scale: 0.66,
            rotation: -14,
            opacity: 0,
            ease: "back.out(1.7)",
            transformOrigin: "50% 50%",
          },
          0.16,
        );

      if (greeting)
        timeline.from(greeting, { duration: 0.5, y: 18, opacity: 0 }, 0.5);

      if (nameEl) {
        /*
          THE TEXT BLAST. The characters start scattered across the stage and
          converge into the name.

          Convergence, not a cascade. The previous version dropped each letter in
          from below on a stagger, which at any moment mid-flight looked like the
          headline had fallen over -- and a screenshot of it mid-animation is
          indistinguishable from a bug. Scattered pieces assembling into a name
          reads as the system resolving an identity, which is what it just did.

          `smartWrap` because this splits characters only: without it a long name
          can break mid-word. The default `aria: "auto"` keeps an aria-label on
          the element and hides the char spans, so a screen reader says the name
          rather than spelling it.

          Distances are a fraction of the viewport, so the blast is the same
          gesture on a 1366px projector and a 4K wall.
        */
        split = SplitText.create(nameEl, {
          type: "chars",
          smartWrap: true,
          charsClass: "inline-block will-change-transform",
        });

        const reach = Math.min(window.innerWidth, window.innerHeight) * 0.26;

        timeline.from(
          split.chars,
          {
            duration: 0.9,
            x: () => gsap.utils.random(-reach, reach),
            y: () => gsap.utils.random(-reach * 0.8, reach * 0.8),
            rotation: () => gsap.utils.random(-75, 75),
            scale: () => gsap.utils.random(0.3, 2.2),
            opacity: 0,
            ease: "expo.out",
            stagger: { each: 0.014, from: "random" },
          },
          0.58,
        );
      }

      if (lines.length)
        timeline.from(
          lines,
          { duration: 0.5, y: 20, opacity: 0, stagger: 0.09 },
          1.05,
        );

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
