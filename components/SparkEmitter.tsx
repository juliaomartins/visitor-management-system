"use client";

import { useRef } from "react";

import { gsap, particleBudget, useGSAP } from "@/lib/gsap";

/**
 * A burst of sparks, thrown by real physics.
 *
 * Each particle gets its own `physics2D` tween — an initial velocity, an angle,
 * and gravity — so nothing here is a hand-authored keyframe. That is the whole
 * reason to use the plugin rather than fake it with translate keyframes: the arcs
 * differ from each other and from run to run, so two arrivals half a minute apart
 * do not play the identical shape and start looking like a screensaver.
 *
 * SVG rather than canvas. There are a few dozen elements for under two seconds,
 * which SVG handles comfortably, and it stays crisp on a 4K lobby panel where a
 * bitmap canvas would need manual DPR scaling to avoid looking soft.
 *
 * Particles are transform-and-opacity only, so each one stays on the compositor
 * and never triggers layout.
 */
export function SparkEmitter({
  /** Where the burst originates, as a percentage of the box. */
  originX = 50,
  originY = 50,
  /** Sparks are gold for a VIP and cool white otherwise. */
  vip = false,
  /** Held back slightly so the burst lands with the name, not before it. */
  delay = 0,
}: {
  originX?: number;
  originY?: number;
  vip?: boolean;
  delay?: number;
}) {
  const root = useRef<SVGSVGElement | null>(null);

  useGSAP(
    () => {
      const svg = root.current;
      if (!svg) return;

      const count = particleBudget();
      if (count === 0) return; // reduced motion, or a device that cannot spare it

      const namespace = "http://www.w3.org/2000/svg";
      const made: SVGElement[] = [];

      // The palette is the screen's own: gold carries VIP and nothing else, so a
      // normal arrival never throws a gold spark.
      const palette = vip
        ? ["#e0a92c", "#f5cf6a", "#ffe9b0", "#c98f1a"]
        : ["#f4f8fb", "#9db0c4", "#24c07a", "#6ea8ff"];

      for (let index = 0; index < count; index += 1) {
        // Two shapes, mixed: round embers and thin shards. A single shape reads
        // as a pattern; two read as debris.
        const shard = index % 3 === 0;
        const node = document.createElementNS(
          namespace,
          shard ? "rect" : "circle",
        ) as SVGElement;

        const tint = palette[index % palette.length];
        node.setAttribute("fill", tint);

        if (shard) {
          const w = gsap.utils.random(1.1, 2.4);
          node.setAttribute("width", String(w));
          node.setAttribute("height", String(w * gsap.utils.random(2.5, 5)));
          node.setAttribute("rx", String(w / 2));
        } else {
          node.setAttribute("r", String(gsap.utils.random(0.9, 2.6)));
        }

        svg.appendChild(node);
        made.push(node);
      }

      // Percentages, so the emitter follows the box on any screen size without
      // being told the pixel dimensions.
      gsap.set(made, {
        xPercent: -50,
        yPercent: -50,
        transformOrigin: "50% 50%",
        x: `${originX}%`,
        y: `${originY}%`,
        opacity: 0,
      });

      const timeline = gsap.timeline({ delay });

      timeline.to(made, {
        duration: gsap.utils.random(0.9, 1.5, 0.01, true),
        // A cone thrown up and outward, not a uniform ring: gravity then pulls it
        // into the arc that makes it read as thrown rather than exploded.
        physics2D: {
          velocity: () => gsap.utils.random(220, 620),
          angle: () => gsap.utils.random(-165, -15),
          gravity: 780,
        },
        rotation: () => gsap.utils.random(-320, 320),
        opacity: 1,
        ease: "none",
        stagger: { each: 0.006, from: "random" },
      });

      // Fade begins while the arc is still rising, so nothing hangs in the air
      // waiting to disappear.
      timeline.to(
        made,
        {
          duration: 0.55,
          opacity: 0,
          scale: 0.2,
          ease: "power2.in",
          stagger: { each: 0.006, from: "random" },
        },
        "-=0.55",
      );

      // useGSAP reverts the tweens; the nodes were created by hand, so they are
      // removed by hand.
      return () => {
        for (const node of made) node.remove();
      };
    },
    { scope: root, dependencies: [originX, originY, vip, delay] },
  );

  return (
    <svg
      ref={root}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    />
  );
}
