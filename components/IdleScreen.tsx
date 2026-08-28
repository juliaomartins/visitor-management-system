"use client";

import { useEffect, useRef, useState } from "react";

import { gsap, particleBudget, prefersReducedMotion, useGSAP } from "@/lib/gsap";

/**
 * What the wall shows for most of the day.
 *
 * Between arrival waves this is on screen for tens of minutes at a time, so the
 * motion here is AMBIENT, not performative: embers drifting slowly upward, a
 * breathing halo, and digits that roll only when they actually change. Nothing
 * loops fast enough to catch the eye of someone waiting nearby, and nothing
 * restarts from the top — a two-second animation on a ten-minute loop is the
 * thing that makes a lobby screen irritating.
 *
 * It is still the clock that does the real work. A lobby display showing the time
 * is useful even when it has nothing to announce, and a ticking second hand is
 * how staff across the room can tell the machine has not frozen. It also stops
 * the panel burning in: every bright element moves.
 */
export function IdleScreen({ waiting }: { waiting: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const root = useRef<HTMLDivElement | null>(null);

  // Client only: a server-rendered time hydrates mismatched. The first read is
  // deferred to its own task rather than run in the effect body, so mounting does
  // not cascade a second render before the browser has painted the first.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const seconds = now ? now.getSeconds() : 0;
  const date = now
    ? now.toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <div
      ref={root}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-[6vw]"
    >
      <AmbientEmbers />

      {/* A slow halo behind the clock. It is the only thing on this screen that
          suggests the display is doing something while it waits. */}
      <Halo />

      <div className="relative flex flex-col items-center">
        <RollingClock time={time} />

        <SecondsBar seconds={seconds} />

        <p className="mt-[3vh] text-center text-[clamp(0.9rem,1.6vw,1.6rem)] font-medium tracking-[0.3em] text-ink-faint uppercase">
          {waiting ? "Waiting for arrivals" : "Welcome"}
        </p>

        {date ? (
          <p
            suppressHydrationWarning
            className="mt-[1.2vh] text-center text-[clamp(0.8rem,1.2vw,1.15rem)] tracking-[0.16em] text-ink-faint/70 uppercase"
          >
            {date}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The clock, one digit per box, rolling only the digits that changed.
 *
 * Re-animating all five characters every minute would make the whole block
 * twitch; rolling just the digit that moved is what a mechanical board does, and
 * it draws the eye to the change rather than to the clock.
 */
function RollingClock({ time }: { time: string }) {
  const root = useRef<HTMLParagraphElement | null>(null);
  const previous = useRef<string>("");

  useGSAP(
    () => {
      if (!time || !root.current) return;

      const before = previous.current;
      previous.current = time;

      // First paint: bring the whole clock in once, then never again.
      if (!before) {
        gsap.from(root.current.querySelectorAll("[data-digit]"), {
          duration: 0.8,
          yPercent: 60,
          opacity: 0,
          filter: "blur(12px)",
          stagger: 0.06,
          ease: "power3.out",
        });
        return;
      }

      if (prefersReducedMotion()) return;

      const cells = root.current.querySelectorAll<HTMLElement>("[data-digit]");
      cells.forEach((cell, index) => {
        if (before[index] === time[index]) return;
        gsap.fromTo(
          cell,
          { yPercent: -55, opacity: 0, filter: "blur(8px)" },
          {
            duration: 0.55,
            yPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
            ease: "power3.out",
            overwrite: true,
          },
        );
      });
    },
    { dependencies: [time], scope: root },
  );

  return (
    <p
      ref={root}
      suppressHydrationWarning
      aria-label={time}
      className="flex items-center justify-center text-[clamp(4.5rem,17vw,15rem)] leading-[0.85] font-bold tracking-tight text-ink tabular-nums"
    >
      {time.split("").map((character, index) => (
        <span
          key={index}
          data-digit
          aria-hidden
          className={
            character === ":"
              ? "mx-[0.06em] inline-block text-ink-faint"
              : "inline-block"
          }
        >
          {character}
        </span>
      ))}
    </p>
  );
}

/**
 * Seconds as a filling bar rather than a number.
 *
 * A second-by-second numeral is legible from a metre and illegible from five,
 * which is the distance this screen is read from. The bar carries the same
 * information as motion — visible at any distance, and unmistakably alive.
 */
function SecondsBar({ seconds }: { seconds: number }) {
  const fill = useRef<HTMLSpanElement | null>(null);

  useGSAP(
    () => {
      if (!fill.current) return;
      gsap.to(fill.current, {
        duration: prefersReducedMotion() ? 0 : 0.9,
        scaleX: seconds / 59,
        ease: "power2.out",
        overwrite: true,
      });
    },
    { dependencies: [seconds] },
  );

  return (
    <span
      aria-hidden
      className="mt-[4vh] block h-[3px] w-[min(46vw,26rem)] overflow-hidden rounded-full bg-edge"
    >
      <span
        ref={fill}
        className="block h-full w-full origin-left scale-x-0 rounded-full bg-live"
      />
    </span>
  );
}

/** A slow breathing wash behind the clock. Pure decoration, and cheap. */
function Halo() {
  const halo = useRef<HTMLDivElement | null>(null);

  useGSAP(() => {
    if (!halo.current || prefersReducedMotion()) return;
    gsap.to(halo.current, {
      duration: 7,
      scale: 1.14,
      opacity: 0.75,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
  });

  return (
    <div
      ref={halo}
      aria-hidden
      className="pointer-events-none absolute h-[70vmin] w-[70vmin] rounded-full opacity-45 blur-[80px]"
      style={{
        background:
          "radial-gradient(circle, rgba(36,192,122,0.20) 0%, rgba(110,168,255,0.10) 45%, transparent 70%)",
      }}
    />
  );
}

/**
 * Embers drifting up the panel.
 *
 * Long, staggered, individually-seeded tweens — no two particles share a path, so
 * the field never resolves into a visible loop even after an hour. Paused when
 * the tab is hidden, because a kiosk browser will happily keep a ticker running
 * on a screen nobody can see.
 */
function AmbientEmbers() {
  const root = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const host = root.current;
      if (!host) return;

      // Half the burst budget: this runs for hours, the burst runs for a second.
      const count = Math.round(particleBudget() / 2);
      if (count === 0) return;

      const made: HTMLElement[] = [];
      for (let index = 0; index < count; index += 1) {
        const dot = document.createElement("span");
        const size = gsap.utils.random(2, 5);
        dot.className = "absolute rounded-full";
        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.background = index % 5 === 0 ? "#24c07a" : "#6ea8ff";
        dot.style.opacity = "0";
        host.appendChild(dot);
        made.push(dot);
      }

      const tweens = made.map((dot) =>
        gsap.fromTo(
          dot,
          {
            x: () => `${gsap.utils.random(0, 100)}vw`,
            y: () => `${gsap.utils.random(100, 130)}vh`,
            opacity: 0,
          },
          {
            duration: gsap.utils.random(18, 34),
            y: `-=${gsap.utils.random(110, 150)}vh`,
            x: `+=${gsap.utils.random(-12, 12)}vw`,
            opacity: gsap.utils.random(0.12, 0.4),
            ease: "none",
            repeat: -1,
            // Negative delay starts each particle mid-flight, so the field is
            // already populated on the first frame instead of rising from the
            // bottom edge together.
            delay: gsap.utils.random(-30, 0),
            repeatRefresh: true,
          },
        ),
      );

      const onVisibility = () => {
        const hidden = document.visibilityState === "hidden";
        for (const tween of tweens) {
          if (hidden) tween.pause();
          else tween.resume();
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        for (const dot of made) dot.remove();
      };
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  );
}
