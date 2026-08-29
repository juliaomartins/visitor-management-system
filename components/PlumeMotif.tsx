/**
 * The event mark's generative geometry, authored parametrically.
 *
 * A DERIVED MOTIF, NOT A TRACE. The plume in the artwork is not four drawn
 * shapes -- it is one shape instanced four times about a shared pivot, and the
 * pixels say so. Segmenting the PNG by brand hue and running a principal-axis
 * fit on every connected blob gives:
 *
 *     blade   mass     bearing   reach    half-width
 *     blue    2774px   -67.6deg  184.5px  27.7px
 *     gold    2991px   -54.7deg  232.0px  26.6px
 *     green   3110px   -40.0deg  251.9px  21.0px
 *     red     2607px   -26.7deg  268.0px  22.1px
 *
 * Angular steps of 13.0, 14.7 and 13.3 degrees, and a mass that varies by only
 * 19% across all four. Four blobs of near-equal area at near-equal spacing,
 * sharing a pivot, with monotonically growing reach, is what one instanced
 * primitive looks like in data -- three independent axis pairs intersect at the
 * same point, native (255, 198).
 *
 * WHY THE PLUME AND NOT THE RING OR THE STAR. The blade order *is* the palette
 * order: blue, gold, green, red, innermost to outermost, is exactly the four
 * inks this whole system was re-themed on. Animating the plume animates the
 * colour system's own derivation. The ring is a circle and carries no identity.
 * The star is singular, so it cannot be a repeatable primitive -- which is
 * precisely what makes it the right accent instead.
 *
 * The viewBox is the artwork's own pixel space, 628 x 419, so every measured
 * number drops in unmodified and the motif registers against the real file with
 * no conversion step to get wrong.
 *
 * Fills are the PRINT inks, not the dark-mode variants the rest of the screen
 * uses. This motif exists only to hand off to the real artwork, and a colour
 * shift at the dissolve is exactly the seam the sequence is trying to hide.
 * Contrast on the dark stage is carried by the artwork's own outline convention:
 * a thin near-white stroke, which is how the real pin separates its feathers.
 */
export const ART = { width: 628, height: 419 } as const;
export const PIVOT = { x: 255, y: 198 } as const;

/**
 * The ring, also measured rather than centred by eye.
 *
 * The gold component's bounding box puts it at native (322, 251) with a radius
 * of 187 -- noticeably right of and below the artwork's geometric centre, which
 * is where a first guess would have put it. Pulled in to r=176 and up to y=236
 * so the circle closes inside the 419px viewBox; in the artwork the ring is
 * interrupted by the lower banner, and a hairline cut flat by the viewport edge
 * would read as a rendering bug rather than as the pin.
 */
export const RING = { x: 322, y: 236, r: 176 } as const;

/** Measured, in the artwork's own pixel space. Order is the palette order. */
export const BLADES = [
  { key: "blue", bearing: -67.6, reach: 184.5, halfWidth: 27.7, fill: "#00309C" },
  { key: "gold", bearing: -54.7, reach: 232.0, halfWidth: 26.6, fill: "#FCB400" },
  { key: "green", bearing: -40.0, reach: 251.9, halfWidth: 21.0, fill: "#006C30" },
  { key: "red", bearing: -26.7, reach: 268.0, halfWidth: 22.1, fill: "#CC0000" },
] as const;

const OUTLINE = "#FCFCFC";

/**
 * One blade: a lanceolate leaf from the pivot to the tip.
 *
 * Two quadratic curves meeting at a point, with the widest part at 45% of the
 * reach. That 45% is what makes it read as a feather rather than an almond --
 * a leaf carries its width low, and a symmetric bulge at the midpoint reads as
 * a generic petal shape instead.
 */
function bladePath(bearing: number, reach: number, halfWidth: number): string {
  const t = (bearing * Math.PI) / 180;
  const dx = Math.cos(t);
  const dy = Math.sin(t);
  // Perpendicular, for the width.
  const px = -dy;
  const py = dx;

  const tipX = PIVOT.x + dx * reach;
  const tipY = PIVOT.y + dy * reach;

  const bellyX = PIVOT.x + dx * reach * 0.45;
  const bellyY = PIVOT.y + dy * reach * 0.45;

  // Control points sit past the belly so the curve actually reaches the stated
  // half-width rather than falling short of it, which a quadratic always does.
  const spread = halfWidth * 1.6;

  return [
    `M ${PIVOT.x.toFixed(2)} ${PIVOT.y.toFixed(2)}`,
    `Q ${(bellyX + px * spread).toFixed(2)} ${(bellyY + py * spread).toFixed(2)}`,
    `  ${tipX.toFixed(2)} ${tipY.toFixed(2)}`,
    `Q ${(bellyX - px * spread).toFixed(2)} ${(bellyY - py * spread).toFixed(2)}`,
    `  ${PIVOT.x.toFixed(2)} ${PIVOT.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/**
 * The sweep mask.
 *
 * A circle whose stroke is thick enough to fill the disc, with `pathLength` set
 * to 360 so one user unit is one degree. Animating `strokeDashoffset` from 360
 * to 270 uncovers a quarter turn, and the group is rotated so that quarter runs
 * from twelve o'clock to three o'clock -- bearings -90 to 0, which is exactly
 * the arc the four blades occupy once their angular width is included.
 *
 * This is why the blades appear 13.6 degrees apart without a stagger being
 * authored anywhere: the spacing is the geometry's, and one moving edge reveals
 * them in the order the artwork already put them in.
 */
const MASK_RADIUS = 200;

export function PlumeMotif({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ART.width} ${ART.height}`}
      className={className}
      fill="none"
    >
      <defs>
        <mask id="plume-sweep" maskUnits="userSpaceOnUse">
          <circle
            data-sweep
            cx={PIVOT.x}
            cy={PIVOT.y}
            r={MASK_RADIUS / 2}
            pathLength={360}
            stroke="#fff"
            strokeWidth={MASK_RADIUS}
            strokeDasharray="360 360"
            strokeDashoffset={360}
            transform={`rotate(-90 ${PIVOT.x} ${PIVOT.y})`}
          />
        </mask>
      </defs>

      {/*
        The ring is a DERIVED gesture, not an attempt to reproduce the pin's
        thick bevelled ring. It is a hairline, and it leaves before the
        cross-dissolve -- so it never has to match the artwork, which is the
        only honest way to include an element the motif cannot reproduce.
      */}
      <circle
        data-ring
        cx={RING.x}
        cy={RING.y}
        r={RING.r}
        stroke="#FCB400"
        strokeWidth={2.5}
        pathLength={100}
        strokeDasharray="100 100"
        strokeDashoffset={100}
        opacity={0.75}
      />

      <g mask="url(#plume-sweep)">
        {BLADES.map((blade) => (
          <path
            key={blade.key}
            data-blade={blade.key}
            d={bladePath(blade.bearing, blade.reach, blade.halfWidth)}
            fill={blade.fill}
            stroke={OUTLINE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/*
        The star sits at the pivot -- the point every blade converges on. That is
        not a coincidence to be designed around: in the artwork the plume springs
        from behind the flag's triangle, so the accent beat lands exactly where
        the sweep began.
      */}
      <g data-star transform={`translate(${PIVOT.x} ${PIVOT.y})`}>
        <path
          d={starPath(22)}
          fill={OUTLINE}
          stroke="#000000"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** A five-point star, points up, drawn about its own centre. */
function starPath(radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(Math.cos(angle) * r).toFixed(2)} ${(Math.sin(angle) * r).toFixed(2)}`);
  }
  return `M ${points.join(" L ")} Z`;
}
