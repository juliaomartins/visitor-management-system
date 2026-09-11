"""Visitor spreadsheets. Both carry a QR; only one of them costs you a reissue.

TWO EXPORTS, AND THE DIFFERENCE IS WHAT THEY DO TO THE CARDS ALREADY PRINTED.

`build_roster_workbook` is the registration desk's own list: a row per visitor
with their photograph and the QR that is already round their neck. It reads the
database and writes nothing, so it is safe to run during the event, on the day,
as often as anyone likes, and no card stops scanning because somebody exported.

That is only true because a badge token is DERIVED — `hmac(secret, id:version)`,
see `visitors.services.badge_token` — so the server can redraw the code on a card
it printed last week without minting a new one. THIS FILE ONCE SAID THE OPPOSITE,
back when tokens were random and kept only as a digest: the roster carried no QR
because there was no QR left to carry. Tokens changed; that sentence did not, for
longer than it should have.

`build_credential_workbook` is for an outside card producer, and it REISSUES.
Every badge in that sheet replaces the one its visitor is currently holding,
which is why it carries a warning tab and the roster does not.

WHAT THE ROSTER NOW IS. A file of working badges. Anyone holding it can make a
card that scans, exactly as if they were holding the printed cards themselves.
It reissues nothing, so it is not destructive — but it is not the
credential-free list it used to be, and it should not be mailed around.

The caller does any reissuing and hands the raw tokens in, so this module never
writes to the database and the transaction stays where it belongs — in the view.
"""

import io
from datetime import datetime

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlsxImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from PIL import Image as PilImage
from PIL import ImageOps

from apps.visitors.models import Visitor, VisitorCategory
from apps.visitors.services import badge_token

from .services import qr_image

HEADER_FILL = PatternFill("solid", fgColor="111827")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)
VIP_FILL = PatternFill("solid", fgColor="FDF5E3")
BODY_FONT = Font(size=10)
MONO_FONT = Font(name="Consolas", size=10)
# A deactivated visitor's badge does not scan. The roster has no "badge state"
# column to say so, so the name is set grey — the one cue that survives being
# printed in black and white is that it is visibly lighter than its neighbours.
DIM_FONT = Font(size=10, color="9AA1AC", italic=True)
THIN = Side(style="thin", color="D9DDE3")
CELL_BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

# Tall enough for a 90 px QR to sit inside the row without spilling.
QR_ROW_HEIGHT = 72
QR_PIXELS = 88

# The photo keeps the 3:4 portrait it is stored in (CLAUDE.md: 600x800), scaled
# to sit in the same row as the QR.
PHOTO_DISPLAY = (66, 88)
# Embedded at twice the display size, so it stays sharp if somebody zooms or
# prints the sheet.
PHOTO_EMBED = (132, 176)
# MEASURED on a photographic test image, per embedded photo and then across the
# event's 250 visitors:
#
#   600x800 PNG, not downscaled   1239 KB   302 MB   <- what "just embed it" costs
#   132x176 PNG                     44 KB    11 MB
#   132x176 JPEG q82                 4 KB     1 MB   <- this
#
# A photograph is what JPEG is for, and at 66x88 on screen the difference is not
# visible. The QR is NOT a photograph and stays PNG: JPEG's ringing softens the
# module edges, and a QR that a phone has to work at is a QR that fails at a door.
PHOTO_FORMAT = "JPEG"
PHOTO_QUALITY = 82


def _qr_buffer(raw_token: str) -> io.BytesIO:
    buffer = io.BytesIO()
    qr_image(raw_token).save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


def _anchored(buffer: io.BytesIO, column: int, row: int, size: tuple[int, int]):
    """An openpyxl image pinned to one cell at an explicit pixel size.

    Images float above the grid rather than living in a cell, so the anchor is
    the only thing tying one to its row. Size is set here too: openpyxl would
    otherwise lay the image out at its natural pixel size and spill it across
    the neighbouring rows.
    """
    image = XlsxImage(buffer)
    image.width, image.height = size
    image.anchor = f"{get_column_letter(column)}{row}"
    return image


def _sheet_title(count: int, *, with_qr: bool) -> str:
    kind = "Credentials" if with_qr else "Roster"
    return f"{kind} ({count})"


def _write_header(sheet, columns: list[tuple[str, int]]) -> None:
    for index, (label, width) in enumerate(columns, start=1):
        cell = sheet.cell(row=1, column=index, value=label)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", horizontal="left")
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.row_dimensions[1].height = 24
    # Keep the header visible while somebody scrolls 250 rows.
    sheet.freeze_panes = "A2"


def _local_day(value: datetime) -> str:
    return timezone.localtime(value).strftime("%d %b %Y %H:%M")


def _category_label(visitor: Visitor) -> str:
    return "VIP" if visitor.category == VisitorCategory.VIP else "Normal"


def _write_row(sheet, row: int, visitor: Visitor, values: list) -> None:
    vip = visitor.category == VisitorCategory.VIP

    for index, value in enumerate(values, start=1):
        cell = sheet.cell(row=row, column=index, value=value)
        cell.font = BODY_FONT
        cell.border = CELL_BORDER
        cell.alignment = Alignment(vertical="center", wrap_text=False)
        if vip:
            cell.fill = VIP_FILL

    # Column one is machine-issued in both sheets — a row number here, a badge
    # serial there. Mono either way, so O and 0 stay apart.
    sheet.cell(row=row, column=1).font = MONO_FONT


ROSTER_COLUMNS = [
    ("No.", 6),
    ("Photo", 11),
    ("Full name", 30),
    ("QR code", 14),
    ("Country", 20),
    ("Organisation", 30),
    ("Registered", 20),
]

# 1-based, to match openpyxl and the anchors below. Derived from the table rather
# than written twice, because a column inserted above either of these would
# otherwise drop its image one cell to the left with nothing to catch it.
ROSTER_PHOTO_COLUMN = 1 + [label for label, _ in ROSTER_COLUMNS].index("Photo")
ROSTER_QR_COLUMN = 1 + [label for label, _ in ROSTER_COLUMNS].index("QR code")


def _photo_buffer(visitor: Visitor) -> io.BytesIO | None:
    """The visitor's photo as a small JPEG, or None if there is no readable file.

    A missing or unreadable file is not a reason to fail the export — the same
    judgement `services.photo_reader` makes for a print run. The row keeps its
    name, country and working QR, and an empty photo cell is a visible prompt to
    go and fix that one visitor.

    `ImageOps.fit` crops to 3:4 rather than scaling to it, so a legacy file that
    is not the canonical 600x800 comes out centred instead of stretched.
    """
    try:
        with visitor.photo.open("rb") as handle:
            raw = handle.read()
        image = PilImage.open(io.BytesIO(raw))
        image = ImageOps.fit(image.convert("RGB"), PHOTO_EMBED)
    except (ValueError, FileNotFoundError, OSError):
        return None

    buffer = io.BytesIO()
    image.save(buffer, format=PHOTO_FORMAT, quality=PHOTO_QUALITY)
    buffer.seek(0)
    return buffer


def build_roster_workbook(visitors: list[Visitor]) -> bytes:
    """Who is registered, with a photograph and the badge already in their hand.

    Reads only. Every QR here is `badge_token(visitor)` — the SAME string the
    visitor's printed card encodes, because the token is derived rather than
    stored, so exporting reissues nothing and no card stops scanning.

    The file does therefore hold 250 working credentials. See the module
    docstring: not destructive, but not a public document either.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = _sheet_title(len(visitors), with_qr=False)

    _write_header(sheet, ROSTER_COLUMNS)

    # openpyxl reads each image lazily when the workbook is saved, so every
    # buffer has to outlive the loop that made it.
    buffers = []

    for offset, visitor in enumerate(visitors):
        row = offset + 2
        sheet.row_dimensions[row].height = QR_ROW_HEIGHT

        _write_row(
            sheet,
            row,
            visitor,
            [
                offset + 1,  # the sheet's own numbering, not an id of anything
                "",  # the photo sits in this cell
                visitor.full_name,
                "",  # and the QR in this one
                visitor.country,
                visitor.organization or "",
                _local_day(visitor.created_at),
            ],
        )

        number = sheet.cell(row=row, column=1)
        number.alignment = Alignment(vertical="center", horizontal="center")

        if not visitor.is_active:
            sheet.cell(row=row, column=3).font = DIM_FONT

        photo = _photo_buffer(visitor)
        if photo is not None:
            buffers.append(photo)
            sheet.add_image(
                _anchored(photo, ROSTER_PHOTO_COLUMN, row, PHOTO_DISPLAY)
            )

        qr = _qr_buffer(badge_token(visitor))
        buffers.append(qr)
        sheet.add_image(
            _anchored(qr, ROSTER_QR_COLUMN, row, (QR_PIXELS, QR_PIXELS))
        )

    return _save(workbook)


CREDENTIAL_COLUMNS = [
    ("Badge serial", 18),
    ("Full name", 30),
    ("Country", 20),
    ("Organisation", 30),
    ("Category", 12),
    ("Registered", 20),
    ("QR code", 16),
    ("QR payload", 46),
]


def build_credential_workbook(issued: list[tuple[Visitor, str]]) -> bytes:
    """The roster plus a scannable QR per row.

    `issued` is (visitor, RAW token) as returned by `reissue_badges`. Each QR is
    the raw token and nothing else — no JSON, no envelope, no id — so a scanner
    posts back exactly what it read.

    The payload is written out as text beside the image on purpose. A card
    producer working from this file needs the string to re-render the QR at their
    own size and error-correction level; a picture alone would force them to
    scan the picture to find out what it says.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = _sheet_title(len(issued), with_qr=True)

    _write_header(sheet, CREDENTIAL_COLUMNS)

    qr_column = len(CREDENTIAL_COLUMNS) - 1  # 1-based index of the "QR code" column

    # openpyxl reads each image lazily when the workbook is saved, so the buffers
    # have to outlive this loop.
    buffers = []

    for offset, (visitor, raw_token) in enumerate(issued):
        row = offset + 2
        sheet.row_dimensions[row].height = QR_ROW_HEIGHT

        _write_row(
            sheet,
            row,
            visitor,
            [
                visitor.badge_serial,
                visitor.full_name,
                visitor.country,
                visitor.organization or "",
                _category_label(visitor),
                _local_day(visitor.created_at),
                "",  # the image sits in this cell
                raw_token,
            ],
        )

        buffer = _qr_buffer(raw_token)
        buffers.append(buffer)
        sheet.add_image(_anchored(buffer, qr_column, row, (QR_PIXELS, QR_PIXELS)))

    payload_column = get_column_letter(len(CREDENTIAL_COLUMNS))
    for row in range(2, len(issued) + 2):
        sheet[f"{payload_column}{row}"].font = MONO_FONT

    _add_warning_sheet(workbook, len(issued))
    return _save(workbook)


def _add_warning_sheet(workbook: Workbook, count: int) -> None:
    """A second tab saying what this file is, because the file outlives the click.

    A spreadsheet gets forwarded, renamed and opened weeks later by somebody who
    was not in the room. The warning has to travel with it.
    """
    sheet = workbook.create_sheet("Read me")
    sheet.column_dimensions["A"].width = 100

    lines = [
        ("READ THIS BEFORE USING THE FILE", True),
        ("", False),
        (
            f"Every one of these {count} badge tokens was newly issued when this file "
            "was generated.",
            False,
        ),
        (
            "Any card printed for these visitors BEFORE that moment no longer scans. "
            "Collect and destroy the old cards.",
            False,
        ),
        ("", False),
        (
            "The QR payload column is the exact string each QR encodes. Print it as-is: "
            "no JSON, no prefix, no URL.",
            False,
        ),
        (
            "This file is the ONLY copy of these tokens. The server keeps a hash and "
            "cannot reproduce them — if the file is lost, the badges must be reissued "
            "again.",
            False,
        ),
        ("", False),
        (
            "Treat it like the printed cards themselves: anyone holding this file can "
            "make a working badge.",
            False,
        ),
    ]

    for index, (text, bold) in enumerate(lines, start=1):
        cell = sheet.cell(row=index, column=1, value=text)
        cell.font = Font(bold=bold, size=12 if bold else 10)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        if not bold and text:
            sheet.row_dimensions[index].height = 30


def _save(workbook: Workbook) -> bytes:
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
