"""Badge PDF rendering. No models — this app reads from `visitors`.

    render_card_pdf(visitor, raw_token)          one 95 x 130 mm card
    render_card_set_pdf([(visitor, raw_token)])  the same card, one per page

Both need the RAW token, because the QR carries it and the database keeps only its
SHA-256 digest (CLAUDE.md constraint #3). Neither stores it, logs it, or returns
it — it becomes a QR image and is discarded with the request.

WHY REPORTLAB AND NOT WEASYPRINT
--------------------------------
WeasyPrint renders HTML/CSS, which was the nicer authoring story, but it reaches
Pango and Cairo through GTK — native libraries that are not present on a Windows
server and cannot be installed with pip. The result was a badge feature that
raised 503 on the machine actually running the event.

ReportLab is pure Python. It draws rather than lays out, so the geometry below is
explicit millimetres instead of CSS, and it works identically on every machine
this system will ever run on with no system-level install.

THE CARD IS THE ORGANISERS' OWN ARTWORK, MEASURED OFF THEIR PRODUCTION FILE
--------------------------------------------------------------------------
`ID CARD PVC SECOOP.pdf` in the repository root is the file the organisers had
80 PVC cards made from: 80 pages, one card per page, 95 x 130 mm, no sheet and
no cut marks. Every number in the geometry block below was read out of that
file's content stream rather than guessed off a screenshot — the header hem is
its cubic bezier, the bands are its rectangles, the colours are its own CMYK and
RGB — so this renderer produces the card the event already issues.

WHAT IS NOT IDENTICAL, AND WHY
------------------------------
**The typefaces.** The artwork is set in Araboto (Medium, Normal, Bold) and Open
Sans. Neither ships with ReportLab, neither is installable with pip, and shipping
a font file for a card is exactly the dependency that cost this app WeasyPrint.
So the card is set in Helvetica, which is built in, vector, and present on every
machine this will ever run on.

Helvetica is not Araboto, so the sizes here are NOT the artwork's point sizes —
they are the sizes at which Helvetica sets each fixed string to the artwork's
measured WIDTH. Matching width rather than height is deliberate: this layout is
width-constrained everywhere that matters (the title nearly fills the column
beside the mark, the role nearly fills the red band), and a block that is 6%
wider than the artwork's overflows where one that is 6% shorter merely looks a
shade lighter. The ratios came out between 0.92 and 1.05 of the artwork's sizes,
consistently, which is what a font substitution looks like when it is honest.

**The event mark.** The artwork's copy of the logo is squashed about 6%
horizontally — 53.79 x 56.18 pt around an emblem whose real proportion is 1.025
wide to tall. This draws `assets/drcc-event.png` undistorted, fitted inside that
same box and centred in it. Reproducing a client's logo at the wrong proportion
is not fidelity.
"""

import base64
import io
import logging
from functools import lru_cache
from pathlib import Path

import qrcode
from PIL import Image
from qrcode.constants import ERROR_CORRECT_M
from reportlab.lib.colors import CMYKColor, HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdf_canvas

from apps.visitors.models import Visitor, VisitorCategory
from apps.visitors.services import (
    issue_badge_token,
    log_visitor_action,
    rotate_badge_token,
)

audit = logging.getLogger("vms.audit")


class BadgeRenderingUnavailable(RuntimeError):
    """Kept so the view's 503 path still has something to catch.

    Nothing raises it today — ReportLab has no native dependency to be missing —
    but the endpoint contract still documents a 503, and a future renderer that
    can be unavailable should surface it the same way rather than 500.
    """


# --------------------------------------------------------------------------
# Card geometry. 95 x 130 mm PORTRAIT — the organisers' PVC card.
#
# THIS USED TO BE CR80, 54 x 85.6 mm, AND THE CHANGE IS NOT A PREFERENCE. The
# event's cards are already made, at 95 x 130, from the production file named in
# the module docstring. A CR80 card is a bank card; this one is the larger badge
# blank a lanyard holder takes, and every proportion of the artwork — the hem,
# the photograph, the two bands, the woven strip — is measured against it.
#
# Millimetres throughout, with the origin at the card's bottom-left. ReportLab
# counts upward from the bottom of the page, and every constant below is written
# in that direction so the code reads the same way it draws.
#
# Each constant carries the percentage of the card it came from, because that is
# how it was measured and how it should be re-checked. Divide by 0.95 for a
# percentage of the width, by 1.30 for a percentage of the height.
# --------------------------------------------------------------------------

CARD_W, CARD_H = 95.0, 130.0

# Shapes that run off the edge are drawn past it. The artwork's own white body
# stops 0.09 mm short on three sides — a Corel artefact that leaves a navy
# hairline down the trim — and reproducing that would be reproducing a fault.
BLEED = 1.0

# The artwork's own colours. Navy is CMYK because that is how the production
# file defines it, and a card house prints from the separation rather than from
# somebody's screen; the red and the black are RGB in the source too.
NAVY = CMYKColor(1.0, 0.8667, 0.1333, 0.549)
RED = HexColor("#ac1117")
INK = HexColor("#000000")
PAPER = HexColor("#ffffff")
PHOTO_EMPTY = HexColor("#e4e7ec")

# THE HEADER HEM IS A CUBIC, NOT A PARABOLA, and it is the artwork's own curve.
#
# `components/badge-card.tsx` fits it with a quadratic because SVG in a
# percentage box is what it had; this is the real thing, lifted from the
# production file's path operators and converted to millimetres. It leaves the
# left edge at 102.212 mm (21.4% down the card), swings through two control
# points and lands flat at 37.995 mm across (40.0% of the width) — not the
# 30.6% the preview assumes.
HEM_START_X = -0.093
HEM_START_Y = 102.212
HEM_C1 = (9.790, 96.045)
HEM_C2 = (16.075, 90.069)
HEM_END = (37.995, 91.244)
HEM_RIGHT_Y = 91.344
BODY_BOTTOM_Y = 20.274

# The event mark, top-left on the navy.
#
# THIS IS THE BOX OF THE ARTWORK'S INK, not of the image it placed there: the
# artwork's own copy has about 0.8 mm of transparent padding along its bottom,
# so measuring the placement rather than the emblem draws ours 4% small. The
# mark is fitted inside this box at its own proportion and centred — see the
# module docstring for why it is not stretched to fill it.
MARK_X, MARK_W = 5.415, 18.800
MARK_TOP, MARK_H = 8.125, 19.058

# Alpha below which `drcc-event.png` is treated as empty when trimming.
#
# NOT ZERO, AND THAT IS WORTH 8% OF THE MARK'S WIDTH. The file carries 32 px of
# all-but-invisible fringe down its right-hand edge — alpha above 0 but below 9
# — so `getbbox()` on the raw channel returns 411 x 401 where the visible emblem
# is 377 x 396. Trimming to the raw box therefore scales the mark to fit a
# third of an inch of nothing, and it renders visibly smaller than the artwork's
# with no clue why.
MARK_ALPHA_FLOOR = 8

# Conference name and theme, centred on 62.12% of the width — the axis of the
# column beside the mark, shared by all four lines.
HEADER_AXIS = 59.014
TITLE_BASELINE = 116.350
TITLE_LEADING = 4.485
THEME_BASELINE = 104.832
THEME_LEADING = 3.484
HEADER_MAX_W = 67.0

# The photograph: a 30 x 40 mm rounded rectangle with a heavy black keyline.
# Exactly 3:4, which is the ratio `lib/badge-geometry.ts` already crops to —
# but the stored file may be any shape, so it is covered, not stretched.
PHOTO_X, PHOTO_Y = 4.750, 39.533
PHOTO_W, PHOTO_H = 30.001, 40.014
PHOTO_RADIUS = 1.8
PHOTO_FRAME_W = 0.847

# Name and country, centred on the right-hand column. The name sits ON its
# baseline and wraps UPWARD into the white space above, so a long name moves
# toward the header rather than pushing the country down into the code.
COLUMN_AXIS = 66.310
COLUMN_MAX_W = 52.440
NAME_BASELINE = 75.712
NAME_LEADING_FACTOR = 1.1
NAME_RULE_Y = 75.010
NAME_RULE_H = 0.234
COUNTRY_BASELINE = 69.745

# The code. 27.5 mm against the old card's 14, which is the one part of this
# change that makes the badge easier to scan rather than merely correct: the
# grid is unchanged at 39 modules, so the module itself goes from 0.359 mm to
# 0.705 mm.
QR_X, QR_Y = 52.677, 39.208
QR_SIZE = 27.502

# The red role band and the navy address band under it. The navy is the card's
# own ground showing through, so only the red is painted.
ROLE_BAND_Y, ROLE_BAND_H = 19.383, 8.164
ROLE_BASELINE = 21.450
ROLE_MAX_W = 87.4
SITE_BASELINE = 15.145

# The woven tais at the foot. It stops 4.574 mm above the trim with navy below
# it — the artwork does not run it to the edge, and a strip stretched to the
# bottom is the single most visible way to get this card wrong.
TAIS_Y, TAIS_H = 4.574, 8.043

FONT_BOLD = "Helvetica-Bold"
FONT_BODY = "Helvetica"

# Sizes at which Helvetica sets the artwork's fixed strings to the artwork's
# measured widths — not the artwork's own point sizes. See the module docstring.
SIZE_TITLE = 9.86
SIZE_THEME = 10.91
SIZE_NAME = 13.8
SIZE_COUNTRY = 13.8
SIZE_ROLE = 15.13
SIZE_SITE = 12.56

# The lines that are the same on all 250 cards. They are the conference's, not
# ours, and they are not translated — see CLAUDE.md, "What is deliberately NOT
# translated": the preview exists to show what the printer produces, and a Tetun
# preview over an English card would make it lie.
TITLE_LINES = (
    "Díli Regional Cooperative Conference",
    "and Ministerial Dialogue 2026",
)
THEME_LINES = (
    "“Empowering Communities,",
    "Connecting Nations”",
)
WEBSITE = "www.cooptl.com"

# M RECOVERS ABOUT 15%, AND ADDING THE CENTRE LOGO DID NOT CHANGE THIS LINE.
#
# A badge picks up scuffs and lanyard creases, and this keeps the modules large
# enough to read across a doorway.
#
# THE LOGO DOES NOT NEED A STRONGER LEVEL, and believing it does makes the badge
# worse rather than safer. The folklore is that a centre mark wants Q or H. It
# does not want it here, because the level decides the GRID: the token is a
# fixed 64 lowercase hex characters, taken in byte mode, so
#
#     level   version   grid    module at 27.5mm
#     M         5        39       0.705 mm   <- unchanged
#     Q         6        43       0.640 mm
#     H         7        47       0.585 mm
#
# and a bigger grid buys redundancy with module size. Module size is what a
# phone at a door is short of. Measured over 250 distinct tokens rendered at
# 300dpi and degraded, at the capture size where a scan starts to fail:
#
#     M, no logo                  250/250    <- the card before this change
#     M, this logo                250/250    <- the card now
#     Q, NO logo                  180/250    <- the level alone, no mark at all
#     Q, this logo                138/250
#
# The mark costs nothing; the level would have cost most of the margin. The
# reason is arithmetic: at 0.18 with the pad below, the plate covers about 4.5%
# of the code's area, comfortably inside what M already rebuilds. Do not "harden"
# this to Q or H without re-running that measurement.
#
# That measurement was made at 14mm, on the CR80 card. The code is 27.5mm now,
# so every margin in it got wider rather than narrower — the conclusion is
# unchanged and the arithmetic is the same, because the GRID did not move.
QR_ERROR_CORRECTION = ERROR_CORRECT_M

# The event mark, sunk into the middle of the code.
#
# WHY THERE IS A COPY OF THE ARTWORK UNDER apps/badges/assets. The same file
# lives at vms-dashboard/public/brand/drcc-event.png, and reading it from there
# would couple the backend to a sibling package that a backend-only deploy does
# not check out.
#
# The fraction is of the QR's full width, quiet zone included. 0.18 puts the mark
# at about 5.0mm on the printed card. Measured against M with no logo at all,
# 0.16, 0.18 and 0.20 are indistinguishable -- all three decode 250/250 at every
# capture size where the bare code does, and dim light alone (contrast down to
# 0.40) and soft focus alone both cost nothing at any of those sizes.
#
# THERE IS ONE CONDITION WHERE THE MARK COSTS SOMETHING, and it is recorded here
# so nobody has to rediscover it: heavy blur AND low contrast AND a steep angle,
# all at once, took 50/250 down to 1/250. That regime is already failing 80% of
# the time without any logo -- the guard is re-scanning either way -- and no mark
# size recovers it (0.12 managed 15/250). It is a reason to keep the mark small,
# which it is, not a reason to remove it.
#
# 0.18 is the middle of the flat shelf rather than its edge, because the
# simulation cannot model your dye-sub printer or the particular decoder in a
# guard's phone, and the conservative end of a flat region costs nothing.
QR_LOGO_PATH = Path(__file__).resolve().parent / "assets" / "drcc-event.png"
QR_LOGO_FRACTION = 0.18

# The white pad behind the mark, as a multiple of its longest side. The artwork
# is transparent around a thin gold ring, and a scanner binarises whatever shows
# through -- so without a pad the modules behind the ring survive as fragments
# and read as noise rather than as a clean erasure. An erasure the decoder can
# see is cheaper to repair than speckle it has to guess at.
QR_LOGO_PAD = 1.18

# The woven band at the foot, cut from the production file at 600 dpi.
#
# IT IS A PHOTOGRAPH BECAUSE THE ARTWORK'S IS. The band is built in the source
# from a hundred and nine placed raster tiles, and a drawn approximation of a
# real textile reads as a pattern rather than as cloth. 2244 x 190 px is the
# band at exactly 95 x 8.043 mm, so it is drawn at 1:1 and never resampled.
TAIS_PATH = Path(__file__).resolve().parent / "assets" / "tais-strip.png"


@lru_cache(maxsize=1)
def _qr_logo() -> Image.Image:
    """The event mark, loaded once for the life of the process.

    A print run draws one of these per card and a full credential export draws
    250. Re-decoding the PNG per card is pure waste, and the cached image is
    never mutated -- every caller copies it before resizing.
    """
    with QR_LOGO_PATH.open("rb") as handle:
        return Image.open(io.BytesIO(handle.read())).convert("RGBA")


@lru_cache(maxsize=1)
def _card_mark() -> ImageReader:
    """The same mark, TRIMMED, for the card's header.

    `drcc-event.png` is 628 x 419 with the emblem occupying only x 134..511 —
    more than a third of the file is transparent padding. The QR wants the file
    as it is (its fraction is measured against the padded image and the plate
    behind it is what the decoder sees), but the card wants the emblem, so this
    is the one place that crops to the alpha channel — and it crops at
    `MARK_ALPHA_FLOOR` rather than at zero, for the reason recorded there.
    """
    image = _qr_logo()
    solid = image.getchannel("A").point(
        lambda value: 255 if value > MARK_ALPHA_FLOOR else 0
    )
    box = solid.getbbox()
    return ImageReader(image.crop(box) if box else image)


@lru_cache(maxsize=1)
def _tais() -> ImageReader:
    with TAIS_PATH.open("rb") as handle:
        return ImageReader(io.BytesIO(handle.read()))


def qr_image(raw_token: str):
    """A QR encoding the raw token STRING and nothing else, event mark in the middle.

    No JSON, no envelope, no id. The scanner posts back exactly what it reads, so
    anything wrapped around the token would have to be unwrapped by every reader
    that ever touches a badge.

    THE LOGO DOES NOT CHANGE THE PAYLOAD. It is composited over the finished
    code, so the string a scanner reads is byte-identical to the one this
    function has always produced. No badge already printed stops working, and
    there is nothing stored anywhere to migrate: every QR in this system is
    rendered on demand from the derived token, so the mark appears on all of
    them the next time they are drawn.
    """
    code = qrcode.QRCode(error_correction=QR_ERROR_CORRECTION, box_size=10, border=1)
    code.add_data(raw_token)
    code.make(fit=True)
    image = code.make_image(fill_color="black", back_color="white").convert("RGB")

    side = round(image.width * QR_LOGO_FRACTION)
    if side < 8:
        # Too small to be anything but a smudge over live modules. A caller
        # rendering a thumbnail gets a clean code rather than a damaged one.
        return image

    mark = _qr_logo().copy()
    mark.thumbnail((side, side), Image.LANCZOS)

    pad = round(side * QR_LOGO_PAD)
    plate = Image.new("RGB", (pad, pad), "white")
    plate.paste(mark, ((pad - mark.width) // 2, (pad - mark.height) // 2), mark)
    image.paste(plate, ((image.width - pad) // 2, (image.height - pad) // 2))
    return image


def qr_data_uri(raw_token: str) -> str:
    """PNG data URI of the same QR. Used by tests and any HTML preview."""
    buffer = io.BytesIO()
    qr_image(raw_token).save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"


def photo_reader(visitor: Visitor):
    """The visitor's photo as something ReportLab can draw, or None.

    A missing file is not a reason to fail a print run — the card still carries the
    name, the country and a working QR, and a badge with a grey box beats no badge
    at the registration desk.
    """
    try:
        with visitor.photo.open("rb") as handle:
            return ImageReader(io.BytesIO(handle.read()))
    except (ValueError, FileNotFoundError, OSError):
        return None


def cover_box(image_width: float, image_height: float, box_w: float, box_h: float):
    """The smallest box of the image's OWN aspect that covers `box_w` x `box_h`.

    This is `object-fit: cover` in millimetres, and it is the reason the printed
    photo matches the one on screen. `components/badge-card.tsx` draws the photo
    with `object-cover` in a fixed rectangle, so the browser scales the file
    until it covers that rectangle and crops the overflow. The PDF used to
    hardcode `draw_h = draw_w * 4 / 3` with `preserveAspectRatio=False`, i.e. it
    asserted every stored file was 3:4 and stretched whatever it got to fit that
    claim.

    **THAT ASSERTION WAS FALSE FOR MOST OF THE ROSTER.** `PhotoCropper.tsx`
    offers badge, square and free crops, and exports at the selection's own
    ratio — so square and free crops land on disk as square-ish files. Measured
    over the 15 photos actually stored in `media/visitors`, only 3 were 3:4;
    the other 12 printed squeezed horizontally, the worst (600x479) at 60% of
    true width.

    Reading the real size removes the assumption instead of restating it, so
    every crop mode prints faithfully with nothing re-cropped and no migration.

    A non-positive or unreadable size falls back to the box itself. That crops a
    portrait a little tighter than cover would, and is the one outcome here that
    cannot distort a face.
    """
    if not image_width or not image_height or image_width <= 0 or image_height <= 0:
        return box_w, box_h

    # Cover means the scale that satisfies BOTH edges, so one side overflows and
    # the clip takes it. Getting this to `min` produces a box that fits inside
    # the frame, leaving the ground showing through in two bands.
    scale = max(box_w / image_width, box_h / image_height)
    return image_width * scale, image_height * scale


def _fit_size(text: str, font: str, size: float, max_width_mm: float) -> float:
    """The largest size at or below `size` at which `text` fits on one line.

    Truncating somebody's country on their own badge is worse than setting it a
    quarter-point smaller, and an ellipsis on a printed card looks like a fault.
    """
    limit = max_width_mm * mm
    width = stringWidth(text, font, size)
    if width <= limit or width <= 0:
        return size
    return max(6.0, size * limit / width)


def _fit_lines(text: str, font: str, size: float, max_width_mm: float, max_lines: int):
    """Wrap `text` to at most `max_lines`, shrinking the font until it fits.

    A long name must not run under the QR, and truncating someone's name on their
    own badge is worse than setting it a point smaller.
    """
    limit = max_width_mm * mm

    while size >= 6.0:
        words, lines, current = text.split(), [], ""

        for word in words:
            candidate = f"{current} {word}".strip()
            if stringWidth(candidate, font, size) <= limit or not current:
                current = candidate
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)

        if len(lines) <= max_lines and all(
            stringWidth(line, font, size) <= limit for line in lines
        ):
            return lines, size

        size -= 0.25

    return [text], size


def _draw_body(canvas, x: float, y: float) -> None:
    """The navy field, and the white body under its curved hem."""
    canvas.setFillColor(NAVY)
    canvas.rect(
        (x - BLEED) * mm,
        (y - BLEED) * mm,
        (CARD_W + 2 * BLEED) * mm,
        (CARD_H + 2 * BLEED) * mm,
        stroke=0,
        fill=1,
    )

    # The curve starts at its own measured point, NOT at the bleed. Sliding the
    # start 1 mm left and redrawing the same cubic from there drops the hem half
    # a millimetre at the card's left edge, because the first control point is
    # unchanged and the segment has to reach further to get to it.
    path = canvas.beginPath()
    path.moveTo((x + HEM_START_X) * mm, (y + HEM_START_Y) * mm)
    path.curveTo(
        (x + HEM_C1[0]) * mm,
        (y + HEM_C1[1]) * mm,
        (x + HEM_C2[0]) * mm,
        (y + HEM_C2[1]) * mm,
        (x + HEM_END[0]) * mm,
        (y + HEM_END[1]) * mm,
    )
    path.lineTo((x + CARD_W + BLEED) * mm, (y + HEM_RIGHT_Y) * mm)
    path.lineTo((x + CARD_W + BLEED) * mm, (y + BODY_BOTTOM_Y) * mm)
    path.lineTo((x - BLEED) * mm, (y + BODY_BOTTOM_Y) * mm)
    # Back up the bled left edge to the curve's own start. The 0.09 mm step
    # across the top of that segment is off the trim, where nothing sees it.
    path.lineTo((x - BLEED) * mm, (y + HEM_START_Y) * mm)
    path.close()

    canvas.setFillColor(PAPER)
    canvas.drawPath(path, stroke=0, fill=1)


def _draw_header(canvas, x: float, y: float) -> None:
    """The mark, the conference name and the theme, on the navy."""
    reader = _card_mark()
    image_w, image_h = reader.getSize()
    # Fit inside the artwork's box at the emblem's own proportion, centred. The
    # artwork squashes it; we do not.
    scale = min(MARK_W / image_w, MARK_H / image_h)
    draw_w, draw_h = image_w * scale, image_h * scale
    canvas.drawImage(
        reader,
        (x + MARK_X + (MARK_W - draw_w) / 2) * mm,
        (y + CARD_H - MARK_TOP - MARK_H + (MARK_H - draw_h) / 2) * mm,
        draw_w * mm,
        draw_h * mm,
        preserveAspectRatio=True,
        mask="auto",
    )

    canvas.setFillColor(PAPER)
    axis = (x + HEADER_AXIS) * mm

    size = min(
        _fit_size(line, FONT_BOLD, SIZE_TITLE, HEADER_MAX_W) for line in TITLE_LINES
    )
    canvas.setFont(FONT_BOLD, size)
    for index, line in enumerate(TITLE_LINES):
        canvas.drawCentredString(
            axis, (y + TITLE_BASELINE - index * TITLE_LEADING) * mm, line
        )

    size = min(
        _fit_size(line, FONT_BODY, SIZE_THEME, HEADER_MAX_W) for line in THEME_LINES
    )
    canvas.setFont(FONT_BODY, size)
    for index, line in enumerate(THEME_LINES):
        canvas.drawCentredString(
            axis, (y + THEME_BASELINE - index * THEME_LEADING) * mm, line
        )


def _draw_photo(canvas, visitor: Visitor, x: float, y: float) -> None:
    """The photograph in its rounded frame, cover-cropped to the artwork's box."""
    left, bottom = x + PHOTO_X, y + PHOTO_Y
    reader = photo_reader(visitor)

    canvas.saveState()
    clip = canvas.beginPath()
    clip.roundRect(
        left * mm, bottom * mm, PHOTO_W * mm, PHOTO_H * mm, PHOTO_RADIUS * mm
    )
    canvas.clipPath(clip, stroke=0, fill=0)

    if reader is not None:
        # Cover the frame at the image's own aspect and let the clip take the
        # overflow — `object-fit: cover`, which is what the preview does. See
        # `cover_box`: the ratio is READ from the file, never assumed.
        draw_w, draw_h = cover_box(*reader.getSize(), PHOTO_W, PHOTO_H)
        canvas.drawImage(
            reader,
            (left + (PHOTO_W - draw_w) / 2) * mm,
            (bottom + (PHOTO_H - draw_h) / 2) * mm,
            draw_w * mm,
            draw_h * mm,
            # The box already carries the image's ratio, so this preserves
            # rather than changes anything today. It is `True` deliberately:
            # if `cover_box` is ever wrong, letterboxing shows up inside the
            # frame where somebody will see it, and `False` would go on
            # silently stretching faces instead.
            preserveAspectRatio=True,
            mask="auto",
        )
    else:
        canvas.setFillColor(PHOTO_EMPTY)
        canvas.rect(left * mm, bottom * mm, PHOTO_W * mm, PHOTO_H * mm, stroke=0, fill=1)

    canvas.restoreState()

    canvas.setStrokeColor(INK)
    canvas.setLineWidth(PHOTO_FRAME_W * mm)
    canvas.roundRect(
        left * mm,
        bottom * mm,
        PHOTO_W * mm,
        PHOTO_H * mm,
        PHOTO_RADIUS * mm,
        stroke=1,
        fill=0,
    )


def _draw_identity(canvas, visitor: Visitor, x: float, y: float) -> None:
    """Name over country, centred on the right-hand column.

    The name is set AS ENTERED. The artwork sets it that way — "Abencia da Cruz",
    not "ABENCIA DA CRUZ" — and a card is the one place a person's own spelling
    of their own name should survive. The country is uppercase, as the artwork
    has it, and because it is a label rather than a name.
    """
    axis = x + COLUMN_AXIS
    canvas.setFillColor(INK)

    lines, size = _fit_lines(
        visitor.full_name, FONT_BOLD, SIZE_NAME, COLUMN_MAX_W, max_lines=2
    )
    leading = size * NAME_LEADING_FACTOR / mm

    canvas.setFont(FONT_BOLD, size)
    for index, line in enumerate(reversed(lines)):
        step = index * leading
        canvas.drawCentredString(axis * mm, (y + NAME_BASELINE + step) * mm, line)
        # The rule is a drawn rectangle rather than the font's own underline,
        # because the artwork's is one: a fixed 0.70 mm below the baseline,
        # 0.23 mm thick, the width of that line and no wider.
        width = stringWidth(line, FONT_BOLD, size) / mm
        canvas.rect(
            (axis - width / 2) * mm,
            (y + NAME_RULE_Y + step) * mm,
            width * mm,
            NAME_RULE_H * mm,
            stroke=0,
            fill=1,
        )

    country = (visitor.country or "").upper()
    if country:
        canvas.setFont(
            FONT_BOLD, _fit_size(country, FONT_BOLD, SIZE_COUNTRY, COLUMN_MAX_W)
        )
        canvas.drawCentredString(axis * mm, (y + COUNTRY_BASELINE) * mm, country)


def _draw_foot(canvas, visitor: Visitor, x: float, y: float) -> None:
    """The red role band, the address on the navy, and the tais."""
    vip = visitor.category == VisitorCategory.VIP
    # The artwork's band carries the bearer's role. Ours is the one the rest of
    # the app already uses, so a VIP still reads as a VIP -- there is no second
    # colour for it, because the artwork has none and inventing one would make
    # the printed card stop matching the cards already in circulation.
    role = "VIP GUEST" if vip else (visitor.organization or "VISITOR")

    canvas.setFillColor(RED)
    canvas.rect(
        (x - BLEED) * mm,
        (y + ROLE_BAND_Y) * mm,
        (CARD_W + 2 * BLEED) * mm,
        ROLE_BAND_H * mm,
        stroke=0,
        fill=1,
    )

    canvas.setFillColor(PAPER)
    role = role.upper()
    canvas.setFont(FONT_BOLD, _fit_size(role, FONT_BOLD, SIZE_ROLE, ROLE_MAX_W))
    canvas.drawCentredString(
        (x + CARD_W / 2) * mm, (y + ROLE_BASELINE) * mm, role
    )

    canvas.setFont(FONT_BODY, SIZE_SITE)
    canvas.drawCentredString((x + CARD_W / 2) * mm, (y + SITE_BASELINE) * mm, WEBSITE)

    canvas.drawImage(
        _tais(),
        x * mm,
        (y + TAIS_Y) * mm,
        CARD_W * mm,
        TAIS_H * mm,
        # The strip is cut at exactly this size, so nothing is being stretched;
        # `False` is here because the band must span the full trim whatever the
        # asset is replaced with, and a letterboxed tais leaves navy at the side.
        preserveAspectRatio=False,
    )


def draw_card(canvas, visitor: Visitor, raw_token: str, x: float, y: float) -> None:
    """Draw one badge with its bottom-left corner at (x, y), in millimetres.

    Every field on the card is real: the name, the country, the organisation in
    the red band, and a QR carrying the raw token. Nothing here is a placeholder,
    because a badge with a placeholder on it is a badge that gets handed to
    somebody.
    """
    _draw_body(canvas, x, y)
    _draw_header(canvas, x, y)
    _draw_photo(canvas, visitor, x, y)
    _draw_identity(canvas, visitor, x, y)

    canvas.drawImage(
        ImageReader(qr_image(raw_token)),
        (x + QR_X) * mm,
        (y + QR_Y) * mm,
        QR_SIZE * mm,
        QR_SIZE * mm,
        preserveAspectRatio=True,
    )

    _draw_foot(canvas, visitor, x, y)


def render_card_pdf(visitor: Visitor, raw_token: str) -> bytes:
    """One badge, one 95 x 130 mm page — the size the PVC cards are cut to."""
    buffer = io.BytesIO()
    canvas = pdf_canvas.Canvas(buffer, pagesize=(CARD_W * mm, CARD_H * mm))
    canvas.setTitle(f"Badge {visitor.badge_serial}")

    draw_card(canvas, visitor, raw_token, 0, 0)

    canvas.showPage()
    canvas.save()
    return buffer.getvalue()


def render_card_set_pdf(issued: list[tuple[Visitor, str]]) -> bytes:
    """Every badge in the run, ONE CARD PER PAGE, at 95 x 130 mm.

    THIS USED TO BE AN A4 SHEET OF NINE, WITH CUT MARKS. It is not one any more,
    because the cards are not cut out of paper: `ID CARD PVC SECOOP.pdf`, the
    file the organisers had their 80 cards made from, is 80 pages of one card
    each at exactly this size, which is what a card printer takes and what a
    print shop quotes against. A sheet of nine also stopped fitting — three
    across at 95 mm is 285 mm on a 210 mm page.

    A run of one is therefore not a special case any more; it is the same
    document with one page. `render_card_pdf` stays because a single badge has
    its own endpoint and its own title.
    """
    if len(issued) == 1:
        visitor, raw_token = issued[0]
        return render_card_pdf(visitor, raw_token)

    buffer = io.BytesIO()
    canvas = pdf_canvas.Canvas(buffer, pagesize=(CARD_W * mm, CARD_H * mm))
    canvas.setTitle(f"Badges ({len(issued)})")

    for visitor, raw_token in issued:
        draw_card(canvas, visitor, raw_token, 0, 0)
        canvas.showPage()

    canvas.save()
    return buffer.getvalue()


def collect_badge_tokens(visitors, *, actor=None) -> list[tuple[Visitor, str]]:
    """Return (visitor, RAW token) for each visitor. Printing is now harmless.

    THIS USED TO BE `reissue_badges`, AND IT USED TO BE DESTRUCTIVE. Tokens were
    random and unrecoverable, so the only way to put a QR on a sheet was to mint
    a new one -- which silently killed every card previously printed for those
    visitors. Reprinting a badge was impossible and printing a second sheet was a
    quiet revocation of the first.

    Tokens are derived now, so this recomputes what is already on the card. Print
    the same visitor ten times and every page carries the same working QR.

    Rotating a badge is `rotate_badge_tokens` below, and it has to be asked for.
    """
    issued: list[tuple[Visitor, str]] = []

    for visitor in visitors:
        issued.append((visitor, issue_badge_token(visitor)))

    return issued


def rotate_badge_tokens(visitors, *, actor=None) -> list[tuple[Visitor, str]]:
    """Give each visitor a NEW QR and stop their old card. Genuinely destructive.

    For a badge that has been lost or copied. Every card previously printed for
    these visitors stops scanning as `valid` from the next scan onward; nobody
    else's badge is affected.

    It does NOT set `is_active = False`. That would kill the replacement card
    along with the lost one.
    """
    issued: list[tuple[Visitor, str]] = []

    for visitor in visitors:
        issued.append((visitor, rotate_badge_token(visitor, actor=actor)))

    return issued
