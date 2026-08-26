"""CSV export of the entrance log.

Streamed rather than assembled in memory. A day of a 250-visitor event is a few
thousand rows, which would fit comfortably in a string — but the export is the
thing someone reaches for at the end of a long day when the table is at its
largest, and a generator costs nothing to write.

Timestamps are written in the event's local zone with the offset attached. A bare
local time would be ambiguous in a spreadsheet; a UTC time would have every
morning arrival showing as the previous evening.
"""

import csv
from typing import Iterator

from django.db.models import QuerySet
from django.utils import timezone

from apps.scans.models import ScanEvent

from .services import event_timezone

HEADERS = [
    "scanned_at",
    "result",
    "full_name",
    "country",
    "organization",
    "category",
    "badge_serial",
    "device",
    "event_id",
]


class _Echo:
    """A file-like object that returns what it is asked to write.

    `csv.writer` insists on writing somewhere; this hands each formatted row
    straight back to the generator instead of buffering it.
    """

    def write(self, value: str) -> str:
        return value


def entries_csv(queryset: QuerySet[ScanEvent]) -> Iterator[str]:
    """Yield the log a row at a time, header first."""
    writer = csv.writer(_Echo())
    zone = event_timezone()

    yield writer.writerow(HEADERS)

    # `.iterator()` so a long day is never all in memory at once.
    for scan in queryset.iterator(chunk_size=500):
        visitor = scan.visitor

        yield writer.writerow(
            [
                timezone.localtime(scan.scanned_at, zone).isoformat(),
                scan.result,
                # Blank rather than "unknown": an invalid scan matched no badge,
                # and inventing a placeholder would put a word in a column that a
                # spreadsheet filter would then treat as a name.
                visitor.full_name if visitor else "",
                visitor.country if visitor else "",
                visitor.organization if visitor else "",
                visitor.category if visitor else "",
                visitor.badge_serial if visitor else "",
                scan.device.name,
                scan.id,
            ]
        )


def csv_filename(prefix: str = "entrance-log") -> str:
    return f"{prefix}-{timezone.localdate(timezone=event_timezone()).isoformat()}.csv"
