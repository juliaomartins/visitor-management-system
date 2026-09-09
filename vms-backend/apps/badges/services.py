"""Badge PDF rendering. No models — this app reads from `visitors`.

    render_card_pdf(visitor, raw_token)          one CR80 card
    render_a4_sheet_pdf([(visitor, raw_token)])  ten to an A4 sheet, with cut marks

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

Fonts are ReportLab's built-in Type 1 faces: Helvetica for names, Courier for the
serial. They are vector, embedded-by-reference, and always present — no font file
to ship and nothing to go missing on a different OS. The dashboard's screen badge
uses Archivo and IBM Plex Mono; the printed card is close but not identical, which
is the price of never depending on a font file being installed.

Geometry matches the dashboard's browser-printed badge exactly, so a card cut from
this PDF and one printed from the receipt sit on the same lanyard looking the same.
"""

import base64
import io
import logging

import qrcode
from qrcode.constants import ERROR_CORRECT_M
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdf_canvas

from django.utils import timezone

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
# Card geometry. CR80 PORTRAIT — 54 x 85.6 mm, a bank card stood on its end.
#
# Portrait because that is how a badge hangs. A lanyard holds a card by a slot in
# its short edge, so a landscape card either swings sideways all day or needs a
# second punch; every conference badge in the world is portrait for this reason.
# The size is unchanged — this is the same CR80 blank, rotated — so it still fits
# a standard holder and a standard card printer.
#
# Millimetres throughout, with the origin at the card's bottom-left. ReportLab
# counts upward from the bottom of the page, and every constant below is written
# in that direction so the code reads the same way it draws.
# --------------------------------------------------------------------------

CARD_W, CARD_H = 54.0, 85.6

# The lanyard slot. Drawn as a hairline outline: this is a punch guide, not ink,
# and a printer or a hand punch needs to see where it goes.
SLOT_W, SLOT_H = 12.0, 2.4
SLOT_X = (CARD_W - SLOT_W) / 2
SLOT_Y = 80.2

# Decoration bands, top and bottom, left and right of the middle.
DECO_TOP_Y = 72.4
DECO_BOTTOM_Y = 4.5
DECO_LEFT_X = 3.0
DECO_RIGHT_X = 40.0

# The portrait photo, cropped to a circle — the reference's strongest move, and
# it survives a bad crop better than a rectangle does.
PHOTO_CX, PHOTO_CY, PHOTO_R = CARD_W / 2, 60.6, 9.5
PHOTO_RING = 1.1

# Text block, bottom-anchored so a two-line name grows upward into the gap under
# the photo instead of pushing the fields off the card.
TEXT_LEFT, TEXT_RIGHT = 4.0, CARD_W - 4.0
NAME_BASELINE = 42.0
NAME_LEADING = 4.4
ROLE_BASELINE = 37.2
RULE_Y = 33.4
FIELD_1_BASELINE = 29.6
FIELD_2_BASELINE = 25.8
SERIAL_BASELINE = 20.8

# QR, centred at the foot between the two bottom motif clusters. 14 mm still
# scans across a doorway at error-correction M.
QR_SIZE = 14.0
QR_X = (CARD_W - QR_SIZE) / 2
QR_Y = 4.5

# Label column for the two data rows, so the values line up in a column.
LABEL_X = 7.0
VALUE_X = 22.0

INK = HexColor("#101828")
MUTED = HexColor("#5a6472")
RULE = HexColor("#d7dce3")
NAVY = HexColor("#16276b")
ROLE_PINK = HexColor("#ec1e79")
BAND_VIP = HexColor("#b8860b")
PHOTO_EMPTY = HexColor("#dfe3ea")

# The motif palette, lifted from the reference: flat, saturated, no gradients.
M_BLUE = HexColor("#2743c4")
M_SKY = HexColor("#4d8ff5")
M_YELLOW = HexColor("#ffc531")
M_ORANGE = HexColor("#f5821f")
M_MAGENTA = HexColor("#ec1e79")
M_PURPLE = HexColor("#7b4dd8")
M_RED = HexColor("#e8442c")

SIZE_NAME = 11.0
SIZE_ROLE = 7.6
SIZE_LABEL = 6.4
SIZE_VALUE = 6.8
SIZE_SERIAL = 8.6

FONT_BOLD = "Helvetica-Bold"
FONT_BODY = "Helvetica"
FONT_ITALIC = "Helvetica-Oblique"
FONT_MONO = "Courier-Bold"

# 3 x 3 portrait cards to an A4 sheet: 3*54 = 162 wide, 3*85.6 = 256.8 tall, both
# inside 210 x 297 with room for the cut marks in the margin.
CARDS_PER_SHEET = 9
SHEET_COLS, SHEET_ROWS = 3, 3

A4_W, A4_H = 210.0, 297.0
SHEET_MARGIN_X = (A4_W - SHEET_COLS * CARD_W) / 2
SHEET_MARGIN_Y = (A4_H - SHEET_ROWS * CARD_H) / 2

CUT_MARK_LEN = 3.0
CUT_MARK_GAP = 1.0
CUT_MARK_WEIGHT = 0.2

# M recovers about 15%. A badge picks up scuffs and lanyard creases, and this keeps
# the modules large enough to read across a doorway at 14mm.
QR_ERROR_CORRECTION = ERROR_CORRECT_M


def qr_image(raw_token: str):
    """A QR encoding the raw token STRING and nothing else.

    No JSON, no envelope, no id. The scanner posts back exactly what it reads, so
    anything wrapped around the token would have to be unwrapped by every reader
    that ever touches a badge.
    """
    code = qrcode.QRCode(error_correction=QR_ERROR_CORRECTION, box_size=10, border=1)
    code.add_data(raw_token)
    code.make(fit=True)
    return code.make_image(fill_color="black", back_color="white").convert("RGB")


def qr_data_uri(raw_token: str) -> str:
    """PNG data URI of the same QR. Used by tests and any HTML preview."""
    buffer = io.BytesIO()
    qr_image(raw_token).save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"


def photo_reader(visitor: Visitor):
    """The visitor's photo as something ReportLab can draw, or None.

    A missing file is not a reason to fail a print run — the card still carries the
    name, the serial and a working QR, and a badge with a grey box beats no badge
    at the registration desk.
    """
    try:
        with visitor.photo.open("rb") as handle:
            return ImageReader(io.BytesIO(handle.read()))
    except (ValueError, FileNotFoundError, OSError):
        return None


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

        size -= 0.5

    return [text], size


# --------------------------------------------------------------------------
# The geometric motifs.
#
# A fixed arrangement, not a random one. Every card in a run should look like it
# came from the same press — a per-visitor shuffle would read as a printing fault
# rather than as design, and it would make two prints of the same badge differ.
# --------------------------------------------------------------------------


def _square(canvas, x, y, w, h, color):
    canvas.setFillColor(color)
    canvas.rect(x * mm, y * mm, w * mm, h * mm, stroke=0, fill=1)


def _checker(canvas, x, y, size, color, n=4):
    """n x n alternating squares."""
    step = size / n
    canvas.setFillColor(color)
    for row in range(n):
        for col in range(n):
            if (row + col) % 2 == 0:
                canvas.rect(
                    (x + col * step) * mm,
                    (y + row * step) * mm,
                    step * mm,
                    step * mm,
                    stroke=0,
                    fill=1,
                )


def _dots(canvas, x, y, size, color, n=4):
    """A grid of dots — the halftone block in the reference."""
    step = size / n
    radius = step * 0.3
    canvas.setFillColor(color)
    for row in range(n):
        for col in range(n):
            canvas.circle(
                (x + col * step + step / 2) * mm,
                (y + row * step + step / 2) * mm,
                radius * mm,
                stroke=0,
                fill=1,
            )


def _quarters(canvas, x, y, size, color):
    """Two opposing quarter discs — the pinwheel motif."""
    canvas.setFillColor(color)
    # wedge() takes the bounding box of the full circle, then an angle sweep.
    canvas.wedge(
        x * mm, y * mm, (x + 2 * size) * mm, (y + 2 * size) * mm, 90, 90, stroke=0, fill=1
    )
    canvas.wedge(
        (x - size) * mm,
        (y - size) * mm,
        (x + size) * mm,
        (y + size) * mm,
        270,
        90,
        stroke=0,
        fill=1,
    )


def _triangle(canvas, x, y, size, color):
    canvas.setFillColor(color)
    path = canvas.beginPath()
    path.moveTo(x * mm, y * mm)
    path.lineTo((x + size) * mm, y * mm)
    path.lineTo(x * mm, (y + size) * mm)
    path.close()
    canvas.drawPath(path, stroke=0, fill=1)


def _rings(canvas, x, y, size, color):
    """Concentric circles — the target motif."""
    canvas.setStrokeColor(color)
    canvas.setLineWidth(0.45)
    for step in (0.5, 0.32, 0.14):
        canvas.circle(
            (x + size / 2) * mm, (y + size / 2) * mm, size * step * mm, stroke=1, fill=0
        )


def _stripes(canvas, x, y, size, color):
    canvas.setFillColor(color)
    bar = size / 7
    for index in range(4):
        canvas.rect(
            x * mm, (y + index * 2 * bar) * mm, size * mm, bar * mm, stroke=0, fill=1
        )


_MOTIF = {
    "checker": _checker,
    "dots": _dots,
    "quarters": _quarters,
    "triangle": _triangle,
    "rings": _rings,
    "stripes": _stripes,
    "square": lambda c, x, y, size, color: _square(c, x, y, size, size, color),
}

# (column, row, motif, colour) inside each cluster, on a 3.5 mm cell.
CELL = 3.5

CLUSTER_TOP_LEFT = [
    (0, 1, "quarters", M_PURPLE),
    (1, 1, "triangle", M_ORANGE),
    (2, 1, "rings", M_SKY),
    (0, 0, "checker", M_MAGENTA),
    (1, 0, "dots", M_ORANGE),
    (2, 0, "square", M_YELLOW),
]

CLUSTER_TOP_RIGHT = [
    (0, 1, "dots", M_SKY),
    (1, 1, "checker", M_RED),
    (2, 1, "quarters", M_YELLOW),
    (1, 0, "triangle", M_BLUE),
    (2, 0, "square", M_MAGENTA),
]

CLUSTER_BOTTOM_LEFT = [
    (0, 2, "stripes", M_MAGENTA),
    (1, 2, "square", M_BLUE),
    (0, 1, "checker", M_YELLOW),
    (1, 1, "triangle", M_SKY),
    (0, 0, "quarters", M_ORANGE),
    (1, 0, "dots", M_PURPLE),
]

CLUSTER_BOTTOM_RIGHT = [
    (1, 2, "rings", M_RED),
    (0, 1, "dots", M_BLUE),
    (1, 1, "checker", M_YELLOW),
    (0, 0, "triangle", M_PURPLE),
    (1, 0, "quarters", M_MAGENTA),
]


def _draw_cluster(canvas, plan, origin_x, origin_y):
    for column, row, kind, color in plan:
        _MOTIF[kind](
            canvas,
            origin_x + column * CELL,
            origin_y + row * CELL,
            CELL * 0.82,
            color,
        )


def draw_card(canvas, visitor: Visitor, raw_token: str, x: float, y: float) -> None:
    """Draw one badge with its bottom-left corner at (x, y), in millimetres.

    Every field on the card is real: the name, the organisation, the day they were
    registered, the country, the printed serial, and a QR carrying the raw token.
    Nothing here is a placeholder, because a badge with a placeholder on it is a
    badge that gets handed to somebody.
    """
    vip = visitor.category == VisitorCategory.VIP

    # Card face. On a sheet the cards butt together, so each one paints its own
    # white ground rather than relying on the paper.
    canvas.setFillColor(HexColor("#ffffff"))
    canvas.rect(x * mm, y * mm, CARD_W * mm, CARD_H * mm, stroke=0, fill=1)

    # Lanyard slot, as a punch guide.
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.roundRect(
        (x + SLOT_X) * mm,
        (y + SLOT_Y) * mm,
        SLOT_W * mm,
        SLOT_H * mm,
        SLOT_H / 2 * mm,
        stroke=1,
        fill=0,
    )

    _draw_cluster(canvas, CLUSTER_TOP_LEFT, x + DECO_LEFT_X, y + DECO_TOP_Y)
    _draw_cluster(canvas, CLUSTER_TOP_RIGHT, x + DECO_RIGHT_X, y + DECO_TOP_Y)
    _draw_cluster(canvas, CLUSTER_BOTTOM_LEFT, x + DECO_LEFT_X, y + DECO_BOTTOM_Y)
    _draw_cluster(canvas, CLUSTER_BOTTOM_RIGHT, x + DECO_RIGHT_X + 3.0, y + DECO_BOTTOM_Y)

    # The photo, clipped to a circle. Amber ring for a VIP: the one signal that has
    # to survive being read across a lobby.
    cx, cy = x + PHOTO_CX, y + PHOTO_CY
    canvas.setFillColor(BAND_VIP if vip else NAVY)
    canvas.circle(cx * mm, cy * mm, (PHOTO_R + PHOTO_RING) * mm, stroke=0, fill=1)

    reader = photo_reader(visitor)
    if reader is not None:
        canvas.saveState()
        clip = canvas.beginPath()
        clip.circle(cx * mm, cy * mm, PHOTO_R * mm)
        canvas.clipPath(clip, stroke=0, fill=0)
        # The stored photo is 3:4, so covering a square means overflowing the
        # height. The clip takes care of the overflow; scaling to fit instead
        # would leave two bars of empty circle beside the face.
        draw_w = PHOTO_R * 2
        draw_h = draw_w * 4 / 3
        canvas.drawImage(
            reader,
            (cx - draw_w / 2) * mm,
            (cy - draw_h / 2) * mm,
            draw_w * mm,
            draw_h * mm,
            preserveAspectRatio=False,
            mask="auto",
        )
        canvas.restoreState()
    else:
        canvas.setFillColor(PHOTO_EMPTY)
        canvas.circle(cx * mm, cy * mm, PHOTO_R * mm, stroke=0, fill=1)

    text_width = TEXT_RIGHT - TEXT_LEFT

    # Name, centred, growing upward into the gap under the photo.
    name_lines, name_size = _fit_lines(
        visitor.full_name.upper(), FONT_BOLD, SIZE_NAME, text_width, max_lines=2
    )
    canvas.setFillColor(INK)
    canvas.setFont(FONT_BOLD, name_size)
    baseline = y + NAME_BASELINE
    for line in reversed(name_lines):
        canvas.drawCentredString((x + CARD_W / 2) * mm, baseline * mm, line)
        baseline += NAME_LEADING

    # The role line. A VIP says so here in amber; everyone else gets their
    # organisation, and a visitor with neither gets the word that is still true.
    role = "VIP GUEST" if vip else (visitor.organization or "VISITOR")
    role_lines, role_size = _fit_lines(role, FONT_ITALIC, SIZE_ROLE, text_width, max_lines=1)
    canvas.setFillColor(BAND_VIP if vip else ROLE_PINK)
    canvas.setFont(FONT_ITALIC, role_size)
    canvas.drawCentredString(
        (x + CARD_W / 2) * mm, (y + ROLE_BASELINE) * mm, role_lines[0]
    )

    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(
        (x + TEXT_LEFT + 3) * mm,
        (y + RULE_Y) * mm,
        (x + TEXT_RIGHT - 3) * mm,
        (y + RULE_Y) * mm,
    )

    _field(canvas, x, y + FIELD_1_BASELINE, "Registered", _joined(visitor))
    _field(canvas, x, y + FIELD_2_BASELINE, "Country", visitor.country)

    # Serial, mono, centred — the human-readable half of the badge, and the thing
    # somebody reads out over a radio when the QR will not scan.
    serial_lines, serial_size = _fit_lines(
        visitor.badge_serial, FONT_MONO, SIZE_SERIAL, text_width, max_lines=1
    )
    canvas.setFillColor(INK)
    canvas.setFont(FONT_MONO, serial_size)
    canvas.drawCentredString(
        (x + CARD_W / 2) * mm, (y + SERIAL_BASELINE) * mm, serial_lines[0]
    )

    canvas.drawImage(
        ImageReader(qr_image(raw_token)),
        (x + QR_X) * mm,
        (y + QR_Y) * mm,
        QR_SIZE * mm,
        QR_SIZE * mm,
        preserveAspectRatio=True,
    )


def _joined(visitor: Visitor) -> str:
    """The day this visitor was registered, in the event's own timezone."""
    stamp = timezone.localtime(visitor.created_at)
    return stamp.strftime("%d %b %Y")


def _field(canvas, x: float, baseline: float, label: str, value: str) -> None:
    """One `Label : value` row, with the values in a shared column."""
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT_BODY, SIZE_LABEL)
    canvas.drawString((x + LABEL_X) * mm, baseline * mm, label)
    canvas.drawString((x + VALUE_X - 2.0) * mm, baseline * mm, ":")

    lines, size = _fit_lines(
        value or "-", FONT_BOLD, SIZE_VALUE, TEXT_RIGHT - VALUE_X, max_lines=1
    )
    canvas.setFillColor(INK)
    canvas.setFont(FONT_BOLD, size)
    canvas.drawString((x + VALUE_X) * mm, baseline * mm, lines[0])


def render_card_pdf(visitor: Visitor, raw_token: str) -> bytes:
    """One badge, one CR80 portrait page — 54 x 85.6 mm."""
    buffer = io.BytesIO()
    canvas = pdf_canvas.Canvas(buffer, pagesize=(CARD_W * mm, CARD_H * mm))
    canvas.setTitle(f"Badge {visitor.badge_serial}")

    draw_card(canvas, visitor, raw_token, 0, 0)

    canvas.showPage()
    canvas.save()
    return buffer.getvalue()


def _draw_cut_marks(canvas) -> None:
    """Hairlines in the page margin at every grid line.

    The cards butt against each other with no gutter, so a shared edge is one cut
    and a guillotine takes a straight pass across the whole sheet. The marks sit
    outside the grid and are trimmed away with the waste.
    """
    canvas.setStrokeColor(INK)
    canvas.setLineWidth(CUT_MARK_WEIGHT)

    columns = [SHEET_MARGIN_X + index * CARD_W for index in range(SHEET_COLS + 1)]
    rows = [SHEET_MARGIN_Y + index * CARD_H for index in range(SHEET_ROWS + 1)]

    top, bottom = rows[-1], rows[0]
    for x in columns:
        canvas.line(
            x * mm, (top + CUT_MARK_GAP) * mm, x * mm, (top + CUT_MARK_GAP + CUT_MARK_LEN) * mm
        )
        canvas.line(
            x * mm,
            (bottom - CUT_MARK_GAP) * mm,
            x * mm,
            (bottom - CUT_MARK_GAP - CUT_MARK_LEN) * mm,
        )

    left, right = columns[0], columns[-1]
    for y in rows:
        canvas.line(
            (left - CUT_MARK_GAP) * mm, y * mm, (left - CUT_MARK_GAP - CUT_MARK_LEN) * mm, y * mm
        )
        canvas.line(
            (right + CUT_MARK_GAP) * mm,
            y * mm,
            (right + CUT_MARK_GAP + CUT_MARK_LEN) * mm,
            y * mm,
        )


def render_a4_sheet_pdf(issued: list[tuple[Visitor, str]]) -> bytes:
    """Nine badges to an A4 sheet, in the order given, paginating past nine.

    A run of exactly ONE is not a sheet. Printing a single visitor onto A4 puts
    one card in the corner of a page and wastes the other eight slots, and a card
    printer fed A4 cannot use it at all — so a run of one comes back as a single
    54 x 85.6 mm page, the size of the card itself. The registration desk prints
    one badge far more often than it prints nine.
    """
    if len(issued) == 1:
        visitor, raw_token = issued[0]
        return render_card_pdf(visitor, raw_token)

    buffer = io.BytesIO()
    canvas = pdf_canvas.Canvas(buffer, pagesize=(A4_W * mm, A4_H * mm))
    canvas.setTitle(f"Badge sheet ({len(issued)})")

    for index, (visitor, raw_token) in enumerate(issued):
        position = index % CARDS_PER_SHEET
        if position == 0 and index > 0:
            canvas.showPage()

        if position == 0:
            _draw_cut_marks(canvas)

        column = position % SHEET_COLS
        row = position // SHEET_COLS

        x = SHEET_MARGIN_X + column * CARD_W
        # Reading order: row 0 is the TOP of the page, but ReportLab counts from
        # the bottom, so the row index is subtracted rather than added.
        y = SHEET_MARGIN_Y + (SHEET_ROWS - 1 - row) * CARD_H

        draw_card(canvas, visitor, raw_token, x, y)

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
    the same visitor ten times and every sheet carries the same working QR.

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
