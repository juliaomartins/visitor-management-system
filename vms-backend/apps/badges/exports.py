"""Visitor spreadsheets, with and without the QR.

TWO EXPORTS, AND THE DIFFERENCE IS THE WHOLE POINT.

`build_roster_workbook` is a plain list of who is registered. It reads the
database and writes nothing, so it is safe to run during the event, on the day,
as often as anyone likes.

`build_credential_workbook` embeds a scannable QR beside every row — and that is
only possible by REISSUING. The server keeps `sha256(token)` and nothing else, so
it cannot reproduce the QR on a card it printed last week; it can only mint a new
token and print that. Every badge in the sheet therefore replaces the one that
visitor is currently holding.

That is not a limitation to design around. It is the property that stops somebody
photographing a badge, editing the number, and walking in as another guest.

The caller does the reissuing and hands the raw tokens in, so this module never
writes to the database and the transaction stays where it belongs — in the view.
"""

import io
from datetime import datetime

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlsxImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from apps.visitors.models import Visitor, VisitorCategory

from .services import qr_image

HEADER_FILL = PatternFill("solid", fgColor="111827")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)
VIP_FILL = PatternFill("solid", fgColor="FDF5E3")
BODY_FONT = Font(size=10)
MONO_FONT = Font(name="Consolas", size=10)
THIN = Side(style="thin", color="D9DDE3")
CELL_BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

# Tall enough for a 90 px QR to sit inside the row without spilling.
QR_ROW_HEIGHT = 72
QR_PIXELS = 88
DATA_ROW_HEIGHT = 20


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

    # The serial is machine-issued; set it as such so O and 0 stay apart.
    sheet.cell(row=row, column=1).font = MONO_FONT


ROSTER_COLUMNS = [
    ("Badge serial", 18),
    ("Full name", 30),
    ("Country", 20),
    ("Organisation", 30),
    ("Category", 12),
    ("Badge state", 14),
    ("Registered", 20),
]


def build_roster_workbook(visitors: list[Visitor]) -> bytes:
    """Who is registered. Reads only — nothing is reissued and no card changes."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = _sheet_title(len(visitors), with_qr=False)

    _write_header(sheet, ROSTER_COLUMNS)

    for offset, visitor in enumerate(visitors):
        row = offset + 2
        sheet.row_dimensions[row].height = DATA_ROW_HEIGHT
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
                "Active" if visitor.is_active else "Revoked",
                _local_day(visitor.created_at),
            ],
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

        buffer = io.BytesIO()
        qr_image(raw_token).save(buffer, format="PNG")
        buffer.seek(0)
        buffers.append(buffer)

        image = XlsxImage(buffer)
        image.width = QR_PIXELS
        image.height = QR_PIXELS
        image.anchor = f"{get_column_letter(qr_column)}{row}"
        sheet.add_image(image)

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
