"""The entrance log.

    GET /api/v1/reports/entries      [admin]  log + totals, JSON
    GET /api/v1/reports/entries.csv  [admin]  the same rows, streamed as CSV

Both default to today in the event's timezone, because that is what someone
standing at the desk means when they open the report.
"""

import datetime as dt

from django.http import StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.scans.models import ScanResult
from apps.visitors.models import VisitorCategory

from . import exporters, services
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
        filters = _filters(request)
        queryset = services.entry_log(**filters)

        return Response(
            {
                "timezone": str(services.event_timezone()),
                "date_from": filters["date_from"],
                "date_to": filters["date_to"],
                "summary": services.summarise(queryset),
                "entries": EntrySerializer(queryset, many=True).data,
            }
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
