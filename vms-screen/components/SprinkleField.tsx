"use client";

import { useRef } from "react";

import { gsap, particleBudget, useGSAP } from "@/lib/gsap";
import { useViewport } from "@/hooks/useViewport";

/**
 * Ambient sprinkle across the stage.
 *
 * The burst is an event; this is the room. A lobby wall holds one face for eight
 * seconds, and for seven of those the old stage was completely still — the flat
 * dark field behind the portrait read as a screen that had finished rather than
 * one that was live. A slow drift gives the panel a pulse without ever asking to
 * be looked at.
 *
 * The rules that keep it ambient rather than decorative: nothing is larger than
 * seven pixels, nothing exceeds 0.3 opacity, nothing crosses the middle third
 * where the face and the name sit, and every drift is slower than ten seconds so
 * no single mote can be tracked by eye. If you notice an individual particle,
 * this has failed.
 *
 * `viewBox` follows the viewport so one user unit is one pixel. Sizes are then
 * honest at any panel — a `preserveAspectRatio="none"` box would stretch every
 * dot into an ellipse on anything that is not 16:9.
 *
 * Count comes from `particleBudget()`, halved: the same budget the spark burst
 * spends in one second is spread here over the whole card, and reduced motion
 * gets an empty field.
 */
const STAR =
  "M 0,-1 Q 0.2,-0.2 1,0 Q 0.2,0.2 0,1 Q -0.2,0.2 -1,0 Q -0.2,-0.2 0,-1 Z";

export function SprinkleField({ vip = false }: { vip?: boolean }) {
  const root = useRef<SVGSVGElement | null>(null);
  const { width, height } = useViewport();

  useGSAP(
    () => {
      const svg = root.current;
      if (!svg) return;

      const count = Math.floor(particleBudget() / 2);
      if (count === 0) return;

      const namespace = "http://www.w3.org/2000/svg";
      const made: SVGElement[] = [];
      const tint = vip
        ? ["#e0a92c", "#f5cf6a", "#9db0c4"]
        : ["#4da6f0", "#f4f8fb", "#9db0c4"];

      for (let index = 0; index < count; index += 1) {
        // Four-point sparkles with a few plain motes among them. All sparkles
        // would read as a Christmas card.
        const sparkle = index % 3 !== 0;
        const node = document.createElementNS(
          namespace,
          sparkle ? "path" : "circle",
        ) as SVGElement;

        if (sparkle) node.setAttribute("d", STAR);
        else node.setAttribute("r", "1");

        node.setAttribute("fill", tint[index % tint.length]);
        made.push(node);
        svg.appendChild(node);
      }

      // The clear lane. The face and the name own the middle of the panel, so
      // particles are seeded into the outer thirds and drift within them.
      const laneLeft = () => gsap.utils.random(0.02, 0.26) * width;
      const laneRight = () => gsap.utils.random(0.74, 0.98) * width;

      made.forEach((node, index) => {
        const size = gsap.utils.random(2, 7);
        const startX = index % 2 === 0 ? laneLeft() : laneRight();
        const startY = gsap.utils.random(0.1, 1.05) * height;

        gsap.set(node, {
          x: startX,
          y: startY,
          scale: size,
          rotation: gsap.utils.random(0, 90),
          opacity: 0,
          transformOrigin: "50% 50%",
        });

        // One timeline per mote, each with its own period, so they never fall
        // into step with one another the way a shared stagger eventually does.
        gsap
          .timeline({ repeat: -1, repeatRefresh: true, delay: index * 0.28 })
          .to(node, {
            duration: () => gsap.utils.random(4, 7),
            opacity: () => gsap.utils.random(0.08, 0.3),
            ease: "sine.inOut",
          })
          .to(
            node,
            {
              duration: () => gsap.utils.random(9, 16),
              y: `-=${gsap.utils.random(90, 240)}`,
              x: `+=${gsap.utils.random(-70, 70)}`,
              rotation: `+=${gsap.utils.random(-140, 140)}`,
              ease: "none",
            },
            0,
          )
          .to(node, {
            duration: () => gsap.utils.random(4, 7),
            opacity: 0,
            ease: "sine.inOut",
          });
      });

      return () => {
        for (const node of made) node.remove();
      };
    },
    { scope: root, dependencies: [vip, width, height] },
  );

  return (
    <svg
      ref={root}
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}
