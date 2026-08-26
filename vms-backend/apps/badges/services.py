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

from apps.visitors.models import Visitor, VisitorCategory
from apps.visitors.services import issue_badge_token, log_visitor_action

audit = logging.getLogger("vms.audit")


class BadgeRenderingUnavailable(RuntimeError):
    """Kept so the view's 503 path still has something to catch.

    Nothing raises it today — ReportLab has no native dependency to be missing —
    but the endpoint contract still documents a 503, and a future renderer that
    can be unavailable should surface it the same way rather than 500.
    """


# --------------------------------------------------------------------------
# Card geometry. CR80, the size of a bank card. Millimetres throughout.
# --------------------------------------------------------------------------

CARD_W, CARD_H = 85.6, 54.0
PAD = 3.5
BAND_W = 3.0

PHOTO_X, PHOTO_W, PHOTO_H = BAND_W + PAD, 24.0, 32.0
QR_SIZE = 20.0
BODY_X = PHOTO_X + PHOTO_W + 2.5

# The name block sits in the UPPER half, where the QR is not, so it runs to the
# card edge. Only the serial shares a line with the QR and has to stop short of it.
# Constraining the whole block to the QR's column — as the first cut did — wrapped
# short names like "Ada Lovelace" onto two lines beside a wide empty margin.
BODY_RIGHT = CARD_W - PAD
SERIAL_RIGHT = CARD_W - PAD - QR_SIZE - 2.5

INK = HexColor("#000000")
MUTED = HexColor("#4a5560")
BAND_NORMAL = HexColor("#17212b")
BAND_VIP = HexColor("#a16207")
PHOTO_EMPTY = HexColor("#e2dfd8")

# 1 mm is ~2.835 pt; these are the CSS sizes converted.
SIZE_VIP_TAG = 7.4
SIZE_NAME = 13.0
SIZE_COUNTRY = 9.6
SIZE_ORG = 7.9
SIZE_SERIAL = 8.5

FONT_BOLD = "Helvetica-Bold"
FONT_BODY = "Helvetica"
FONT_MONO = "Courier-Bold"

CARDS_PER_SHEET = 10
SHEET_COLS, SHEET_ROWS = 2, 5

# A4, with the grid centred: (210 - 2*85.6)/2 and (297 - 5*54)/2.
A4_W, A4_H = 210.0, 297.0
SHEET_MARGIN_X = (A4_W - SHEET_COLS * CARD_W) / 2
SHEET_MARGIN_Y = (A4_H - SHEET_ROWS * CARD_H) / 2

CUT_MARK_LEN = 3.0
CUT_MARK_GAP = 1.0
CUT_MARK_WEIGHT = 0.2

# M recovers about 15%. A badge picks up scuffs and lanyard creases, and this keeps
# the modules large enough to read across a doorway at 20mm.
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


def draw_card(canvas, visitor: Visitor, raw_token: str, x: float, y: float) -> None:
    """Draw one badge with its bottom-left corner at (x, y), in millimetres."""
    vip = visitor.category == VisitorCategory.VIP

    # Edge band — the VIP signal, readable at arm's length across a desk.
    canvas.setFillColor(BAND_VIP if vip else BAND_NORMAL)
    canvas.rect((x) * mm, y * mm, BAND_W * mm, CARD_H * mm, stroke=0, fill=1)

    # Photo, top-aligned, 3:4 portrait — the aspect the dashboard crops to.
    photo_y = y + CARD_H - PAD - PHOTO_H
    reader = photo_reader(visitor)
    if reader is not None:
        canvas.drawImage(
            reader,
            (x + PHOTO_X) * mm,
            photo_y * mm,
            PHOTO_W * mm,
            PHOTO_H * mm,
            preserveAspectRatio=False,
            mask="auto",
        )
    else:
        canvas.setFillColor(PHOTO_EMPTY)
        canvas.rect(
            (x + PHOTO_X) * mm, photo_y * mm, PHOTO_W * mm, PHOTO_H * mm, stroke=0, fill=1
        )

    body_width = BODY_RIGHT - BODY_X
    cursor = y + CARD_H - PAD

    if vip:
        canvas.setFillColor(BAND_VIP)
        canvas.setFont(FONT_BOLD, SIZE_VIP_TAG)
        cursor -= SIZE_VIP_TAG / mm
        canvas.drawString((x + BODY_X) * mm, cursor * mm, "VIP")
        cursor -= 1.0

    name_lines, name_size = _fit_lines(
        visitor.full_name, FONT_BOLD, SIZE_NAME, body_width, max_lines=2
    )
    canvas.setFillColor(INK)
    canvas.setFont(FONT_BOLD, name_size)
    for line in name_lines:
        cursor -= name_size / mm
        canvas.drawString((x + BODY_X) * mm, cursor * mm, line)
        cursor -= 0.4

    cursor -= 1.0
    canvas.setFont(FONT_BODY, SIZE_COUNTRY)
    cursor -= SIZE_COUNTRY / mm
    canvas.drawString((x + BODY_X) * mm, cursor * mm, visitor.country)

    if visitor.organization:
        org_lines, org_size = _fit_lines(
            visitor.organization, FONT_BODY, SIZE_ORG, body_width, max_lines=1
        )
        canvas.setFillColor(MUTED)
        canvas.setFont(FONT_BODY, org_size)
        cursor -= 0.8 + org_size / mm
        canvas.drawString((x + BODY_X) * mm, cursor * mm, org_lines[0])

    # Serial, mono, on the baseline — the human-readable half of the badge. This is
    # the one line level with the QR, so it is the one that must stop short of it.
    serial_lines, serial_size = _fit_lines(
        visitor.badge_serial, FONT_MONO, SIZE_SERIAL, SERIAL_RIGHT - BODY_X, max_lines=1
    )
    canvas.setFillColor(INK)
    canvas.setFont(FONT_MONO, serial_size)
    canvas.drawString((x + BODY_X) * mm, (y + PAD) * mm, serial_lines[0])

    # QR, bottom-right.
    canvas.drawImage(
        ImageReader(qr_image(raw_token)),
        (x + CARD_W - PAD - QR_SIZE) * mm,
        (y + PAD) * mm,
        QR_SIZE * mm,
        QR_SIZE * mm,
        preserveAspectRatio=True,
    )


def render_card_pdf(visitor: Visitor, raw_token: str) -> bytes:
    """One badge, one CR80 page."""
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
    """Ten badges to a sheet, in the order given, paginating past ten."""
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


def reissue_badges(visitors, *, actor=None) -> list[tuple[Visitor, str]]:
    """Mint a fresh token for each visitor and hand back the raw values.

    Printing in bulk necessarily reissues. The raw token exists only at creation,
    so there is no way to reprint a card issued earlier — the only thing the server
    can do is mint a new one, which is what this does.

    Note what it does NOT do: it never calls `revoke_badge()`. That sets
    `is_active = False`, which would kill the badge this sheet is about to print as
    well as the old one. Overwriting `token_hash` is already the revocation — the
    previous QR stops matching the moment a new token is issued.
    """
    issued: list[tuple[Visitor, str]] = []

    for visitor in visitors:
        raw_token = issue_badge_token(visitor)
        issued.append((visitor, raw_token))
        log_visitor_action(actor, "badge_reissued", visitor)

    return issued
