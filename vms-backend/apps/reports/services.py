"""The entrance log. No models — this app reads from `scans` and `visitors`.

This is two documents in one query, and that is deliberate. `ScanEvent` records
every badge presented, not only the ones that worked, so the same rows that answer
"who attended" also answer "what was refused at the door, when, and at which
one". Filtering the failures out of the default view would quietly turn a security
audit into an attendance sheet.

EVERY date here is interpreted in the event's timezone, never UTC. An hourly
bucket computed in the wrong zone is not obviously wrong — it just puts the
morning rush at midnight — so the zone is passed explicitly at every call rather
than inherited from whatever `TIME_ZONE` happens to be.
"""

import datetime as dt
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count, Q, QuerySet
from django.db.models.functions import TruncHour
from django.utils import timezone

from apps.scans.models import ScanEvent, ScanResult


def event_timezone() -> ZoneInfo:
    """The zone the doors are in. Asia/Dili unless overridden."""
    return ZoneInfo(settings.TIME_ZONE)


def today() -> dt.date:
    """Local today, which is not UTC today for nine hours of every day."""
    return timezone.localdate(timezone=event_timezone())


def day_bounds(day: dt.date) -> tuple[dt.datetime, dt.datetime]:
    """Local midnight to local midnight, as aware datetimes."""
    zone = event_timezone()
    start = dt.datetime.combine(day, dt.time.min, tzinfo=zone)
    return start, start + dt.timedelta(days=1)


def entry_log(
    *,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    country: str | None = None,
    category: str | None = None,
    result: str | None = None,
) -> QuerySet[ScanEvent]:
    """Every badge presented in the range, refusals included.

    `date_to` is inclusive: a report "from the 26th to the 26th" covers that whole
    day, because that is what a person asking for it means.

    Filtering by country or category necessarily excludes `invalid` scans — a
    forged badge resolves to nobody, so it has no country to match. That is
    correct, and it is why the default view applies neither.
    """
    queryset = (
        ScanEvent.objects.select_related("visitor", "device")
        .all()
        .order_by("-scanned_at", "-id")
    )

    if date_from is not None:
        queryset = queryset.filter(scanned_at__gte=day_bounds(date_from)[0])
    if date_to is not None:
        queryset = queryset.filter(scanned_at__lt=day_bounds(date_to)[1])

    if country:
        queryset = queryset.filter(visitor__country__iexact=country)
    if category:
        queryset = queryset.filter(visitor__category=category)
    if result:
        queryset = queryset.filter(result=result)

    return queryset


def counts_by_hour(queryset: QuerySet[ScanEvent]) -> list[dict]:
    """Arrivals per local hour, oldest first.

    `TruncHour` is given the zone explicitly. Left to the database default this
    would bucket in UTC and put a 09:00 arrival in the 00:00 column, which looks
    like a plausible chart rather than a broken one.
    """
    rows = (
        queryset.annotate(hour=TruncHour("scanned_at", tzinfo=event_timezone()))
        .values("hour")
        .annotate(
            total=Count("id"),
            valid=Count("id", filter=Q(result=ScanResult.VALID)),
            duplicate=Count("id", filter=Q(result=ScanResult.DUPLICATE)),
            # Refused, not merely "not valid": a duplicate is someone already
            # inside coming back through, which is not a refusal and must not be
            # counted as one on a chart the security review reads.
            refused=Count(
                "id",
                filter=Q(result__in=[ScanResult.INVALID, ScanResult.REVOKED]),
            ),
        )
        .order_by("hour")
    )

    return [
        {
            "hour": timezone.localtime(row["hour"], event_timezone()).isoformat(),
            "total": row["total"],
            "valid": row["valid"],
            "duplicate": row["duplicate"],
            "refused": row["refused"],
        }
        for row in rows
    ]


def counts_by_country(queryset: QuerySet[ScanEvent]) -> list[dict]:
    """Busiest countries first. Scans with no visitor are excluded, not zero-filled."""
    rows = (
        queryset.filter(visitor__isnull=False)
        .values("visitor__country")
        .annotate(total=Count("id"))
        .order_by("-total", "visitor__country")
    )
    return [{"country": row["visitor__country"], "total": row["total"]} for row in rows]


def counts_by_category(queryset: QuerySet[ScanEvent]) -> list[dict]:
    rows = (
        queryset.filter(visitor__isnull=False)
        .values("visitor__category")
        .annotate(total=Count("id"))
        .order_by("-total")
    )
    return [{"category": row["visitor__category"], "total": row["total"]} for row in rows]


def counts_by_result(queryset: QuerySet[ScanEvent]) -> dict:
    """One number per outcome, always all four keys.

    Zero-filled on purpose: an audit that shows `invalid: 0` has said something,
    whereas one that omits the key leaves the reader wondering whether it was
    counted at all.
    """
    counted = {
        row["result"]: row["total"]
        for row in queryset.values("result").annotate(total=Count("id"))
    }
    return {choice.value: counted.get(choice.value, 0) for choice in ScanResult}


def summarise(queryset: QuerySet[ScanEvent]) -> dict:
    """Everything the report header and chart need, from one filtered queryset."""
    return {
        "total": queryset.count(),
        # Distinct people, not distinct scans — someone who came back after lunch
        # is one attendee and two arrivals.
        "unique_visitors": queryset.filter(visitor__isnull=False)
        .values("visitor_id")
        .distinct()
        .count(),
        "by_result": counts_by_result(queryset),
        "by_hour": counts_by_hour(queryset),
        "by_country": counts_by_country(queryset),
        "by_category": counts_by_category(queryset),
    }
