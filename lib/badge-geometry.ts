/**
 * Badge geometry, derived once from the printer's millimetres.
 *
 * `apps/badges/services.py` is the authority: it draws the actual card with
 * ReportLab in millimetres, and anything on screen is a mirror of it. Every
 * number below is computed from the same constants that file uses, so the
 * preview, the cropper and the PDF cannot drift apart the way they do when a
 * ratio gets typed into two components.
 *
 * THE PRINTED PHOTO IS A CIRCLE, WHICH IS THE THING PEOPLE GET WRONG.
 *
 *     PHOTO_CX, PHOTO_CY, PHOTO_R = CARD_W / 2, 60.6, 9.5
 *     PHOTO_RING = 1.1
 *     clip.circle(cx * mm, cy * mm, PHOTO_R * mm)
 *
 * So the badge photo box has no portrait ratio to inherit -- its bounding box is
 * square. The 3:4 below is NOT derived from it and does not pretend to be: it is
 * the storage format, and it is fixed by three consumers that render the stored
 * file as a rectangle rather than a circle:
 *
 *     visitors list thumbnail   42 x 56          3:4
 *     registration receipt      24mm x 32mm      3:4
 *     badge PDF                 draw_h = draw_w * 4 / 3, preserveAspectRatio=False
 *
 * That last one is why the format cannot simply be changed to square. The PDF
 * hardcodes the 4/3 assumption and disables aspect preservation, so a square
 * source would print every face stretched by a third. Moving to square storage
 * means teaching the PDF to read the image's real dimensions first, then
 * re-cropping the photos already on file.
 */

/** From `services.py`: CARD_W, CARD_H = 54.0, 85.6 */
const CARD_W_MM = 54.0;

/** From `services.py`: PHOTO_R = 9.5, PHOTO_RING = 1.1 */
const PHOTO_R_MM = 9.5;
const PHOTO_RING_MM = 1.1;

/** The visible photo on the printed card, as a diameter. */
export const PHOTO_CIRCLE_MM = PHOTO_R_MM * 2;

/** Photo plus its ring — the box the card lays out. */
export const PHOTO_BOX_MM = (PHOTO_R_MM + PHOTO_RING_MM) * 2;

/**
 * The photo box as a share of the card's width, for `cqw` in the preview.
 *
 * The card preview is a container-query box one card wide, so a percentage of
 * `CARD_W` is a `cqw` directly. 21.2 / 54.0 = 39.26.
 */
export const PHOTO_BOX_CQW = (PHOTO_BOX_MM / CARD_W_MM) * 100;

/**
 * The stored photo's aspect ratio. Portrait, 3:4.
 *
 * Not the card's and not the circle's — see the note at the top. This is the one
 * definition; the cropper and the preview both import it.
 */
export const PHOTO_ASPECT = 3 / 4;

/** Canonical stored size. 3:4, and large enough for the circle at 300dpi. */
export const OUTPUT_WIDTH = 600;
export const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / PHOTO_ASPECT);

/**
 * The smallest crop that still prints cleanly.
 *
 * The circle is inscribed in the centre square of the 3:4 frame, so the frame's
 * WIDTH is what limits print resolution: 19mm at 300dpi is 225px. A crop
 * narrower than that in source pixels cannot be printed sharply no matter what
 * it is scaled up to, which is what the cropper warns about rather than silently
 * upscaling.
 */
const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;

export const MIN_OUTPUT_WIDTH = Math.ceil(
  (PHOTO_CIRCLE_MM / MM_PER_INCH) * PRINT_DPI,
);
export const MIN_OUTPUT_HEIGHT = Math.round(MIN_OUTPUT_WIDTH / PHOTO_ASPECT);

/**
 * Where the circle sits inside the stored 3:4 frame, as fractions of it.
 *
 * `object-cover` in a `rounded-full` box keeps the centre square and then
 * inscribes a circle in it. The cropper draws exactly this so the registrar can
 * see what survives: anything outside is discarded by the card and by the wall.
 */
export const VISIBLE_CIRCLE = {
  cx: 0.5,
  cy: 0.5,
  /** Radius as a fraction of the frame's WIDTH — the centre square's half-width. */
  r: 0.5,
} as const;
