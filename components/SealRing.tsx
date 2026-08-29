"use client";

import { useId, useRef } from "react";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

/**
 * The credential seal around the visitor's face.
 *
 * WHY A SEAL. This system's actual job is admission — a badge is checked and a
 * person is let in. The old ring was a plain stroke with three decorative dots
 * beside it, which said nothing; every other lobby screen has a circle around a
 * photo. A seal is the vernacular of the thing itself: a stamp at a gate, a
 * mark on a pass. It also carries real content, so the ornament is doing work —
 * the country the visitor came from, and the word the screen exists to say.
 *
 * Two rings turning against each other, at speeds that read as drift rather than
 * spin: the legend clockwise in eighty seconds, the tick collar anticlockwise in
 * a hundred and forty. Counter-rotation is what stops it looking like a loading
 * spinner. Nothing here is fast; the motion should be noticed only by someone
 * standing still.
 *
 * `textLength` set to the exact circumference is what closes the seam. Repeating
 * a string around a circle and hoping it lands is how you get a visible gap or
 * an overlap at three o'clock, and it changes with every country name.
 */
const R_TEXT = 88;
const R_COLLAR = 104;
// The three radii have to be read together: the photo's edge lands at 79
// units inside this viewBox, so 88 and 99 give the legend clearance from the
// face and the collar clearance from the legend. At 92/99 the two rings were
// four units apart and read as one noisy band.

const TICKS = 48;
const LEGEND_SIZE = 5.6;
const CIRCUMFERENCE = 2 * Math.PI * R_TEXT;

export function SealRing({
  country,
  vip = false,
}: {
  country: string;
  vip?: boolean;
}) {
  const root = useRef<SVGSVGElement | null>(null);
  const pathId = `seal-${useId().replace(/[:]/g, "")}`;

  const legend = `Admitted · ${country || "Guest"} · `;
  // Rough advance for tracked uppercase at this size, only used to pick a
  // repeat count that keeps `lengthAdjust` from stretching the letters visibly.
  const estimate = legend.length * LEGEND_SIZE * 0.85;
  const repeats = Math.max(2, Math.round(CIRCUMFERENCE / estimate));

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.to("[data-seal-legend]", {
        rotation: 360,
        duration: 80,
        ease: "none",
        repeat: -1,
        transformOrigin: "50% 50%",
      });

      gsap.to("[data-seal-collar]", {
        rotation: -360,
        duration: 140,
        ease: "none",
        repeat: -1,
        transformOrigin: "50% 50%",
      });
    },
    { scope: root },
  );

  const line = vip ? "var(--color-vip)" : "var(--color-expo)";

  return (
    <svg
      ref={root}
      aria-hidden
      viewBox="0 0 200 200"
      className="pointer-events-none absolute -inset-[13%] h-[126%] w-[126%]"
    >
      <defs>
        <path
          id={pathId}
          fill="none"
          d={`M 100,100 m -${R_TEXT},0 a ${R_TEXT},${R_TEXT} 0 1,1 ${R_TEXT * 2},0 a ${R_TEXT},${R_TEXT} 0 1,1 -${R_TEXT * 2},0`}
        />
      </defs>

      {/* The collar. Long marks every sixth, so the eye reads a dial rather than
          a dotted line — and the seal has an orientation to rotate against. */}
      <g data-seal-collar opacity={0.55}>
        {Array.from({ length: TICKS }, (_, index) => {
          const major = index % 6 === 0;
          const angle = (index / TICKS) * Math.PI * 2;
          const inner = R_COLLAR - (major ? 7 : 3.2);
          return (
            <line
              key={index}
              x1={100 + Math.cos(angle) * inner}
              y1={100 + Math.sin(angle) * inner}
              x2={100 + Math.cos(angle) * R_COLLAR}
              y2={100 + Math.sin(angle) * R_COLLAR}
              stroke={line}
              strokeWidth={major ? 1.6 : 0.8}
              strokeLinecap="round"
              opacity={major ? 0.85 : 0.25}
            />
          );
        })}
      </g>

      <g data-seal-legend>
        <text
          fill={line}
          fontSize={LEGEND_SIZE}
          fontWeight={700}
          letterSpacing="0.26em"
          opacity={0.8}
          style={{ textTransform: "uppercase" }}
        >
          <textPath
            href={`#${pathId}`}
            startOffset="0"
            textLength={CIRCUMFERENCE}
            lengthAdjust="spacing"
          >
            {legend.repeat(repeats)}
          </textPath>
        </text>
      </g>
    </svg>
  );
}
