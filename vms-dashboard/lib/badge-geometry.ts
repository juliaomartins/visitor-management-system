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
 * the cropper's DEFAULT, not a guarantee about what is on disk. The cropper also
 * offers square and free crops, and exports at the selection's own ratio.
 *
 * BOTH CIRCLES COVER-CROP WHATEVER IS STORED, and must keep doing so:
 *
 *     badge-card.tsx    aspect-square rounded-full object-cover
 *     services.py       cover_box(*reader.getSize(), PHOTO_R * 2), clipped
 *
 * The PDF used to hardcode `draw_h = draw_w * 4 / 3` with
 * `preserveAspectRatio=False`, which printed every non-3:4 file stretched --
 * 12 of the 15 photos on file, the worst at 60% of true width. It reads the
 * image's real size now, so the print and this preview crop the same region
 * the same way for any stored shape, with nothing re-cropped.
 *
 * Two surfaces still draw the stored file as a 3:4 RECTANGLE and will show a
 * square crop letterboxed or stretched: the visitors list thumbnail (42 x 56)
 * and the registration receipt (24mm x 32mm). Known, and not yet fixed.
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
 * The cropper's default aspect ratio. Portrait, 3:4.
 *
 * Not the card's and not the circle's — see the note at the top — and not a
 * promise about stored files, which may be any ratio. This is the one
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

/**
 * THE QR, AND THE EVENT MARK SUNK INTO THE MIDDLE OF IT.
 *
 * Both numbers mirror `apps/badges/services.py`, which is the authority — the
 * preview exists to show what comes out of the printer, so a mark that is a
 * different size on screen than on paper makes the preview lie.
 *
 *     QR_ERROR_CORRECTION = ERROR_CORRECT_M
 *     QR_LOGO_FRACTION = 0.18
 *     QR_LOGO_PAD = 1.18
 *
 * THE LEVEL IS STILL M, AND THE LOGO IS WHY THAT IS WORTH A COMMENT. The
 * folklore is that a centre mark needs Q or H; here it needs neither, and
 * raising the level makes the badge measurably worse. The badge token is a fixed
 * 64 lowercase hex characters, so the level alone decides the grid — M gives 39
 * modules, Q 43, H 47 — and the card fixes the code at 14mm, so a bigger grid
 * buys redundancy with module size, which is the thing a phone at a door is
 * short of. Measured over 250 distinct tokens at 300dpi, at the capture size
 * where scanning starts to fail: M with this logo 250/250, Q with NO logo
 * 180/250. The full argument is beside `QR_ERROR_CORRECTION` in services.py.
 */
export const QR_ERROR_CORRECTION = "M" as const;

/**
 * The mark's longest side, as a share of the QR's full width including quiet zone.
 *
 * 0.18 is about 3.0mm on the printed card. 0.16, 0.18 and 0.20 all measured
 * identically to a bare code, so this is the middle of a flat shelf rather than
 * its edge — the simulation cannot model a particular dye-sub printer or the
 * decoder in a particular phone, and the conservative end costs nothing.
 */
export const QR_LOGO_FRACTION = 0.18;

/**
 * The white plate behind the mark, as a multiple of its longest side.
 *
 * The artwork is transparent around a thin gold ring. Without the plate the
 * modules behind that ring survive as fragments, and a decoder reads speckle it
 * has to guess at rather than a clean erasure it can simply repair.
 */
export const QR_LOGO_PAD = 1.18;

/** The plate's side as a share of the QR's width — what the preview lays out. */
export const QR_LOGO_PLATE_FRACTION = QR_LOGO_FRACTION * QR_LOGO_PAD;

/** The event mark, served by the dashboard. `services.py` keeps its own copy. */
export const QR_LOGO_SRC = "/brand/drcc-event.png";
