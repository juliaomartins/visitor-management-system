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

from apps.common.report_header import HEADER_ROWS, write_xlsx_header
from apps.visitors.models import Visitor, VisitorCategory
from apps.visitors.services import badge_token

from .services import qr_image

# Each workbook's title line. Everything else in the header -- the logo, the
# navy bar, the event name and the dates -- is shared with every other report
# and lives in `apps/common/report_header.py`.
#
# NOT TRANSLATED, and for the same reason the printed badge is not: these sheets
# are printing worklists that go to whoever runs the card printer, and
# `services.py` draws the card itself in English. A Tetun worklist against an
# English card would be a sheet that disagrees with what comes out.
ROSTER_TITLE = "VISITOR LIST AND QR CODE PRINTING LIST"
CREDENTIAL_TITLE = "VISITOR BADGE & QR CODE PRINTING LIST"
# A tint of the same blue, so the column headings read as part of the banner
# rather than as a second, competing bar.
COLUMN_FILL = PatternFill("solid", fgColor="CFD9F0")
COLUMN_FONT = Font(color="00309C", bold=True, size=10)

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
# DISPLAY size only -- the embedded PNG is the full-resolution one qr_image draws,
# so printing or zooming the sheet is unaffected.
#
# THE CENTRE LOGO DID NOT CHANGE THIS NUMBER, and that is worth saying because it
# nearly did. The unit that matters for reading a code off somebody's screen is
# pixels per QR module, and the mark is composited onto a grid that is still 39
# modules across -- error correction stayed at M precisely so it would be (see
# QR_ERROR_CORRECTION in services.py). Had the level gone to Q the grid would
# have become 43, quietly dropping 2.26 px/module to 2.05 in the one export whose
# whole purpose is that the codes in it are scannable.
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


#: Rows 1-3 are the shared report header, row 4 the column headings.
HEADING_ROW = HEADER_ROWS + 1
FIRST_DATA_ROW = HEADING_ROW + 1


def _write_banner(sheet, columns: list[tuple[str, int]], title: str) -> None:
    """The shared report header over the column headings.

    This is the shape the organisers already circulate their committee lists
    in, and a printing worklist that looks like every other list on the desk is
    one nobody has to be taught to read.

    BOTH workbooks use this, and so does every other report through
    `write_xlsx_header` -- see that module for the logo and the merge rules.

    The headings and column widths go in FIRST. The header centres the logo in
    column A's final width and sizes the banner from the widths it can see.
    Column A is "No.", six characters wide, and the header widens it to fit the
    logo; that is the one cost of the logo on these sheets.
    """
    for index, (label, width) in enumerate(columns, start=1):
        cell = sheet.cell(row=HEADING_ROW, column=index, value=label)
        cell.fill = COLUMN_FILL
        cell.font = COLUMN_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = CELL_BORDER
        sheet.column_dimensions[get_column_letter(index)].width = width

    sheet.row_dimensions[HEADING_ROW].height = 22
    write_xlsx_header(sheet, title, last_column=len(columns))
    # Keep the header and the headings visible through 250 rows.
    sheet.freeze_panes = f"A{FIRST_DATA_ROW}"


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


# Reading order: who, then where they are from, then the two things that get
# printed, then when they registered. "Organization" rather than the British
# spelling used elsewhere in this file, because that is what the organisers'
# own lists say and this sheet sits beside them.
ROSTER_COLUMNS = [
    ("No.", 6),
    ("Name", 30),
    ("Country", 18),
    ("Organization", 28),
    ("Photo", 11),
    ("QR Code", 14),
    ("Registered", 20),
]


def _column_index(columns: list[tuple[str, int]], label: str) -> int:
    """1-based index of a column, looked up by its heading.

    Derived rather than written twice. Photo and QR moved three places to the
    right when the roster was reshaped and again when the credential sheet
    gained a photo, and nothing had to change at either call site: an anchor
    written as a literal would have dropped every image into the wrong cell,
    silently, in a file nobody opens until the morning they print from it.
    """
    return 1 + [heading for heading, _ in columns].index(label)


ROSTER_NAME_COLUMN = _column_index(ROSTER_COLUMNS, "Name")
ROSTER_PHOTO_COLUMN = _column_index(ROSTER_COLUMNS, "Photo")
ROSTER_QR_COLUMN = _column_index(ROSTER_COLUMNS, "QR Code")


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

    _write_banner(sheet, ROSTER_COLUMNS, ROSTER_TITLE)

    # openpyxl reads each image lazily when the workbook is saved, so every
    # buffer has to outlive the loop that made it.
    buffers = []

    for offset, visitor in enumerate(visitors):
        row = offset + FIRST_DATA_ROW
        sheet.row_dimensions[row].height = QR_ROW_HEIGHT

        _write_row(
            sheet,
            row,
            visitor,
            [
                offset + 1,  # the sheet's own numbering, not an id of anything
                visitor.full_name,
                visitor.country,
                visitor.organization or "",
                "",  # the photo sits in this cell
                "",  # and the QR in this one
                _local_day(visitor.created_at),
            ],
        )

        number = sheet.cell(row=row, column=1)
        number.alignment = Alignment(vertical="center", horizontal="center")

        if not visitor.is_active:
            sheet.cell(row=row, column=ROSTER_NAME_COLUMN).font = DIM_FONT

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


# Everything a visitor has once they are registered, in the order somebody
# printing cards reads it: who, where from, which kind of badge, the serial that
# goes on the card, the two things that get printed, when they registered, and
# the payload last because it is for a machine rather than a person.
#
# Same headings and spelling as the roster, so the two sheets can sit beside
# each other on the same desk without a second reading.
CREDENTIAL_COLUMNS = [
    ("No.", 6),
    ("Name", 30),
    ("Country", 18),
    ("Organization", 28),
    ("Category", 12),
    ("Badge Serial", 18),
    ("Photo", 11),
    ("QR Code", 14),
    ("Registered", 20),
    ("QR payload", 46),
]

CREDENTIAL_NAME_COLUMN = _column_index(CREDENTIAL_COLUMNS, "Name")
CREDENTIAL_SERIAL_COLUMN = _column_index(CREDENTIAL_COLUMNS, "Badge Serial")
CREDENTIAL_PHOTO_COLUMN = _column_index(CREDENTIAL_COLUMNS, "Photo")
CREDENTIAL_QR_COLUMN = _column_index(CREDENTIAL_COLUMNS, "QR Code")
CREDENTIAL_PAYLOAD_COLUMN = _column_index(CREDENTIAL_COLUMNS, "QR payload")


def build_credential_workbook(issued: list[tuple[Visitor, str]]) -> bytes:
    """Every registered field, the photograph, and a scannable QR per row.

    The card producer's sheet: the same banner and layout as the roster, plus
    the two columns only whoever prints the cards needs — the badge serial that
    goes on the card, and the QR payload as text.

    `issued` is (visitor, RAW token) from `collect_badge_tokens`. Each QR is the
    raw token and nothing else — no JSON, no envelope, no id — so a scanner
    posts back exactly what it read.

    The payload is written out as text beside the image on purpose. A card
    producer working from this file needs the string to re-render the QR at their
    own size and error-correction level; a picture alone would force them to
    scan the picture to find out what it says.

    NOTHING HERE IS REISSUED, and this docstring used to say otherwise. See
    `collect_badge_tokens`: the token is derived, so this recomputes the code
    already on the card. Export the same visitor ten times and every sheet
    carries the same working QR.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = _sheet_title(len(issued), with_qr=True)

    _write_banner(sheet, CREDENTIAL_COLUMNS, CREDENTIAL_TITLE)

    # openpyxl reads each image lazily when the workbook is saved, so the buffers
    # have to outlive this loop.
    buffers = []

    for offset, (visitor, raw_token) in enumerate(issued):
        row = offset + FIRST_DATA_ROW
        sheet.row_dimensions[row].height = QR_ROW_HEIGHT

        _write_row(
            sheet,
            row,
            visitor,
            [
                offset + 1,  # the sheet's own numbering, not an id of anything
                visitor.full_name,
                visitor.country,
                visitor.organization or "",
                _category_label(visitor),
                visitor.badge_serial,
                "",  # the photo sits in this cell
                "",  # and the QR in this one
                _local_day(visitor.created_at),
                raw_token,
            ],
        )

        number = sheet.cell(row=row, column=1)
        number.alignment = Alignment(vertical="center", horizontal="center")

        # Machine-issued strings, set in mono so O and 0 stay apart. The serial
        # is read aloud at a desk and the payload is retyped into a card
        # template; both are worth the font.
        sheet.cell(row=row, column=CREDENTIAL_SERIAL_COLUMN).font = MONO_FONT
        sheet.cell(row=row, column=CREDENTIAL_PAYLOAD_COLUMN).font = MONO_FONT

        if not visitor.is_active:
            sheet.cell(row=row, column=CREDENTIAL_NAME_COLUMN).font = DIM_FONT

        photo = _photo_buffer(visitor)
        if photo is not None:
            buffers.append(photo)
            sheet.add_image(
                _anchored(photo, CREDENTIAL_PHOTO_COLUMN, row, PHOTO_DISPLAY)
            )

        qr = _qr_buffer(raw_token)
        buffers.append(qr)
        sheet.add_image(
            _anchored(qr, CREDENTIAL_QR_COLUMN, row, (QR_PIXELS, QR_PIXELS))
        )

    _add_warning_sheet(workbook, len(issued))
    return _save(workbook)


def _add_warning_sheet(workbook: Workbook, count: int) -> None:
    """A second tab saying what this file is, because the file outlives the click.

    A spreadsheet gets forwarded, renamed and opened weeks later by somebody who
    was not in the room, so what it is has to travel with it.

    THIS TAB USED TO BE WRONG IN THE MOST EXPENSIVE DIRECTION. It said every
    token had been newly issued and instructed the reader to "collect and
    destroy the old cards" -- which, once tokens became derived, meant telling
    somebody to destroy 250 working badges on the strength of a sentence nobody
    had revisited. The endpoint stopped reissuing; this tab did not notice.
    """
    sheet = workbook.create_sheet("Read me")
    # Column A is the header's logo cell; the text reads down column B.
    sheet.column_dimensions["B"].width = 100

    lines = [
        ("WHAT THIS FILE IS", True),
        ("", False),
        (
            f"A printing worklist for {count} visitor badges: every registered "
            "field, the photograph, and the QR code that goes on the card.",
            False,
        ),
        ("", False),
        ("NOTHING WAS REISSUED TO MAKE IT.", True),
        (
            "The QR beside each name is the code ALREADY on that visitor's card. "
            "Exporting changed nothing, and every card printed before this file "
            "was made still scans. Do not collect or destroy anything.",
            False,
        ),
        (
            "Exporting again later produces an identical file, so losing this one "
            "costs nothing but the time to export it again.",
            False,
        ),
        ("", False),
        (
            "The QR payload column is the exact string each QR encodes. Print it "
            "as-is: no JSON, no prefix, no URL.",
            False,
        ),
        ("", False),
        ("BUT TREAT IT LIKE THE PRINTED CARDS THEMSELVES.", True),
        (
            "Anyone holding this file can produce a badge that scans. Send it the "
            "way you would send the cards, not the way you would send a guest "
            "list.",
            False,
        ),
        (
            "To stop one badge, deactivate that visitor in the dashboard. "
            "Deleting this file does not stop anything.",
            False,
        ),
        ("", False),
        (
            "A name set in grey italics is a visitor who is already deactivated: "
            "their QR will not scan, so there is no point printing that card.",
            False,
        ),
    ]

    for index, (text, bold) in enumerate(lines, start=FIRST_DATA_ROW):
        cell = sheet.cell(row=index, column=2, value=text)
        cell.font = Font(bold=bold, size=12 if bold else 10)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        if not bold and text:
            sheet.row_dimensions[index].height = 30

    write_xlsx_header(sheet, CREDENTIAL_TITLE, last_column=2)


def _save(workbook: Workbook) -> bytes:
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
