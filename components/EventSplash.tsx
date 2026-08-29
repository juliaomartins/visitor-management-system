"use client";

import { useRef } from "react";

import { PlumeMotif, PIVOT, ART } from "@/components/PlumeMotif";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * The first-load splash: the event mark, assembled and then handed over.
 *
 * ONE ORCHESTRATED SEQUENCE, NOT SCATTERED EFFECTS. A single angular sweep
 * rotates about the plume's pivot and each blade materialises as the sweep
 * crosses its bearing -- so the four arrivals are 13.6 degrees apart because the
 * artwork put them there, not because a stagger was authored. It reads as one
 * gesture, a wing beat, rather than four entrances.
 *
 * IT IS DELIBERATELY SHORT: 1.75s end to end, and the authentic artwork is on
 * screen by 1.0s. This plays on every load of a wall panel, and on an unpaired
 * screen the pairing form is waiting behind it -- a splash anybody has to wait
 * through twice has already outstayed its welcome. The first cut ran 3.2s, which
 * felt considered in isolation and interminable on the second viewing.
 *
 * Nothing was cut from the sequence to get there; every beat is still present,
 * just tighter. The sweep carries the recognition, so it keeps the largest share
 * of the time and the hold gives up the most.
 *
 * THE ACCENT BEAT HAPPENS ONCE, and it does real work. The obvious choice was a
 * gleam travelling along the gold ring, which is the single most-used logo beat
 * there is. Instead the flag's star -- the one non-repeating element in the mark
 * -- snaps in at the pivot with a single flash, and that flash is timed to cover
 * the cross-dissolve. So the beat hides the seam where the derived motif hands
 * off to the authentic file, rather than decorating alongside it.
 *
 * WHAT REMAINS ON SCREEN IS ALWAYS THE REAL ASSET. The motif exists for barely
 * a second and is gone by 1.08s; from the dissolve onward the viewer is looking
 * at `public/brand/drcc-event.png` and nothing else.
 *
 * THE ARTWORK IS NEVER HIDDEN BY SCRIPT, and that is a deliberate structural
 * choice rather than a detail. An earlier cut set the PNG to `opacity: 0` and
 * faded it in at the dissolve, which meant any interruption -- a stalled ticker,
 * a thrown tween, a tab throttled in the background -- left the panel showing
 * nothing at all. Caught exactly that in testing: the timeline froze at 0.63s
 * and the wall went black.
 *
 * So the PNG sits at full opacity for the whole sequence and an opaque cover in
 * the stage colour hides it, with the motif drawn on top of that cover. The
 * "cross-dissolve" is the cover and the motif retiring together to reveal what
 * was underneath all along. The failure mode is now the plume sitting on a dark
 * field -- still the event's mark -- instead of an empty screen, and a total
 * script failure shows the authentic artwork because that is the markup default.
 *
 * THE END STATE IS THE CSS DEFAULT. Motif and cover are `opacity: 0` and the PNG
 * is `opacity: 1` in the markup, so a browser with no JavaScript shows the
 * correct final frame. GSAP only ever sets the "from" states. The overlay also
 * carries a pure-CSS retire animation, so with no JS it still clears itself
 * instead of trapping the wall behind a logo for the whole event.
 */
export function EventSplash({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const host = root.current;
      if (!host) return;

      // JavaScript is running, so the CSS fallback must stand down or it will
      // fight the timeline for the same property.
      host.style.animation = "none";

      const media = gsap.matchMedia();

      /*
        REDUCED MOTION RESOLVES TO THE STATIC END STATE, which here means the
        authentic artwork and nothing else: no sweep, no ring, no flash, no
        dissolve. It still leaves, and it leaves sooner -- holding a motionless
        splash for the full run would be a worse experience, not a gentler one.
      */
      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap
          .timeline({ onComplete: onDone })
          .from(host, { duration: 0.25, opacity: 0 })
          .to(host, { duration: 0.3, opacity: 0 }, "+=0.7");
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        /*
          THE SEQUENCE HEALS ITSELF IF IT STALLS.

          A timeline is not guaranteed to finish. Chrome throttles rAF in a
          background tab, a kiosk can be minimised during setup, and a thrown
          tween stops the playhead where it stands. Any of those leaves the cover
          up and the artwork behind it -- a black panel with no way out.

          So a wall-clock timer, independent of the ticker, force-lands the end
          state: kill everything, drop the cover and the motif, reveal the
          artwork, dismiss. 2.2s is comfortably past the 1.75s the sequence
          needs, so it never fires on a healthy run.
        */
        let bail = 0;
        const finish = () => {
          window.clearTimeout(bail);
          onDone();
        };

        const timeline = gsap.timeline({ onComplete: finish });

        const pick = <T extends Element>(selector: string) =>
          host.querySelector<T>(selector);

        const wash = pick("[data-splash-wash]");
        const motif = pick("[data-motif]");
        const sweep = pick("[data-sweep]");
        const ring = pick("[data-ring]");
        const star = pick("[data-star]");
        const flash = pick("[data-flash]");
        const real = pick("[data-real]");
        const cover = pick("[data-cover]");

        // The cover hides the artwork; the motif draws on top of the cover. The
        // artwork itself is never touched, so it cannot be left invisible.
        gsap.set([motif, cover], { opacity: 1 });
        gsap.set(star, { scale: 0, transformOrigin: "50% 50%" });

        // 0.00 -- the ground lifts. Same vocabulary as the arrival card's wash.
        if (wash)
          timeline.from(wash, { duration: 0.55, opacity: 0, scale: 0.75 }, 0);

        /*
          0.08 -- THE SWEEP. `strokeDashoffset` 360 to 270 uncovers a quarter
          turn of the mask disc, running twelve o'clock to three o'clock. Every
          blade is revealed by this one moving edge.

          `power2.out` so the gesture decelerates into place rather than
          arriving at constant speed, which reads as a machine rather than a
          hand.
        */
        if (sweep)
          timeline.to(
            sweep,
            { duration: 0.55, strokeDashoffset: 270, ease: "power2.out" },
            0.08,
          );

        // 0.32 -- the hairline ring closes behind the sweep.
        if (ring)
          timeline.to(
            ring,
            { duration: 0.4, strokeDashoffset: 0, ease: "power1.inOut" },
            0.32,
          );

        // 0.63 -- the settle. The overshoot resolving, 2% and no more.
        timeline.fromTo(
          motif,
          { scale: 1.02 },
          { duration: 0.16, scale: 1, ease: "power2.out", transformOrigin: "50% 50%" },
          0.63,
        );

        // The ring leaves before the handover, so it never has to match the
        // artwork's own bevelled ring.
        if (ring)
          timeline.to(ring, { duration: 0.2, opacity: 0 }, 0.63);

        // 0.78 -- THE ACCENT BEAT. Once. The star, at the pivot.
        if (star)
          timeline.to(
            star,
            { duration: 0.36, scale: 1, ease: "back.out(2.2)" },
            0.78,
          );

        if (flash)
          timeline
            .fromTo(
              flash,
              { opacity: 0, scale: 0.25 },
              { duration: 0.14, opacity: 0.2, scale: 1, ease: "power2.out" },
              0.78,
            )
            .to(flash, { duration: 0.3, opacity: 0, ease: "power2.in" }, 0.92);

        // 0.78 -- the handover, underneath the flash. Cover and motif retire
        // together to uncover the artwork that has been there all along, so it
        // is fully in view by 1.08.
        timeline.to(
          [motif, cover],
          { duration: 0.3, opacity: 0, ease: "power1.inOut" },
          0.78,
        );

        // 1.08 -- the authentic asset holds. The drift is the only thing left
        // moving, and it is small enough to register as presence rather than
        // as an animation still running.
        timeline.to(
          real,
          { duration: 0.45, scale: 1.012, ease: "sine.inOut" },
          1.08,
        );

        // 1.35 -- retire, and hand the wall to the idle screen (or, on an
        // unpaired panel, release the redirect to /pair).
        timeline.to(host, { duration: 0.4, opacity: 0, ease: "power2.in" }, 1.35);

        bail = window.setTimeout(() => {
          timeline.kill();
          // The artwork is already at full opacity; getting out of its way is
          // all that is needed.
          gsap.set([motif, cover, flash].filter(Boolean), { opacity: 0 });
          onDone();
        }, 2200);

        return () => window.clearTimeout(bail);
      });

      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      data-splash
      role="presentation"
      className="event-splash pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-stage"
    >
      <div
        aria-hidden
        data-splash-wash
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--color-expo-deep) 0%, transparent 62%)",
        }}
      />

      <div
        className="relative"
        /*
          Sized for a wall, not a browser tab. The plume occupies only the upper
          right of the pin's 628x419 box -- it is one part of the mark, not the
          whole of it -- so a box that looks generous in a preview leaves the
          animated motif looking like a detail floating in the dark. At 1920x1080
          this resolves to about 630px, which puts the plume itself near 260px:
          large enough to read as the event announcing itself from across a lobby.
        */
        style={{
          width: "clamp(260px, min(58vh, 46vw), 780px)",
          aspectRatio: `${ART.width} / ${ART.height}`,
        }}
      >
        {/* The authentic asset. `opacity: 1` is the markup default, so this is
            what a browser with no JavaScript shows. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-real
          src="/brand/drcc-event.png"
          alt="Díli Regional Cooperative Conference and Ministerial Dialogue 2026"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {/* The cover. `opacity: 0` in the markup, so without JavaScript it is
            not there and the artwork above simply shows. */}
        <div
          aria-hidden
          data-cover
          className="pointer-events-none absolute inset-0 bg-stage opacity-0"
        />

        {/* Also `opacity: 0` by default, for the same reason. */}
        <div data-motif className="absolute inset-0 opacity-0">
          <PlumeMotif className="h-full w-full" />
        </div>

        {/* Centred on the pivot, not on the box: the flash comes off the star. */}
        <div
          aria-hidden
          data-flash
          className="pointer-events-none absolute opacity-0"
          style={{
            left: `${(PIVOT.x / ART.width) * 100}%`,
            top: `${(PIVOT.y / ART.height) * 100}%`,
            width: "120%",
            height: "120%",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, #FCFCFC 0%, rgba(252,252,252,0.35) 32%, transparent 68%)",
          }}
        />
      </div>
    </div>
  );
}
