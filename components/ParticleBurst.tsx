"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

/**
 * A burst thrown from the face when an arrival lands.
 *
 * BOUNDED BY CONSTRUCTION, because this runs on a kiosk for fourteen hours.
 * There is no timer, no cleanup and nothing to leak:
 *
 *   - `app/page.tsx` keys the arrival card on the event id, so this component
 *     unmounts and remounts with every arrival. React removes the whole subtree
 *     with the card, which is what actually bounds the node count.
 *   - one burst per mount, a fixed count decided once, so the steady state is
 *     at most `budget()` spans — never more, whatever the arrival rate.
 *
 * DETERMINISTIC, not random-at-render. The trajectories are seeded from the
 * arrival's own id, so the burst is a pure function of its props: React can
 * re-render this component for reasons unrelated to an arrival — the strip
 * appearing, for one — and the particles must not jump to fresh paths
 * mid-flight. Every arrival still looks different because every id differs.
 */

/** Under the 400ms budget, including the trailing fade. */
const BURST_MS = 380;

/**
 * A small deterministic PRNG (mulberry32). One line of arithmetic, no
 * dependency, and it turns "random-looking" into "reproducible from the id".
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function budget(): number {
  if (typeof window === "undefined") return 0;

  // A lobby panel can carry a full burst; the same page opened on a phone to
  // check the screen is alive should not have to.
  const cores = navigator.hardwareConcurrency ?? 4;
  if (window.innerWidth < 640 || cores <= 2) return 10;
  if (window.innerWidth < 1280 || cores <= 4) return 18;
  return 26;
}

/** Turns a string or number key into a stable 32-bit seed. */
function toSeed(key: string | number): number {
  if (typeof key === "number") return key;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return hash;
}

export function ParticleBurst({
  burstKey,
  vip = false,
}: {
  burstKey: string | number | null;
  vip?: boolean;
}) {
  const reduced = useReducedMotion();

  const particles = useMemo(() => {
    if (burstKey === null || reduced) return [];

    const random = seeded(toSeed(burstKey));

    // Gold for a VIP and nothing else — the same rule the rest of the screen
    // follows, so a normal arrival never throws a gold spark.
    const palette = vip
      ? ["#e0a92c", "#f5cf6a", "#ffe9b0"]
      : ["#f4f8fb", "#9db0c4", "#24c07a", "#6ea8ff"];

    return Array.from({ length: budget() }, (_, index) => {
      // A cone thrown up and outward rather than a uniform ring, so it reads as
      // thrown rather than exploded.
      const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 1.15;
      const distance = 90 + random() * 190;

      return {
        id: index,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance + random() * 60,
        size: 3 + random() * 5,
        tint: palette[index % palette.length],
        delay: random() * 0.06,
      };
    });
  }, [burstKey, reduced, vip]);

  if (particles.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute top-1/2 left-1/2 block rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            background: particle.tint,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: particle.x, y: particle.y, opacity: 0, scale: 0.3 }}
          transition={{
            duration: BURST_MS / 1000,
            delay: particle.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
