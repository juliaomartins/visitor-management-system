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
 * ONE COPY OF THE PHOTOGRAPH, DRAWN ACROSS THE PANEL. NOT A TILE.
 *
 * This is the correction that matters, and it is a correction to this file's
 * own previous answer. The drape used to be laid down as a repeating tile —
 * the frame plus its own mirror, so it could repeat against itself with an
 * invisible seam. It repeated honestly. The problem was never the seam; it was
 * that the band was 213px tall at 1080p, so a 2.5:1 frame came out 532px wide
 * and the panel carried 3.6 copies of it. The artwork is a photograph of one
 * piece of cloth sagging under its own weight into a single broad curve, and
 * 3.6 of them in a row is a chevron border — the one thing a tais is not.
 *
 * So there is one drape, spanning the panel, and it is never repeated. Its
 * silhouette is the photograph's silhouette: high at the left corner, diving to
 * a third of that at the centre, rising again to the right. The bowl is what
 * makes it work as a foundation — the deepest part of the cloth sits exactly
 * where the visitor's name is, and the cloth stands tallest in the gutters
 * where nothing is written. `--tais-clear` and the stage's 13vw side padding
 * are the two halves of that bargain; see globals.css.
 *
 * THE COST IS A SIDEWAYS STRETCH, AND IT IS BOUNDED RATHER THAN AVOIDED. A
 * 2.5:1 photograph cannot span an 8:1 band at its own proportions.
 * `--tais-band` is sized from the viewport's WIDTH precisely so the ratio is a
 * constant — 1.66x on every 16:9 panel from 1366x768 to 3840x2160 — instead of
 * drifting with the window. Cropping the sides instead was measured and buys
 * nothing: the silhouette is near enough linear at both ends that cutting the
 * tall corners off forces the band taller by the same proportion it saves.
 *
 * TWO PIECES OF CLOTH, NOT ONE IMAGE OFFSET TWICE. The drape is the reference
 * photograph. Behind it hangs a second, genuinely different piece — the ribbon
 * from `art/tais-wave-2.svg`, thin flowing bands with a silhouette of its own —
 * held back by `--tais-back` and drifting on its own clock. Their crests are
 * close enough to sit as two sags of the same cloth and far enough apart that
 * the back one shows along its whole length rather than only at the ends.
 *
 * NEITHER DRIFT IS A LOOP ANYBODY CAN CATCH. The two travel on 71s and 103s and
 * breathe on 19s and 29s, with the drape swaying on 31s. Nothing shares a
 * factor, so the combined motion has no visible period. That matters more here
 * than anywhere else on the screen: this runs in a lobby for fourteen hours,
 * and a background loop short enough to notice is the thing that makes a
 * display irritating to stand near.
 *
 * THE ACCENT SURVIVES THE CHANGE. The old wave was one of four places the card
 * says blue-for-visitor and gold-for-VIP, and losing one of the four would have
 * weakened a signal that has to work on somebody walking past who is not looking
 * for it. So the accent is not gone from the wave — it lights it. Each layer
 * carries a `drop-shadow` in the accent, which follows the cloth's own alpha and
 * therefore traces the hem exactly, however it is drifting. Blue light on the
 * cloth for a visitor, gold for a VIP.
 *
 * THERE IS NO SHEEN ON THIS CLOTH, and it is the first thing anybody will think
 * to add. Satin tais does catch the light, and a highlight sweeping the weave
 * was built and thrown away. `mix-blend-mode: overlay` is the obvious way to
 * make light land on the cloth and nowhere else — it multiplies down to nothing
 * over the near-black ground and opens up over the lit red — and it does not
 * work here. Both layers carry a `filter` and `will-change: transform`, so each
 * is promoted to its own compositing layer, and a blended element whose backdrop
 * sits in a different layer has no backdrop at all: per spec, blending against
 * transparent yields the source unchanged. On the wall that is a plain white
 * gradient — a grey slab a third of the screen wide, in front of the guests.
 * Verified in headless Chrome with and without GPU, and `isolation: isolate` on
 * this root makes it worse rather than better, because it excludes the stage
 * from the group as well.
 *
 * @see scripts/build-tais-layers.py for why the artwork is not served as it was
 * supplied, and why nothing is mirrored any more.
 */

type Variant = "arrival" | "idle";

/**
 * How each layer is painted: one copy, stretched to the element, welded to the
 * bottom edge.
 *
 * `100% 100%` rather than `cover` is deliberate and it is the whole mechanism.
 * `cover` would preserve the photograph's proportions and crop whatever did not
 * fit, which on an 8:1 band means discarding all but the middle fifth of the
 * cloth — the bowl, the two rising corners and both outer hems, gone. Stretching
 * keeps the entire silhouette and pays for it in one axis, at a ratio the band
 * is sized to hold constant.
 */
const painted = {
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 100%",
  backgroundPosition: "center bottom",
  willChange: "transform",
} as const;

/**
 * A layer's box, cut wider than the panel so its drift has somewhere to go.
 *
 * `bleed` is a share of the viewport, per side. The element is that much wider
 * on each edge and offset left by the same, so at rest it covers the panel
 * exactly and at full drift it still does. Without the overhang a horizontal
 * drift would walk the cloth's own vertical edge into view — a straight cut
 * through a photograph of hand-woven cloth, which is the single most obviously
 * wrong thing this component could put on a wall.
 */
const cut = (bleed: string) => ({
  left: `calc(${bleed} * -100%)`,
  width: `calc(100% + ${bleed} * 200%)`,
});

/**
 * How far a layer may drift, as a percentage of ITS OWN width.
 *
 * GSAP's `xPercent` is a share of the element, not of the panel, and the
 * element is wider than the panel by twice its bleed — so the slack expressed
 * in the element's own terms is `bleed / (1 + 2 * bleed)`, not `bleed`. Getting
 * that wrong is not a wobble; it is the cloth's cut edge appearing at the side
 * of the screen for a few seconds every couple of minutes, which is exactly the
 * kind of fault nobody is watching for at the time it happens.
 *
 * The 0.85 is margin against sub-pixel rounding at the edges.
 */
const travel = (bleed: number) => (bleed / (1 + 2 * bleed)) * 100 * 0.85;

const DRAPE_BLEED = 0.02;
const RIBBON_BLEED = 0.06;

export function TaisWave({ variant = "arrival" }: { variant?: Variant }) {
  const root = useRef<HTMLDivElement | null>(null);
  const idle = variant === "idle";

  useGSAP(
    () => {
      const host = root.current;
      if (!host) return;

      const pick = (selector: string) => host.querySelector<HTMLElement>(selector);

      const drape = pick("[data-tais-drape]");
      const ribbon = pick("[data-tais-ribbon]");

      /*
        Reduced motion keeps the cloth and drops every tween. A still photograph
        of a tais is the point of this component; the drift is the flourish. So
        this branch loses nothing that carries meaning, which is the test — and
        what it leaves is the reference photograph, whole, at rest.
      */
      if (prefersReducedMotion()) return;

      // The idle screen holds this for tens of minutes at a time and has a
      // clock to be the thing you look at. Same cloth, half the current.
      const pace = idle ? 1.55 : 1;

      /*
        THE DRIFT, and it is a sway rather than a scroll.

        A tile could travel one tile-width and start again, which is why the old
        version drifted in one direction forever. A single photograph cannot: it
        has ends. So each layer eases back and forth within its own overhang on
        a long yoyo, which is also the truer motion — cloth hung at the foot of
        a wall moves in the draught and returns, it does not migrate.

        Opposite phase. Two layers swaying together is one object; swaying
        against each other is parallax, and it is the crossing that makes the
        pair read as two separate pieces of cloth rather than one printed
        backdrop.
      */
      if (drape)
        gsap.fromTo(
          drape,
          { xPercent: -travel(DRAPE_BLEED) },
          {
            xPercent: travel(DRAPE_BLEED),
            duration: 71 * pace,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          },
        );

      if (ribbon)
        gsap.fromTo(
          ribbon,
          { xPercent: travel(RIBBON_BLEED) },
          {
            xPercent: -travel(RIBBON_BLEED),
            duration: 103 * pace,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          },
        );

      /*
        THE SWELL — cloth breathing, not a wave scrolling.

        `scaleY` from the bottom edge, so however far it swells the band stays
        welded to the bottom of the screen and can never open a gap under
        itself. That is the whole reason it is a scale and not a `y` tween: a
        4% vertical translate on a 480px band is 19px of stage showing beneath
        the cloth, which on a wall reads as the image having failed to load.

        The drape breathes less than the ribbon. It is the heavier cloth and it
        is the one the eye is resting on; the layer that moves most should be
        the one nobody is looking at.
      */
      if (drape)
        gsap.to(drape, {
          scaleY: 1.028,
          transformOrigin: "50% 100%",
          duration: 19 * pace,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

      if (ribbon)
        gsap.to(ribbon, {
          scaleY: 1.045,
          transformOrigin: "50% 100%",
          duration: 29 * pace,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

      /*
        THE SWAY, and it is a quarter of a degree.

        Skew from the bottom edge leans the crest without moving the foot, which
        is how a cloth hung along a rail actually moves — the edge it hangs from
        stays put and everything above it leans. At 0.22deg the top edge travels
        under 2px on a 480px band, so it is not a shape anybody can see; it is
        the reason the drift does not read as a photograph on a slider.
      */
      if (drape)
        gsap.fromTo(
          drape,
          { skewX: -0.22 },
          {
            skewX: 0.22,
            transformOrigin: "50% 100%",
            duration: 31 * pace,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          },
        );

      /*
        THE ENTRANCE, and it is deliberately only the ribbon.

        The arrival card's own timeline lifts this whole component from
        `yPercent: 100`, so the cloth is already sweeping up. The ribbon rising
        a further fifth of its height a beat later is follow-through — the back
        layer lagging the front is what a real piece of cloth does when the
        thing holding it moves, and it is the difference between a graphic
        sliding in and something with weight settling.
      */
      if (ribbon)
        gsap.from(ribbon, {
          yPercent: 22,
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
    image is the cloth's own silhouette — so the accent traces the hem and keeps
    tracing it while the cloth sways, with nothing to keep in sync. A second
    chained shadow would give a crisper hairline over the soft glow and costs a
    second full filter pass across a layer wider than the panel, every frame it
    is rasterised. One pass, with a radius that reads from five metres, is the
    trade this screen wants.
  */
  const accent = "var(--accent, var(--color-expo))";

  /*
     Every dimension comes from globals.css, including the ribbon's proportions.
     They live there rather than here because the arrival stage's bottom padding
     is derived from the same numbers — see `--tais-clear` — and a cloth that
     grew in this file while the clearance stayed behind is exactly how the
     content ends up on top of the weave.
  */
  const band = "var(--tais-band)";

  return (
    <div
      aria-hidden
      data-wave
      data-tais
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-(--tais-band)"
      style={{ opacity: idle ? 0.82 : 1 }}
    >
      {/*
        THE RIBBON — the second cloth, hung behind.

        Held back by `--tais-back`, which darkens it on the dark stage and fades
        it on the light one. It is cloth at the same scale as the drape, so
        brightness is the only depth cue available short of blurring it, and a
        blur on a layer this wide is a filter pass nobody would see the benefit
        of at five metres.

        Taller than the band, so its crest breaks above the drape's along the
        whole length rather than only where the drape happens to dive. Nothing
        clips it: the band is the reference height, not a frame.
      */}
      <div
        data-tais-ribbon
        className="absolute bottom-0"
        style={{
          ...painted,
          ...cut("var(--tais-ribbon-bleed)"),
          height: `calc(${band} * var(--tais-ribbon))`,
          backgroundImage: "url(/brand/tais-ribbon.webp)",
          filter: `var(--tais-back) drop-shadow(0 -4px 30px color-mix(in srgb, ${accent} 62%, transparent))`,
        }}
      />

      {/*
        THE DRAPE — the reference photograph, in front, at full strength.

        Three pieces of handwoven cloth with their piped and stitched hems,
        sagging together into one curve. Nothing is done to it but the stretch
        the band is sized to bound: no darkening, no tint, no mask. It is the
        thing this component exists to show.
      */}
      <div
        data-tais-drape
        className="absolute bottom-0"
        style={{
          ...painted,
          ...cut("var(--tais-drape-bleed)"),
          height: band,
          backgroundImage: "url(/brand/tais-drape.webp)",
          filter: `drop-shadow(0 -3px 12px color-mix(in srgb, ${accent} 80%, transparent))`,
        }}
      />
    </div>
  );
}
