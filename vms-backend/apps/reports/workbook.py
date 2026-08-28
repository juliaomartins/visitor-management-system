"""The entrance report as a workbook.

SIX SHEETS, ONE QUESTION EACH, in the order somebody asks them: what happened,
when, where from, through which door, who is still missing, and finally the raw
log for anyone who wants to check the arithmetic.

The dump-everything-on-one-sheet approach is what makes an export boring — it
hands the reader the same work the system was supposed to do. Every sheet here
has already answered something.

Numbers are written as numbers, not strings, so a customer can pivot and chart
them without cleaning the file first. Percentages carry a number format rather
than a "%" glued onto text, for the same reason.
"""

import datetime as dt
import io

from django.db.models import QuerySet
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from apps.scans.models import ScanEvent, ScanResult

from .services import event_timezone

INK = "111827"
ACCENT = "2563EB"
HEADER_FILL = PatternFill("solid", fgColor=INK)
HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)
TITLE_FONT = Font(bold=True, size=16, color=INK)
LEAD_FONT = Font(size=11, color="4B5563")
KPI_FONT = Font(bold=True, size=22, color=ACCENT)
LABEL_FONT = Font(size=9, color="6B7280")
BODY = Font(size=10)
THIN = Side(style="thin", color="E5E7EB")
CELL_BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

REFUSED = {ScanResult.INVALID, ScanResult.REVOKED}

RESULT_LABEL = {
    ScanResult.VALID: "Valid",
    ScanResult.DUPLICATE: "Duplicate",
    ScanResult.REVOKED: "Revoked",
    ScanResult.INVALID: "Invalid",
}


def _headers(sheet, columns: list[tuple[str, int]], row: int = 1) -> None:
    for index, (label, width) in enumerate(columns, start=1):
        cell = sheet.cell(row=row, column=index, value=label)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center")
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.row_dimensions[row].height = 22
    sheet.freeze_panes = sheet.cell(row=row + 1, column=1)


def _row(sheet, row: int, values: list, percent_columns: tuple[int, ...] = ()) -> None:
    for index, value in enumerate(values, start=1):
        cell = sheet.cell(row=row, column=index, value=value)
        cell.font = BODY
        cell.border = CELL_BORDER
        if index in percent_columns:
            cell.number_format = "0.0\\%"


def _local(stamp: dt.datetime, zone) -> dt.datetime:
    """openpyxl cannot write a tz-aware datetime, so drop the offset after
    converting. The sheet is labelled with the zone instead."""
    return timezone.localtime(stamp, zone).replace(tzinfo=None)


def build_workbook(
    queryset: QuerySet[ScanEvent],
    summary: dict,
    facts: dict,
    narrative: list[str],
    *,
    date_from: dt.date,
    date_to: dt.date,
) -> bytes:
    workbook = Workbook()
    zone = event_timezone()

    _summary_sheet(workbook, summary, facts, narrative, date_from, date_to, zone)
    _hourly_sheet(workbook, summary)
    _countries_sheet(workbook, summary)
    _doors_sheet(workbook, facts)
    _absent_sheet(workbook, facts)
    _log_sheet(workbook, queryset, zone)

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _summary_sheet(workbook, summary, facts, narrative, date_from, date_to, zone):
    sheet = workbook.active
    sheet.title = "Summary"
    sheet.column_dimensions["A"].width = 26
    for column in "BCDE":
        sheet.column_dimensions[column].width = 18

    sheet["A1"] = "Entrance report"
    sheet["A1"].font = TITLE_FONT
    span = (
        f"{date_from:%d %b %Y}"
        if date_from == date_to
        else f"{date_from:%d %b %Y} to {date_to:%d %b %Y}"
    )
    sheet["A2"] = f"{span} · times in {zone}"
    sheet["A2"].font = LEAD_FONT
    sheet["A3"] = f"Generated {timezone.localtime(timezone.now(), zone):%d %b %Y %H:%M}"
    sheet["A3"].font = LABEL_FONT

    # The four figures that answer the question before anyone scrolls.
    kpis = [
        ("Registered", facts["registered"]),
        ("Arrived", facts["arrived"]),
        ("Attendance", facts["attendance_rate"]),
        ("Refused", facts["refused"]),
    ]
    for index, (label, value) in enumerate(kpis):
        column = get_column_letter(1 + index)
        sheet[f"{column}5"] = label
        sheet[f"{column}5"].font = LABEL_FONT
        cell = sheet[f"{column}6"]
        cell.value = value
        cell.font = KPI_FONT
        if label == "Attendance":
            cell.number_format = "0.0\\%"
    sheet.row_dimensions[6].height = 30

    sheet["A8"] = "What the numbers say"
    sheet["A8"].font = Font(bold=True, size=12, color=INK)

    for index, line in enumerate(narrative):
        cell = sheet.cell(row=9 + index, column=1, value=f"•  {line}")
        cell.font = BODY
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        sheet.merge_cells(start_row=9 + index, start_column=1, end_row=9 + index, end_column=5)
        sheet.row_dimensions[9 + index].height = 30

    start = 10 + len(narrative)
    sheet.cell(row=start, column=1, value="Outcome breakdown").font = Font(
        bold=True, size=12, color=INK
    )
    _headers(sheet, [("Outcome", 26), ("Scans", 14), ("Share", 14)], row=start + 1)
    sheet.freeze_panes = None  # a summary sheet does not scroll

    total = summary["total"] or 1
    for index, (result, label) in enumerate(RESULT_LABEL.items()):
        count = summary["by_result"][result]
        _row(
            sheet,
            start + 2 + index,
            [label, count, round(count / total * 100, 1)],
            percent_columns=(3,),
        )


def _hourly_sheet(workbook, summary):
    """Flow through the day, with a chart the customer does not have to build."""
    sheet = workbook.create_sheet("Hourly flow")
    _headers(
        sheet,
        [("Hour", 14), ("Total", 12), ("Valid", 12), ("Duplicate", 12), ("Refused", 12)],
    )

    for index, bucket in enumerate(summary["by_hour"]):
        hour = dt.datetime.fromisoformat(bucket["hour"])
        _row(
            sheet,
            index + 2,
            [
                f"{hour:%H:%M}",
                bucket["total"],
                bucket["valid"],
                bucket["duplicate"],
                bucket["refused"],
            ],
        )

    if not summary["by_hour"]:
        return

    chart = BarChart()
    chart.type = "col"
    chart.grouping = "stacked"
    chart.overlap = 100
    chart.title = "Scans by hour"
    chart.y_axis.title = "Scans"
    chart.height = 8
    chart.width = 20

    last = len(summary["by_hour"]) + 1
    # Columns C:E — valid, duplicate, refused — stacked. Not column B, which is
    # their sum and would double the height of every bar.
    chart.add_data(Reference(sheet, min_col=3, max_col=5, min_row=1, max_row=last), titles_from_data=True)
    chart.set_categories(Reference(sheet, min_col=1, min_row=2, max_row=last))
    sheet.add_chart(chart, "G2")


def _countries_sheet(workbook, summary):
    sheet = workbook.create_sheet("Delegations")
    _headers(sheet, [("Country", 34), ("Scans", 14), ("Share", 14)])

    total = sum(row["total"] for row in summary["by_country"]) or 1
    for index, row in enumerate(summary["by_country"]):
        _row(
            sheet,
            index + 2,
            [row["country"] or "Unknown", row["total"], round(row["total"] / total * 100, 1)],
            percent_columns=(3,),
        )


def _doors_sheet(workbook, facts):
    sheet = workbook.create_sheet("Doors")
    _headers(
        sheet,
        [("Door", 30), ("Scans", 12), ("Admitted", 12), ("Refused", 12), ("Share", 12)],
    )

    for index, row in enumerate(facts["devices"]):
        _row(
            sheet,
            index + 2,
            [row["device"], row["total"], row["valid"], row["refused"], row["share"]],
            percent_columns=(5,),
        )


def _absent_sheet(workbook, facts):
    """Registered but never through the door — the call sheet."""
    sheet = workbook.create_sheet("Not arrived")
    _headers(
        sheet,
        [("Badge serial", 18), ("Full name", 30), ("Country", 22), ("Organisation", 30), ("Category", 12)],
    )

    for index, visitor in enumerate(facts["not_arrived"]):
        _row(
            sheet,
            index + 2,
            [
                visitor.badge_serial,
                visitor.full_name,
                visitor.country,
                visitor.organization or "",
                "VIP" if visitor.category == "vip" else "Normal",
            ],
        )


def _log_sheet(workbook, queryset, zone):
    """Every scan, so the arithmetic above can be checked."""
    sheet = workbook.create_sheet("Full log")
    _headers(
        sheet,
        [
            ("Scanned at", 20),
            ("Outcome", 14),
            ("Full name", 28),
            ("Country", 20),
            ("Organisation", 28),
            ("Category", 12),
            ("Badge serial", 18),
            ("Door", 22),
            ("Event ID", 12),
        ],
    )

    for index, scan in enumerate(queryset.iterator(chunk_size=500)):
        visitor = scan.visitor
        _row(
            sheet,
            index + 2,
            [
                _local(scan.scanned_at, zone),
                RESULT_LABEL.get(scan.result, scan.result),
                visitor.full_name if visitor else "Unrecognised badge",
                visitor.country if visitor else "",
                (visitor.organization or "") if visitor else "",
                ("VIP" if visitor.category == "vip" else "Normal") if visitor else "",
                visitor.badge_serial if visitor else "",
                scan.device.name if scan.device else "",
                scan.id,
            ],
        )
        sheet.cell(row=index + 2, column=1).number_format = "yyyy-mm-dd hh:mm:ss"
