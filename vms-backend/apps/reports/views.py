"""The entrance log.

    GET /api/v1/reports/entries      [admin]  log + totals, JSON
    GET /api/v1/reports/entries.csv  [admin]  the same rows, streamed as CSV

Both default to today in the event's timezone, because that is what someone
standing at the desk means when they open the report.
"""

import datetime as dt

from django.http import HttpResponse, StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.scans.models import ScanResult
from apps.visitors.models import VisitorCategory

from . import analysis, document, exporters, services, workbook
from .serializers import EntryReportSerializer, EntrySerializer

FILTER_PARAMS = [
    OpenApiParameter(
        "from",
        OpenApiTypes.DATE,
        description="First day to include, inclusive. Defaults to today.",
    ),
    OpenApiParameter(
        "to",
        OpenApiTypes.DATE,
        description="Last day to include, inclusive. Defaults to today.",
    ),
    OpenApiParameter(
        "country",
        OpenApiTypes.STR,
        description=(
            "Exact country, case-insensitive. Excludes `invalid` scans, which "
            "match no visitor and so have no country."
        ),
    ),
    OpenApiParameter(
        "category",
        OpenApiTypes.STR,
        enum=[choice.value for choice in VisitorCategory],
        description="Visitor category. Also excludes `invalid` scans.",
    ),
    OpenApiParameter(
        "result",
        OpenApiTypes.STR,
        enum=[choice.value for choice in ScanResult],
        description="Scan outcome. Omit to see every badge presented.",
    ),
]


def _parse_date(raw: str | None, field: str, fallback: dt.date) -> dt.date:
    if not raw:
        return fallback
    try:
        return dt.date.fromisoformat(raw)
    except ValueError:
        raise ValidationError({field: ["Expected a date as YYYY-MM-DD."]}) from None


def _filters(request) -> dict:
    params = request.query_params
    default = services.today()

    date_from = _parse_date(params.get("from"), "from", default)
    date_to = _parse_date(params.get("to"), "to", default)

    if date_to < date_from:
        raise ValidationError({"to": ["The end of the range is before its start."]})

    return {
        "date_from": date_from,
        "date_to": date_to,
        "country": params.get("country") or None,
        "category": params.get("category") or None,
        "result": params.get("result") or None,
    }


class EntryReportView(APIView):
    """Who came through, and what was turned away."""

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="reports_entries_retrieve",
        summary="Entrance log with totals",
        description=(
            "Every badge presented in the range — `valid`, `duplicate`, `revoked` "
            "and `invalid` alike. This is the security audit as well as the "
            "attendance record, so refusals are in the default view rather than "
            "behind a filter.\n\n"
            "Hours are bucketed in the event's timezone, which the response names "
            "in `timezone`. Unfiltered and unpaginated: a day of a 250-visitor "
            "event is a few thousand rows on a LAN."
        ),
        parameters=FILTER_PARAMS,
        responses={200: EntryReportSerializer},
        tags=["reports"],
    )
    def get(self, request):
        filters, queryset, summary, facts, lines = _report_payload(request)

        return Response(
            EntryReportSerializer(
                {
                    "timezone": str(services.event_timezone()),
                    "date_from": filters["date_from"],
                    "date_to": filters["date_to"],
                    "summary": summary,
                    "insights": _insights_payload(facts, lines),
                    "entries": queryset,
                }
            ).data
        )


class EntryCsvView(APIView):
    """The same rows, for a spreadsheet."""

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="reports_entries_csv_retrieve",
        summary="Export the entrance log as CSV",
        description=(
            "The same filters as `/reports/entries`. Timestamps are in the event's "
            "timezone with the offset attached; visitor columns are blank for an "
            "`invalid` scan, which matched no badge."
        ),
        parameters=FILTER_PARAMS,
        responses={
            200: OpenApiResponse(OpenApiTypes.BINARY, description="text/csv")
        },
        tags=["reports"],
    )
    def get(self, request):
        queryset = services.entry_log(**_filters(request))

        response = StreamingHttpResponse(
            exporters.entries_csv(queryset), content_type="text/csv; charset=utf-8"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{exporters.csv_filename()}"'
        )
        return response


XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _insights_payload(facts: dict, lines: list[str]) -> dict:
    """Flatten the analysis into the shape the serializer declares.

    `analysis.build` nests by topic because that is how the PDF reads it; the API
    is flat because a nested `window.median` is awkward to type against and adds
    nothing. One mapping, in one place, rather than the dashboard guessing.
    """
    window = facts["window"]
    peak = facts["peak"]

    return {
        "registered": facts["registered"],
        "arrived": facts["arrived"],
        "attendance_rate": facts["attendance_rate"],
        "refused": facts["refused"],
        "refusal_rate": facts["refusal_rate"],
        "quiet_hours": facts["quiet_hours"],
        "not_arrived_count": facts["not_arrived_count"],
        "first_arrival": window["first"],
        "last_arrival": window["last"],
        "median_arrival": window["median"],
        "span_minutes": window["span_minutes"],
        "peak_hour": peak["hour"] if peak else None,
        "peak_total": peak["total"] if peak else 0,
        "peak_share": peak["share"] if peak else 0.0,
        "vip_arrived": facts["categories"]["vip"],
        "vip_share": facts["categories"]["vip_share"],
        "repeat_people": facts["repeats"]["repeat_people"],
        "repeat_share": facts["repeats"]["repeat_share"],
        "doors": facts["devices"],
        "not_arrived": [
            {
                "badge_serial": visitor.badge_serial,
                "full_name": visitor.full_name,
                "country": visitor.country,
                "organization": visitor.organization or "",
                "category": visitor.category,
            }
            for visitor in facts["not_arrived"]
        ],
        "narrative": lines,
    }


def _report_payload(request):
    """The filtered log plus everything derived from it, computed once.

    All three exports and the JSON endpoint go through here, so a figure in the
    PDF, a cell in the workbook and a number on the dashboard cannot disagree —
    they are the same objects.
    """
    filters = _filters(request)
    queryset = services.entry_log(**filters)
    summary = services.summarise(queryset)
    facts = analysis.build(queryset, summary)
    lines = analysis.narrative(summary, facts)
    return filters, queryset, summary, facts, lines


def _stamp(date_from, date_to) -> str:
    return (
        f"{date_from:%Y-%m-%d}"
        if date_from == date_to
        else f"{date_from:%Y-%m-%d}_{date_to:%Y-%m-%d}"
    )


class EntryWorkbookView(APIView):
    """The report as a six-sheet workbook."""

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="reports_entries_xlsx_retrieve",
        summary="Export the entrance report as .xlsx",
        description=(
            "The same filters as `/reports/entries`, as a workbook: a summary with "
            "the written findings, hourly flow with a chart, delegations, load by "
            "door, the registered visitors who never arrived, and the full log.\n\n"
            "Figures are written as numbers, not text, so they can be pivoted "
            "without cleaning the file first."
        ),
        parameters=FILTER_PARAMS,
        responses={200: OpenApiResponse(OpenApiTypes.BINARY, description="xlsx")},
        tags=["reports"],
    )
    def get(self, request):
        filters, queryset, summary, facts, lines = _report_payload(request)

        content = workbook.build_workbook(
            queryset,
            summary,
            facts,
            lines,
            date_from=filters["date_from"],
            date_to=filters["date_to"],
        )

        response = HttpResponse(content, content_type=XLSX)
        name = f"vms-entrance-report-{_stamp(filters['date_from'], filters['date_to'])}.xlsx"
        response["Content-Disposition"] = f'attachment; filename="{name}"'
        return response


class EntryDocumentView(APIView):
    """The report as a PDF somebody can hand to a client."""

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="reports_entries_pdf_retrieve",
        summary="Export the entrance report as PDF",
        description=(
            "The same filters as `/reports/entries`, as a designed document: the "
            "headline figures, the findings in sentences, the shape of the day, "
            "then the tables. Built with ReportLab, so it renders identically "
            "wherever the server runs."
        ),
        parameters=FILTER_PARAMS,
        responses={200: OpenApiResponse(OpenApiTypes.BINARY, description="application/pdf")},
        tags=["reports"],
    )
    def get(self, request):
        filters, queryset, summary, facts, lines = _report_payload(request)

        content = document.build_document(
            queryset,
            summary,
            facts,
            lines,
            date_from=filters["date_from"],
            date_to=filters["date_to"],
        )

        response = HttpResponse(content, content_type="application/pdf")
        name = f"vms-entrance-report-{_stamp(filters['date_from'], filters['date_to'])}.pdf"
        # `inline` so it previews in a tab; a report is read before it is filed.
        response["Content-Disposition"] = f'inline; filename="{name}"'
        return response
