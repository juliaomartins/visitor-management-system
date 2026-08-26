"""Scan validation. The one piece of logic the whole event depends on.

Every badge presented produces a row, valid or not — one table serves both the
entrance report and the security audit. `/scans` never returns 4xx for a bad
badge: a revoked card is a business outcome, and the guard's phone should render
a red screen, not an error handler.

Four outcomes:

    valid      active badge, first time inside the dedupe window
    duplicate  same visitor again within SCAN_DUPLICATE_WINDOW
    revoked    the badge exists but has been killed (or the visitor was deleted)
    invalid    nothing matches that token — a forged or foreign QR
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.common.utils import hash_token
from apps.visitors.models import Visitor

from .models import ScanEvent, ScanResult
from .serializers import ScreenEventSerializer

audit = logging.getLogger("vms.audit")


def resolve_visitor(raw_token: str) -> Visitor | None:
    """Look a badge up by its QR token.

    The lookup is on the digest, never on an id: the QR carries an opaque random
    token precisely so a photographed badge cannot be edited into someone else's
    (CLAUDE.md constraint #3).
    """
    if not raw_token:
        return None
    return Visitor.objects.filter(token_hash=hash_token(raw_token)).first()


def is_duplicate(visitor: Visitor, scanned_at) -> bool:
    """Has this visitor already been welcomed inside the dedupe window?

    Measured against the previous *accepted* arrival, so a badge presented at
    0s / 30s / 70s reads valid, duplicate, valid. Only earlier scans count —
    the offline queue can deliver out of order, and a later sync must not
    retroactively invalidate an arrival that already went up on the screen.
    """
    window_start = scanned_at - settings.SCAN_DUPLICATE_WINDOW
    return ScanEvent.objects.filter(
        visitor=visitor,
        result=ScanResult.VALID,
        scanned_at__gt=window_start,
        scanned_at__lte=scanned_at,
    ).exists()


def classify(visitor: Visitor | None, scanned_at) -> str:
    """Decide the outcome for a resolved badge. No writes."""
    if visitor is None:
        return ScanResult.INVALID
    if not visitor.is_active or visitor.deleted_at is not None:
        return ScanResult.REVOKED
    if is_duplicate(visitor, scanned_at):
        return ScanResult.DUPLICATE
    return ScanResult.VALID



def _publish_arrival(scan: ScanEvent) -> None:
    """Push a valid arrival to every connected lobby screen.

    The `group_send` goes inside `transaction.on_commit` (CLAUDE.md constraint
    #5). Outside it, a scan that later rolls back has already been broadcast, and
    the screen welcomes a visitor who is not in the database.

    The payload is serialized now, not in the callback: by the time on_commit
    runs the transaction is closed, and a lazy serializer would be issuing
    queries from outside it.

    This is the fast path (~200ms), not the reliable one. `InMemoryChannelLayer`
    has no queue behind it — restart the server and every group membership is
    gone along with anything sent in those seconds. `/screen/feed?since=` is what
    makes that survivable, which is why both exist (constraint #6).
    """
    payload = ScreenEventSerializer(scan).data

    transaction.on_commit(
        lambda: async_to_sync(get_channel_layer().group_send)(
            "lobby_screens",
            {"type": "visitor.arrived", "payload": payload},
        )
    )


def record_scan(*, raw_token: str, device, scanned_at=None, client_uuid=None) -> ScanEvent:
    """Validate a badge and log the attempt. Always returns a row.

    `scanned_at` comes from the device, not the server: the scanner queues
    offline and syncs later, so the time the badge was presented is the only
    time worth recording.

    `client_uuid` makes the call idempotent. The offline queue retries until the
    server confirms, and a request that lands but whose response is lost would
    otherwise be replayed into a second ScanEvent — one presentation of one card
    counted twice in the entrance report. Replaying returns the original row
    with its original verdict, and deliberately does not broadcast again: the
    lobby screen already welcomed that visitor.
    """
    if client_uuid:
        existing = ScanEvent.objects.filter(client_uuid=client_uuid).first()
        if existing is not None:
            return existing

    scanned_at = scanned_at or timezone.now()

    visitor = resolve_visitor(raw_token)
    result = classify(visitor, scanned_at)

    try:
        with transaction.atomic():
            scan = ScanEvent.objects.create(
                visitor=visitor,
                device=device,
                scanned_at=scanned_at,
                result=result,
                client_uuid=client_uuid,
            )
            if result == ScanResult.VALID:
                _publish_arrival(scan)
    except IntegrityError:
        # Two retries of the same queued scan raced past the check above. The
        # row the winner wrote is the authoritative one; the atomic block rolled
        # this attempt back, so nothing was broadcast for it either.
        existing = ScanEvent.objects.filter(client_uuid=client_uuid).first()
        if existing is None:
            raise
        return existing

    if result != ScanResult.VALID:
        # Failed scans are the interesting half of the security review.
        audit.info(
            "scan.%s device=%s event=%s visitor=%s",
            result,
            device.pk,
            scan.pk,
            visitor.pk if visitor else "-",
        )

    return scan
