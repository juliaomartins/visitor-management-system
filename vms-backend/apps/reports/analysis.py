"""Findings, not just counts.

`services.summarise()` answers "how many". This answers "so what" — the questions
somebody actually asks when the report lands on their desk:

    Did the people we registered turn up?
    When did the queue form, and when did it clear?
    Which door carried the event, and was any door idle?
    Was anything turned away, and was that one confused guest or a pattern?
    Who never came at all?

Every figure here is derived from the same filtered queryset the log and the CSV
use, so a number in the PDF and a row in the spreadsheet cannot disagree. None of
it is stored: this is read-only analysis, computed per request.
"""

import datetime as dt
from collections import Counter

from django.db.models import Count, Q, QuerySet

from apps.scans.models import ScanEvent, ScanResult
from apps.visitors.models import Visitor, VisitorCategory

from .services import event_timezone

# Below this many scans the derived rates say more about the sample than the
# event, so the narrative holds its tongue rather than reporting noise as insight.
MIN_SCANS_FOR_NARRATIVE = 5


def _percent(part: int, whole: int) -> float:
    return round((part / whole) * 100, 1) if whole else 0.0


def registered_total() -> int:
    """Everyone on the list, deleted visitors excluded."""
    return Visitor.objects.filter(deleted_at__isnull=True).count()


def arrival_window(queryset: QuerySet[ScanEvent]) -> dict:
    """First and last valid arrival, and how long the doors were actually working.

    Valid scans only. A refusal at 07:00 is not the doors opening, and letting one
    set the start of the window would report an hour of activity that never
    happened.
    """
    zone = event_timezone()
    stamps = list(
        queryset.filter(result=ScanResult.VALID)
        .order_by("scanned_at")
        .values_list("scanned_at", flat=True)
    )

    if not stamps:
        return {"first": None, "last": None, "span_minutes": 0, "median": None}

    first, last = stamps[0], stamps[-1]
    # The median arrival is the moment half the room was in — a far better handle
    # on "when was it busy" than the mean, which one late straggler drags for an
    # hour.
    median = stamps[len(stamps) // 2]

    return {
        "first": first.astimezone(zone),
        "last": last.astimezone(zone),
        "median": median.astimezone(zone),
        "span_minutes": int((last - first).total_seconds() // 60),
    }


def peak_hour(by_hour: list[dict]) -> dict | None:
    """The busiest hour, and what share of the day passed through it."""
    if not by_hour:
        return None

    total = sum(bucket["total"] for bucket in by_hour)
    busiest = max(by_hour, key=lambda bucket: bucket["total"])

    return {
        "hour": busiest["hour"],
        "total": busiest["total"],
        "valid": busiest["valid"],
        "share": _percent(busiest["total"], total),
    }


def quiet_hours(by_hour: list[dict]) -> int:
    """Hourly slots inside the working window that saw nothing.

    Counted between the first and last ACTIVE slot only — the eleven hours before
    the doors opened are not "quiet", they are closed, and reporting them as
    downtime would be a lie about the day.

    Works on the full timestamp, not the hour-of-day. Taking `.hour` collapsed
    every day in a multi-day range onto one 24-hour clock, so a three-day report
    counted the same quiet afternoon three times and called it one.
    """
    if len(by_hour) < 2:
        return 0

    slots = sorted(dt.datetime.fromisoformat(bucket["hour"]) for bucket in by_hour)
    span_hours = int((slots[-1] - slots[0]).total_seconds() // 3600) + 1
    return max(span_hours - len(slots), 0)


def by_device(queryset: QuerySet[ScanEvent]) -> list[dict]:
    """Load per door, busiest first.

    Refusals are broken out per device on purpose: one door turning away five
    badges is a door with a problem, and that is invisible in a single event-wide
    refusal figure.
    """
    rows = (
        queryset.values("device__name")
        .annotate(
            total=Count("id"),
            valid=Count("id", filter=Q(result=ScanResult.VALID)),
            refused=Count(
                "id",
                filter=Q(result__in=[ScanResult.INVALID, ScanResult.REVOKED]),
            ),
        )
        .order_by("-total")
    )

    grand = sum(row["total"] for row in rows) or 1
    return [
        {
            "device": row["device__name"] or "Unknown device",
            "total": row["total"],
            "valid": row["valid"],
            "refused": row["refused"],
            "share": _percent(row["total"], grand),
        }
        for row in rows
    ]


def repeat_visitors(queryset: QuerySet[ScanEvent]) -> dict:
    """How many people came through more than once.

    A duplicate scan is not a fault — it is somebody leaving and coming back, or
    passing a second door. Reported separately so it never lands in the refusal
    figure a security review reads.
    """
    counts = Counter(
        queryset.filter(result__in=[ScanResult.VALID, ScanResult.DUPLICATE])
        .exclude(visitor__isnull=True)
        .values_list("visitor_id", flat=True)
    )

    repeats = {visitor: n for visitor, n in counts.items() if n > 1}
    return {
        "people": len(counts),
        "repeat_people": len(repeats),
        "repeat_share": _percent(len(repeats), len(counts)),
        "busiest_pass_count": max(counts.values(), default=0),
    }


def not_arrived(queryset: QuerySet[ScanEvent]) -> list[Visitor]:
    """Registered, still not through the door.

    The single most useful list in the report and the one nothing else produces:
    at a live event it is the call sheet, and afterwards it is the no-show record.
    """
    arrived = set(
        queryset.filter(result=ScanResult.VALID)
        .exclude(visitor__isnull=True)
        .values_list("visitor_id", flat=True)
    )

    return list(
        Visitor.objects.filter(deleted_at__isnull=True)
        .exclude(id__in=arrived)
        .order_by("category", "full_name")
    )


def category_split(queryset: QuerySet[ScanEvent]) -> dict:
    """VIP versus everyone else, among people who actually arrived."""
    arrived = queryset.filter(result=ScanResult.VALID).exclude(visitor__isnull=True)

    # `.order_by()` FIRST, and it is load-bearing.
    #
    # entry_log() orders by scanned_at and id, and Django puts ORDER BY columns
    # into SELECT DISTINCT — so without clearing it, every scan comes back as its
    # own "distinct person" and a VIP who scanned four times counts four times.
    # `.count()` hides this because it wraps the query in a subquery; iterating
    # does not. This reported 8 VIP guests at an event with 2.
    people = arrived.order_by().values("visitor_id", "visitor__category").distinct()

    counts = Counter(row["visitor__category"] for row in people)
    total = sum(counts.values())

    return {
        "vip": counts.get(VisitorCategory.VIP, 0),
        "normal": counts.get(VisitorCategory.NORMAL, 0),
        "vip_share": _percent(counts.get(VisitorCategory.VIP, 0), total),
    }


def build(queryset: QuerySet[ScanEvent], summary: dict) -> dict:
    """Everything the workbook and the document draw from, computed once."""
    registered = registered_total()
    arrived = summary["unique_visitors"]
    refused = summary["by_result"]["invalid"] + summary["by_result"]["revoked"]

    absent = not_arrived(queryset)

    return {
        "registered": registered,
        "arrived": arrived,
        "attendance_rate": _percent(arrived, registered),
        "refused": refused,
        "refusal_rate": _percent(refused, summary["total"]),
        "window": arrival_window(queryset),
        "peak": peak_hour(summary["by_hour"]),
        "quiet_hours": quiet_hours(summary["by_hour"]),
        "devices": by_device(queryset),
        "repeats": repeat_visitors(queryset),
        "categories": category_split(queryset),
        "not_arrived": absent,
        "not_arrived_count": len(absent),
    }


def narrative(summary: dict, facts: dict) -> list[str]:
    """The report in sentences.

    A customer reads prose before they read a table, so the findings that matter
    are written out. Each line is generated from the figures above — none of it is
    boilerplate, and a claim only appears when the data supports it.
    """
    lines: list[str] = []
    total = summary["total"]

    if total == 0:
        return ["No badges were presented in this period."]

    if facts["registered"]:
        lines.append(
            f"{facts['arrived']} of {facts['registered']} registered visitors came "
            f"through the door — {facts['attendance_rate']}% attendance."
        )

    window = facts["window"]
    if window["first"] and window["last"]:
        multi_day = window["first"].date() != window["last"].date()

        if multi_day:
            # "Doors ran from 23:48 to 09:47" is nonsense across three days; over a
            # range the useful facts are the endpoints and the midpoint, dated.
            lines.append(
                f"Arrivals ran from {window['first']:%d %b %H:%M} to "
                f"{window['last']:%d %b %H:%M}, with the halfway point at "
                f"{window['median']:%d %b %H:%M}."
            )
        elif window["span_minutes"] >= 1:
            lines.append(
                f"Doors ran from {window['first']:%H:%M} to {window['last']:%H:%M}, "
                f"{window['span_minutes'] // 60}h {window['span_minutes'] % 60}m, "
                f"with half the room in by {window['median']:%H:%M}."
            )
        else:
            lines.append(f"All arrivals landed at {window['first']:%H:%M}.")

    peak = facts["peak"]
    if peak and total >= MIN_SCANS_FOR_NARRATIVE:
        hour = dt.datetime.fromisoformat(peak["hour"])
        stamp = (
            f"{hour:%d %b %H:%M}"
            if window["first"]
            and window["last"]
            and window["first"].date() != window["last"].date()
            else f"{hour:%H:%M}"
        )
        lines.append(
            f"The busiest hour was {stamp}, carrying {peak['total']} scans — "
            f"{peak['share']}% of the whole period."
        )

    # Only claimed for a single day. Over a longer range the idle hours are
    # mostly overnight, and calling a closed building "understaffed" would be
    # advice nobody should act on.
    single_day = bool(
        window["first"]
        and window["last"]
        and window["first"].date() == window["last"].date()
    )
    if facts["quiet_hours"] and single_day:
        hours = facts["quiet_hours"]
        lines.append(
            f"{hours} hour{'s' if hours != 1 else ''} inside the working window saw "
            "no activity at all, which is where staffing could be thinned."
        )

    devices = facts["devices"]
    if len(devices) > 1:
        busiest = devices[0]
        lines.append(
            f"{busiest['device']} handled the most traffic at {busiest['total']} "
            f"scans ({busiest['share']}%), against {len(devices)} doors in total."
        )
    elif devices:
        lines.append(
            f"All {devices[0]['total']} scans came through a single door, "
            f"{devices[0]['device']}."
        )

    categories = facts["categories"]
    if categories["vip"]:
        lines.append(
            f"{categories['vip']} VIP guests arrived, {categories['vip_share']}% "
            "of everyone admitted."
        )

    repeats = facts["repeats"]
    if repeats["repeat_people"]:
        lines.append(
            f"{repeats['repeat_people']} people ({repeats['repeat_share']}%) "
            "presented a badge more than once — re-entries, not refusals."
        )

    if facts["refused"]:
        lines.append(
            f"{facts['refused']} badge(s) were turned away, {facts['refusal_rate']}% "
            "of everything presented. Each one is listed in the refusals section."
        )
    else:
        lines.append("No badge was refused at any door in this period.")

    if facts["not_arrived_count"]:
        lines.append(
            f"{facts['not_arrived_count']} registered visitors have still not "
            "arrived; they are listed at the end."
        )

    return lines
