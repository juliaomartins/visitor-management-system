"use client";

import { useRef } from "react";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

/**
 * The tais at the foot of the wall.
 *
 * This replaced a two-path SVG swoosh filled with the accent colour. The swoosh
 * was fine and it was anonymous — the same shape sits at the bottom of every
 * conference template on earth. A tais is not decoration here: it is the cloth
 * Timor-Leste puts around a guest's shoulders when they arrive, which is exactly
 * what this screen is for. Nothing else on the panel says where the visitor has
 * landed; a photograph of real handwoven cloth says it before anybody reads a
 * word.
 *
 * TWO LAYERS, CROSSING, AT DIFFERENT SPEEDS. The darkened base is the cloth
 * draped along the foot; the lit ribbon crosses in front of it. Neither is a
 * loop anybody can catch — their drifts are 128s and 91s, so the pair only
 * returns to the same relative position once every ~3.2 hours, and the swell
 * periods (17s and 23s) are coprime enough that the combined motion has no
 * visible period at all. That matters more here than anywhere else on the
 * screen: this runs in a lobby for fourteen hours, and a background loop short
 * enough to notice is the thing that makes a display irritating to stand near.
 *
 * THE ACCENT SURVIVES THE CHANGE. The old wave was one of four places the card
 * says blue-for-visitor and gold-for-VIP, and losing one of the four would have
 * weakened a signal that has to work on somebody walking past who is not looking
 * for it. So the accent is not gone from the wave — it lights it. Each layer
 * carries a `drop-shadow` in the accent, which follows the cloth's own alpha and
 * therefore traces the crest exactly, however it is drifting. Blue light on the
 * cloth for a visitor, gold for a VIP.
 *
 * THERE IS NO SHEEN ON THIS CLOTH, and it is the first thing anybody will think
 * to add. Satin tais does catch the light, and a highlight sweeping the weave
 * was built and thrown away. `mix-blend-mode: overlay` is the obvious way to
 * make light land on the cloth and nowhere else — it multiplies down to nothing
 * over the near-black ground and opens up over the lit red — and it does not
 * work here. Both tracks carry a `filter` and `will-change: transform`, so each
 * is promoted to its own compositing layer, and a blended element whose backdrop
 * sits in a different layer has no backdrop at all: per spec, blending against
 * transparent yields the source unchanged. On the wall that is a plain white
 * gradient — a grey slab a third of the screen wide, in front of the guests.
 * Verified in headless Chrome with and without GPU, and `isolation: isolate` on
 * this root makes it worse rather than better, because it excludes the stage
 * from the group as well.
 *
 * A mask-based version does work — a child of a track inherits its drift for
 * free, and `mask-image` clips a moving highlight to the cloth's own silhouette.
 * It was not kept: it is a third full-width composited layer and one more thing
 * that renders as a rectangle if `mask-image` is missing, bought for a glint on
 * a display nobody stands closer than three metres to. Two crossing layers at
 * different speeds is already the motion this needs.
 *
 * @see scripts/build-tais-tiles.py for why the tiles are mirrored, and why the
 * supplied `.svg` files are not what the browser loads.
 */

/**
 * One tile is the artwork plus its own mirror image — 3966x793.
 *
 * The number appears here and in `scripts/build-tais-tiles.py` and nowhere else.
 * Both tiles are built at the same size on purpose so this is one constant
 * rather than one per layer.
 */
const TILE_ASPECT = 3966 / 793;

/**
 * How many tiles each drifting track carries.
 *
 * The track is `REPEATS` tiles wide and drifts by exactly one of them
 * (`xPercent: -100 / REPEATS`) before restarting, which is a perfect loop
 * because a tile is identical to its neighbour. Five rather than two so the
 * track still covers the viewport at full drift: it needs
 * `(REPEATS - 1) * tileWidth >= viewportWidth`, and a tile is 5x the band
 * height, so five copies hold as long as the band clears width/20 — true down
 * to a 1760px-wide window at the 88px floor, and true of every panel this
 * runs on including 32:9.
 */
const REPEATS = 5;

/**
 * A track's width, written out rather than inferred.
 *
 * `aspect-ratio` would express this in one property, and on an absolutely
 * positioned element with `height: 100%` it depends on the browser resolving an
 * automatic width from the ratio instead of shrink-to-fitting it. That is
 * correct per spec and it is not worth betting a wall panel on: if it resolves
 * the other way the track collapses and the foot of the screen is bare. `calc`
 * from the same token the height comes from cannot be read two ways.
 *
 * The background is then sized as a fraction of THIS width rather than in
 * `auto`, so the tiles divide the track exactly and no rounding error can open
 * a hairline of stage between two of them.
 */
const trackWidth = (height: string) =>
  `calc(${height} * ${(TILE_ASPECT * REPEATS).toFixed(4)})`;

type Variant = "arrival" | "idle";

export function TaisWave({ variant = "arrival" }: { variant?: Variant }) {
  const root = useRef<HTMLDivElement | null>(null);
  const idle = variant === "idle";

  useGSAP(
    () => {
      const host = root.current;
      if (!host) return;

      const pick = (selector: string) => host.querySelector<HTMLElement>(selector);

      const base = pick("[data-tais-base]");
      const ribbon = pick("[data-tais-ribbon]");

      /*
        Reduced motion keeps the cloth and drops every tween. A still photograph
        of a tais is the point of this component; the drift is the flourish. So
        this branch loses nothing that carries meaning, which is the test.
      */
      if (prefersReducedMotion()) return;

      // The idle screen holds this for tens of minutes at a time and has a
      // clock to be the thing you look at. Same cloth, half the current.
      const pace = idle ? 1.55 : 1;

      /*
        THE DRIFT. `xPercent` is a share of the element's OWN width, and the
        element is exactly REPEATS tiles wide, so -100/REPEATS is one tile to
        the pixel at any viewport size — no measurement, no ResizeObserver, and
        nothing to go stale when the panel is rotated. Landing one tile along is
        indistinguishable from where it started, so the restart is invisible.

        Opposite directions. Two layers drifting the same way is a conveyor
        belt; drifting against each other is parallax, and it is the crossing
        that makes the pair read as two separate pieces of cloth rather than one
        printed backdrop.
      */
      if (base)
        gsap.to(base, {
          xPercent: -100 / REPEATS,
          duration: 128 * pace,
          ease: "none",
          repeat: -1,
        });

      if (ribbon)
        gsap.fromTo(
          ribbon,
          { xPercent: -100 / REPEATS },
          { xPercent: 0, duration: 91 * pace, ease: "none", repeat: -1 },
        );

      /*
        THE SWELL — cloth breathing, not a wave scrolling.

        `scaleY` from the bottom edge, so however far it swells the band stays
        welded to the bottom of the screen and can never open a gap under
        itself. That is the whole reason it is a scale and not a `y` tween: a
        4% vertical translate on a 260px band is 10px of stage showing beneath
        the cloth, which on a wall reads as the image having failed to load.
      */
      if (base)
        gsap.to(base, {
          scaleY: 1.05,
          transformOrigin: "50% 100%",
          duration: 17 * pace,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

      if (ribbon)
        gsap.to(ribbon, {
          scaleY: 1.035,
          transformOrigin: "50% 100%",
          duration: 23 * pace,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

      /*
        THE ENTRANCE, and it is deliberately only the ribbon.

        The arrival card's own timeline lifts this whole component from
        `yPercent: 100`, so the cloth is already sweeping up. The ribbon rising
        a further fifth of its height a beat later is follow-through — the front
        layer lagging the back is what a real piece of cloth does when the thing
        holding it moves, and it is the difference between a graphic sliding in
        and something with weight settling.
      */
      if (ribbon)
        gsap.from(ribbon, {
          yPercent: 24,
          duration: 1.25,
          ease: "expo.out",
          delay: 0.12,
        });

    },
    { scope: root, dependencies: [idle] },
  );

  /*
    A layer's filter, and the reason there is exactly one `drop-shadow` in it.

    `drop-shadow` reads the element's rendered alpha, which for a background
    image is the cloth's own silhouette — so the accent traces the crest and
    keeps tracing it while the tile drifts, with nothing to keep in sync. A
    second chained shadow would give a crisper hairline over the soft glow and
    costs a second full filter pass across a track five viewports wide, every
    frame it is rasterised. One pass, with a radius that reads from five metres,
    is the trade this panel wants.
  */
  const accent = "var(--accent, var(--color-expo))";

  /*
     Every dimension comes from globals.css, including the ribbon's proportions.
     They live there rather than here because the arrival stage's bottom padding
     is derived from the same two numbers — see `--tais-clear` — and a ribbon
     that grew in this file while the clearance stayed behind is exactly how the
     content ends up on top of the cloth.
  */
  const band = "var(--tais-band)";
  const ribbonHeight = `calc(${band} * var(--tais-ribbon))`;

  /** Shared by both tracks: the tile, laid REPEATS times across the width. */
  const tiled = {
    backgroundRepeat: "repeat-x",
    backgroundSize: `${100 / REPEATS}% 100%`,
    backgroundPosition: "left bottom",
    willChange: "transform",
  } as const;

  return (
    <div
      aria-hidden
      data-wave
      data-tais
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-(--tais-band)"
      style={{ opacity: idle ? 0.82 : 1 }}
    >
      {/*
        THE BASE — the draped cloth, held back.

        Darkened to half, and that is what puts it behind. It is the same
        photograph at the same scale as the ribbon, so brightness is the only
        depth cue available short of blurring it, and a blur on a track this
        wide is a filter pass nobody would see the benefit of at five metres.
      */}
      <div
        data-tais-base
        className="absolute bottom-0 left-0"
        style={{
          ...tiled,
          height: band,
          width: trackWidth(band),
          backgroundImage: "url(/brand/tais-wave-1.webp)",
          filter: `var(--tais-back) drop-shadow(0 -4px 30px color-mix(in srgb, ${accent} 62%, transparent))`,
        }}
      />

      {/*
        THE RIBBON — the lit cloth, crossing in front.

        Taller than the band and hung below it, so its crest breaks above the
        base's and its lower edge is cut off by the bottom of the screen rather
        than ending in mid-air. Nothing clips it at the top: the band is only
        the reference height, and the ribbon is meant to break out of it.
      */}
      <div
        data-tais-ribbon
        className="absolute left-0"
        style={{
          ...tiled,
          height: ribbonHeight,
          width: trackWidth(ribbonHeight),
          bottom: `calc(${band} * var(--tais-ribbon-drop) * -1)`,
          backgroundImage: "url(/brand/tais-wave-2.webp)",
          filter: `drop-shadow(0 -3px 12px color-mix(in srgb, ${accent} 80%, transparent))`,
        }}
      />

    </div>
  );
}
