"use client";

import { useRef } from "react";

import { gsap, particleBudget, useGSAP } from "@/lib/gsap";

/**
 * Sparks struck off the seal, thrown by real physics.
 *
 * Each particle gets its own `physics2D` tween — an initial velocity, an angle
 * and gravity — so nothing here is a hand-authored keyframe. That is the whole
 * reason to use the plugin rather than fake it with translate keyframes: the arcs
 * differ from each other and from run to run, so two arrivals half a minute apart
 * do not play the identical shape and start looking like a screensaver.
 *
 * THEY LEAVE FROM THE RIM, not the middle. A burst from the centre is hidden
 * behind the face for its first hundred milliseconds and then appears to pass
 * through the visitor's head. Struck off the edge, it reads as the seal landing.
 *
 * The viewBox is a fixed 100x100 square matched to the seal's own square box, so
 * every distance in here is a fraction of the seal. The burst is then the same
 * shape on a 245px projector portrait and a 760px 4K one, with no pixel values
 * to re-tune per panel.
 *
 * SVG rather than canvas: a few dozen elements for under two seconds, staying
 * crisp on a 4K panel where a bitmap canvas would need manual DPR scaling.
 * Transform and opacity only, so each particle stays on the compositor.
 */
export function SparkEmitter({
  /** Gold for a VIP, cool white and green otherwise. */
  vip = false,
  /** Held back so the burst lands with the name, not before it. */
  delay = 0,
}: {
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
        : ["#f4f8fb", "#9db0c4", "#6ea8ff", "#24c07a"];

      for (let index = 0; index < count; index += 1) {
        // Two shapes, mixed. A single shape reads as a pattern; two read as
        // debris struck off something solid.
        const shard = index % 3 === 0;
        const node = document.createElementNS(
          namespace,
          shard ? "rect" : "circle",
        ) as SVGElement;

        node.setAttribute("fill", palette[index % palette.length]);

        // Placed on the rim, then tweened outward along the tangent-ish angle,
        // so each spark leaves from where it appears to have been struck.
        const angle = gsap.utils.random(0, Math.PI * 2);
        const cx = 50 + Math.cos(angle) * 50;
        const cy = 50 + Math.sin(angle) * 50;

        if (shard) {
          const w = gsap.utils.random(0.35, 0.75);
          node.setAttribute("width", String(w));
          node.setAttribute("height", String(w * gsap.utils.random(2.5, 5)));
          node.setAttribute("rx", String(w / 2));
          node.setAttribute("x", String(cx - w / 2));
          node.setAttribute("y", String(cy));
        } else {
          node.setAttribute("r", String(gsap.utils.random(0.3, 0.85)));
          node.setAttribute("cx", String(cx));
          node.setAttribute("cy", String(cy));
        }

        // Outward from the centre through this rim point, with a little scatter
        // so the ring does not look mechanically even.
        node.dataset.angle = String(
          (angle * 180) / Math.PI + gsap.utils.random(-28, 28),
        );

        svg.appendChild(node);
        made.push(node);
      }

      gsap.set(made, { transformOrigin: "50% 50%", opacity: 0 });

      const timeline = gsap.timeline({ delay });

      timeline.to(made, {
        duration: gsap.utils.random(0.85, 1.4, 0.01, true),
        physics2D: {
          velocity: () => gsap.utils.random(26, 78),
          angle: (index: number, target: SVGElement) =>
            Number(target.dataset.angle ?? 0),
          gravity: 110,
        },
        rotation: () => gsap.utils.random(-320, 320),
        opacity: 1,
        ease: "none",
        stagger: { each: 0.005, from: "random" },
      });

      // The fade begins while the arc is still rising, so nothing hangs in the
      // air waiting to disappear.
      timeline.to(
        made,
        {
          duration: 0.5,
          opacity: 0,
          scale: 0.2,
          ease: "power2.in",
          stagger: { each: 0.005, from: "random" },
        },
        "-=0.5",
      );

      // useGSAP reverts the tweens; the nodes were created by hand, so they are
      // removed by hand.
      return () => {
        for (const node of made) node.remove();
      };
    },
    { scope: root, dependencies: [vip, delay] },
  );

  return (
    <svg
      ref={root}
      aria-hidden
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    />
  );
}
