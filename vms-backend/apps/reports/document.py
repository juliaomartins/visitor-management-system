"""The entrance report as a PDF somebody can hand to a client.

A document, not a table dump. It opens with the four figures that answer the
question, then says what they mean in sentences, then shows the shape of the day,
and only afterwards gets into tables. Somebody who reads the first page and stops
should still have the answer.

Platypus rather than raw canvas: this content flows and paginates, and hand-
placing a table that might be four rows or four hundred is how a report ends up
with a heading orphaned at the foot of a page. The badge renderer draws at fixed
millimetre positions because a card is one fixed size; a report is not.

ReportLab only — no new dependency, and the same renderer the badges already use.
"""

import datetime as dt

import io

from django.db.models import QuerySet
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from apps.common.report_header import PDF_HEADER_HEIGHT, draw_pdf_header
from apps.scans.models import ScanEvent, ScanResult

from .services import event_timezone

REPORT_TITLE = "ENTRANCE REPORT"

INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")
ACCENT = colors.HexColor("#2563EB")

# The validated status set the dashboard uses. Same meanings, same colours, so a
# printed report and the screen do not disagree about what amber means.
GOOD = colors.HexColor("#059669")
WARN = colors.HexColor("#CA8A04")
CRIT = colors.HexColor("#DC2626")
NEUTRAL = colors.HexColor("#94A3B8")

PAGE_MARGIN = 16 * mm
# The shared report header's height; the body frame starts below it.
HEADER_H = PDF_HEADER_HEIGHT

RESULT_LABEL = {
    ScanResult.VALID: "Valid",
    ScanResult.DUPLICATE: "Duplicate",
    ScanResult.REVOKED: "Revoked",
    ScanResult.INVALID: "Invalid",
}
RESULT_COLOUR = {
    ScanResult.VALID: GOOD,
    ScanResult.DUPLICATE: NEUTRAL,
    ScanResult.REVOKED: WARN,
    ScanResult.INVALID: CRIT,
}


def _styles():
    base = getSampleStyleSheet()
    return {
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            spaceBefore=8,
            spaceAfter=5,
            textColor=INK,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "muted": ParagraphStyle(
            "muted",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=MUTED,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=INK,
            leftIndent=9,
            bulletIndent=0,
            spaceAfter=3.5,
        ),
    }


class KpiBand(Flowable):
    """The four figures, boxed, across the full width.

    A Flowable rather than a Table so the big number and its label can sit at
    different sizes inside one cell without fighting a table's row model.
    """

    def __init__(self, width: float, items: list[tuple[str, str, colors.Color]]):
        super().__init__()
        self.width = width
        self.height = 21 * mm
        self.items = items

    def draw(self):
        canvas = self.canv
        gap = 3 * mm
        box = (self.width - gap * (len(self.items) - 1)) / len(self.items)

        for index, (label, value, tint) in enumerate(self.items):
            x = index * (box + gap)

            canvas.setFillColor(colors.HexColor("#F7F8FA"))
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.6)
            canvas.roundRect(x, 0, box, self.height, 2.5 * mm, stroke=1, fill=1)

            canvas.setFillColor(MUTED)
            canvas.setFont("Helvetica", 7.6)
            canvas.drawString(x + 4 * mm, self.height - 6.4 * mm, label.upper())

            canvas.setFillColor(tint)
            canvas.setFont("Helvetica-Bold", 19)
            canvas.drawString(x + 4 * mm, self.height - 15.5 * mm, value)


class HourlyFlow(Flowable):
    """Scans by hour, stacked by outcome.

    Drawn rather than tabulated because the SHAPE is the finding — where the queue
    formed, where it cleared — and a column of numbers hides that completely.

    Bars, not a line: these are counts in discrete hourly buckets, and a line
    between them would imply a rate that was never measured.
    """

    def __init__(self, width: float, buckets: list[dict]):
        super().__init__()
        self.width = width
        self.height = 46 * mm
        self.buckets = buckets

    def draw(self):
        canvas = self.canv
        if not self.buckets:
            canvas.setFillColor(MUTED)
            canvas.setFont("Helvetica-Oblique", 9)
            canvas.drawString(0, self.height / 2, "No scans in this period.")
            return

        plot_h = self.height - 9 * mm
        peak = max(b["total"] for b in self.buckets) or 1
        slot = self.width / len(self.buckets)
        bar_w = min(slot * 0.62, 9 * mm)

        # Baseline only. Gridlines would add ink for a chart whose exact values
        # are in the table two sections down.
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(0, 9 * mm, self.width, 9 * mm)

        for index, bucket in enumerate(self.buckets):
            centre = index * slot + slot / 2
            x = centre - bar_w / 2
            y = 9 * mm

            for key, tint in (
                ("valid", GOOD),
                ("duplicate", NEUTRAL),
                ("refused", CRIT),
            ):
                value = bucket.get(key, 0)
                if not value:
                    continue
                h = (value / peak) * plot_h
                canvas.setFillColor(tint)
                canvas.rect(x, y, bar_w, h, stroke=0, fill=1)
                y += h

            hour = dt.datetime.fromisoformat(bucket["hour"])
            # Every other label once the day is long, so they never collide.
            if len(self.buckets) <= 12 or index % 2 == 0:
                canvas.setFillColor(MUTED)
                canvas.setFont("Helvetica", 6.8)
                canvas.drawCentredString(centre, 4.6 * mm, f"{hour:%H}")

            if bucket["total"] == peak:
                canvas.setFillColor(INK)
                canvas.setFont("Helvetica-Bold", 7)
                canvas.drawCentredString(centre, y + 1.4 * mm, str(bucket["total"]))

        legend = [("Valid", GOOD), ("Duplicate", NEUTRAL), ("Refused", CRIT)]
        x = 0
        for label, tint in legend:
            canvas.setFillColor(tint)
            canvas.rect(x, 0.4 * mm, 2.6 * mm, 2.6 * mm, stroke=0, fill=1)
            canvas.setFillColor(MUTED)
            canvas.setFont("Helvetica", 7)
            canvas.drawString(x + 3.6 * mm, 0.8 * mm, label)
            x += canvas.stringWidth(label, "Helvetica", 7) + 12 * mm


def _table(data: list[list], widths: list[float], *, aligns=None) -> Table:
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.4),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("TEXTCOLOR", (0, 1), (-1, -1), INK),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        # Banding, so a wide row is followed across the page without a ruler.
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
    ]
    for column, align in (aligns or {}).items():
        style.append(("ALIGN", (column, 0), (column, -1), align))
    table.setStyle(TableStyle(style))
    return table


def build_document(
    queryset: QuerySet[ScanEvent],
    summary: dict,
    facts: dict,
    narrative: list[str],
    *,
    date_from: dt.date,
    date_to: dt.date,
) -> bytes:
    zone = event_timezone()
    styles = _styles()
    buffer = io.BytesIO()

    span = (
        f"{date_from:%d %B %Y}"
        if date_from == date_to
        else f"{date_from:%d %B %Y} — {date_to:%d %B %Y}"
    )
    generated = timezone.localtime(timezone.now(), zone)

    def chrome(canvas, document):
        """The shared report header on every page, and the page number at the foot.

        The header replaced a dark band that spent a strip of toner on every
        page; it is white with one navy bar, like every other report's.
        """
        draw_pdf_header(
            canvas,
            page_width=A4[0],
            page_height=A4[1],
            margin=PAGE_MARGIN,
            title=REPORT_TITLE,
            meta_left=f"{span}   ·   times in {zone}",
            meta_right=f"Generated {generated:%d %b %Y %H:%M}",
        )

        canvas.saveState()
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.6)
        canvas.drawCentredString(A4[0] / 2, 10 * mm, f"Page {document.page}")
        canvas.restoreState()

    frame = Frame(
        PAGE_MARGIN,
        14 * mm,
        A4[0] - 2 * PAGE_MARGIN,
        A4[1] - HEADER_H - 16 * mm,
        leftPadding=0,
        rightPadding=0,
        topPadding=2 * mm,
        bottomPadding=0,
        id="body",
    )
    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        title=f"Entrance report {span}",
        author="Visitor Management",
        pageTemplates=[PageTemplate(id="report", frames=[frame], onPage=chrome)],
    )

    width = A4[0] - 2 * PAGE_MARGIN
    story: list = []

    story.append(
        KpiBand(
            width,
            [
                ("Registered", str(facts["registered"]), INK),
                ("Arrived", str(facts["arrived"]), ACCENT),
                ("Attendance", f"{facts['attendance_rate']:g}%", GOOD),
                (
                    "Refused",
                    str(facts["refused"]),
                    CRIT if facts["refused"] else INK,
                ),
            ],
        )
    )
    story.append(Spacer(1, 7 * mm))

    story.append(Paragraph("What the numbers say", styles["h2"]))
    for line in narrative:
        story.append(Paragraph(line, styles["bullet"], bulletText="•"))
    story.append(Spacer(1, 5 * mm))

    story.append(
        KeepTogether(
            [
                Paragraph("Flow through the day", styles["h2"]),
                HourlyFlow(width, summary["by_hour"]),
            ]
        )
    )
    story.append(Spacer(1, 5 * mm))

    # --- outcomes -----------------------------------------------------------
    total = summary["total"] or 1
    rows = [["Outcome", "Scans", "Share"]]
    for result, label in RESULT_LABEL.items():
        count = summary["by_result"][result]
        rows.append([label, str(count), f"{count / total * 100:.1f}%"])

    outcomes = _table(rows, [width * 0.5, width * 0.25, width * 0.25], aligns={1: "RIGHT", 2: "RIGHT"})
    # Colour the outcome word itself — the report is read in black and white as
    # often as not, so the word carries the meaning and the tint only reinforces.
    for index, result in enumerate(RESULT_LABEL, start=1):
        outcomes.setStyle(TableStyle([("TEXTCOLOR", (0, index), (0, index), RESULT_COLOUR[result])]))

    story.append(KeepTogether([Paragraph("Outcomes", styles["h2"]), outcomes]))
    story.append(Spacer(1, 5 * mm))

    # --- doors --------------------------------------------------------------
    if facts["devices"]:
        rows = [["Door", "Scans", "Admitted", "Refused", "Share"]]
        for row in facts["devices"]:
            rows.append(
                [
                    row["device"],
                    str(row["total"]),
                    str(row["valid"]),
                    str(row["refused"]),
                    f"{row['share']:g}%",
                ]
            )
        story.append(
            KeepTogether(
                [
                    Paragraph("Load by door", styles["h2"]),
                    _table(
                        rows,
                        [width * 0.36, width * 0.16, width * 0.16, width * 0.16, width * 0.16],
                        aligns={1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT"},
                    ),
                ]
            )
        )
        story.append(Spacer(1, 5 * mm))

    # --- delegations ---------------------------------------------------------
    if summary["by_country"]:
        country_total = sum(r["total"] for r in summary["by_country"]) or 1
        rows = [["Country", "Scans", "Share"]]
        for row in summary["by_country"][:15]:
            rows.append(
                [
                    row["country"] or "Unknown",
                    str(row["total"]),
                    f"{row['total'] / country_total * 100:.1f}%",
                ]
            )
        heading = "Delegations"
        if len(summary["by_country"]) > 15:
            heading += f" (top 15 of {len(summary['by_country'])})"
        story.append(
            KeepTogether(
                [
                    Paragraph(heading, styles["h2"]),
                    _table(rows, [width * 0.5, width * 0.25, width * 0.25], aligns={1: "RIGHT", 2: "RIGHT"}),
                ]
            )
        )
        story.append(Spacer(1, 5 * mm))

    # --- refusals ------------------------------------------------------------
    refusals = list(
        queryset.filter(result__in=[ScanResult.INVALID, ScanResult.REVOKED])[:60]
    )
    if refusals:
        rows = [["Time", "Outcome", "Visitor", "Door"]]
        for scan in refusals:
            rows.append(
                [
                    f"{timezone.localtime(scan.scanned_at, zone):%d %b %H:%M}",
                    RESULT_LABEL.get(scan.result, scan.result),
                    scan.visitor.full_name if scan.visitor else "Unrecognised badge",
                    scan.device.name if scan.device else "",
                ]
            )
        story.append(
            KeepTogether(
                [
                    Paragraph("Refusals — the security record", styles["h2"]),
                    Paragraph(
                        "Every badge the doors turned away. A revoked badge is one "
                        "this system cancelled; an invalid badge matched nobody at all.",
                        styles["muted"],
                    ),
                    Spacer(1, 2 * mm),
                    _table(
                        rows,
                        [width * 0.18, width * 0.16, width * 0.42, width * 0.24],
                    ),
                ]
            )
        )
        story.append(Spacer(1, 5 * mm))

    # --- not arrived ---------------------------------------------------------
    if facts["not_arrived"]:
        story.append(PageBreak())
        story.append(Paragraph("Registered, not yet arrived", styles["h2"]))
        story.append(
            Paragraph(
                f"{facts['not_arrived_count']} of {facts['registered']} registered "
                "visitors have no valid scan in this period. During the event this "
                "is the call sheet; afterwards it is the no-show record.",
                styles["muted"],
            )
        )
        story.append(Spacer(1, 3 * mm))

        rows = [["Badge serial", "Full name", "Country", "Organisation", "Category"]]
        for visitor in facts["not_arrived"]:
            rows.append(
                [
                    visitor.badge_serial,
                    visitor.full_name,
                    visitor.country,
                    visitor.organization or "",
                    "VIP" if visitor.category == "vip" else "Normal",
                ]
            )
        story.append(
            _table(
                rows,
                [width * 0.18, width * 0.28, width * 0.18, width * 0.24, width * 0.12],
            )
        )

    document.build(story)
    return buffer.getvalue()
