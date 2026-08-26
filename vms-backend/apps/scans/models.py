"""Arrival events. One row per badge presented, valid or not."""

from django.db import models

from apps.common.models import TimeStampedModel


class ScanResult(models.TextChoices):
    VALID = "valid", "Valid"
    INVALID = "invalid", "Invalid"
    REVOKED = "revoked", "Revoked"
    DUPLICATE = "duplicate", "Duplicate"


class ScanEvent(TimeStampedModel):
    """A guard scanned a badge.

    The primary key is a BigAutoField rather than the project's usual UUID: the
    lobby screen backfills with `?since=<last_id>`, which needs a monotonic
    cursor. `id` IS the event_id.

    Failed scans are logged too, with `visitor` null — one table serves both the
    entrance report and the security audit.
    """

    id = models.BigAutoField(primary_key=True)
    # Generated on the device before the scan is sent, so a replay after a lost
    # response is recognised instead of recorded twice. Nullable because scans
    # predating the offline queue have none, and because a client may omit it —
    # Postgres allows many NULLs in a unique column. `unique=True` already builds
    # the index; a separate db_index would be a second, redundant one.
    client_uuid = models.UUIDField(null=True, blank=True, unique=True)
    visitor = models.ForeignKey(
        "visitors.Visitor",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="scan_events",
    )
    device = models.ForeignKey(
        "devices.Device",
        on_delete=models.PROTECT,
        related_name="scan_events",
    )
    # Sent by the device, not the server — the scanner queues offline and syncs later.
    scanned_at = models.DateTimeField(db_index=True)
    result = models.CharField(max_length=10, choices=ScanResult.choices)

    class Meta:
        ordering = ("-scanned_at", "-id")
        indexes = [
            models.Index(fields=["result"]),
            models.Index(fields=["visitor", "scanned_at"]),
        ]

    def __str__(self) -> str:
        who = self.visitor.full_name if self.visitor else "unknown badge"
        return f"#{self.id} {who} — {self.result}"
