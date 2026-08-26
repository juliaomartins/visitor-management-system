"""Visitor business logic. Views stay thin; this is where the rules live.

Two of these functions are load-bearing for the whole security model:

* ``issue_badge_token`` returns the raw token exactly once. Only its SHA-256
  digest is stored, so the printed card is the only copy that survives. The
  badge PDF must be generated from that return value at creation time
  (CLAUDE.md constraint #3) — phase 5 wires that in.
* ``revoke_badge`` kills a lost card without touching its scan history.
"""

import logging
import secrets

from django.db import transaction
from django.utils import timezone

from apps.common.utils import generate_token, hash_token

from .models import Visitor

audit = logging.getLogger("vms.audit")

# Crockford-ish: no 0/O/1/I, because staff read these serials aloud at a desk.
BADGE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
BADGE_PREFIX = "VMS"
SERIAL_ATTEMPTS = 10


class BadgeSerialExhausted(RuntimeError):
    """Could not find a free badge serial. Effectively impossible at 250 guests."""


def log_visitor_action(actor, action: str, visitor: Visitor, **extra) -> None:
    """Record an admin write against a visitor, with actor and timestamp.

    The timestamp comes from the log formatter. Deliberately a log line and not a
    table: nothing in the app reads this back, it exists for the after-event
    security review.
    """
    who = getattr(actor, "username", None) or "anonymous"
    detail = " ".join(f"{k}={v}" for k, v in extra.items())
    audit.info(
        "visitor.%s actor=%s id=%s serial=%s%s",
        action,
        who,
        visitor.pk,
        visitor.badge_serial,
        f" {detail}" if detail else "",
    )


def generate_badge_serial() -> str:
    """Return an unused human-readable serial, e.g. ``VMS-K7P-3QM``."""
    for _ in range(SERIAL_ATTEMPTS):
        body = "".join(secrets.choice(BADGE_ALPHABET) for _ in range(6))
        serial = f"{BADGE_PREFIX}-{body[:3]}-{body[3:]}"
        if not Visitor.objects.filter(badge_serial=serial).exists():
            return serial
    raise BadgeSerialExhausted(
        f"No free badge serial after {SERIAL_ATTEMPTS} attempts."
    )


def issue_badge_token(visitor: Visitor, *, save: bool = True) -> str:
    """Mint a fresh badge token for ``visitor`` and return the RAW value.

    The caller gets the only copy. Store it nowhere; print it into the QR and let
    it go. Calling this again invalidates the previous card automatically — the
    old digest is overwritten, so the old QR stops matching.
    """
    raw = generate_token()
    visitor.token_hash = hash_token(raw)
    if save:
        visitor.save(update_fields=["token_hash", "updated_at"])
    return raw


def register_visitor(validated_data: dict, *, actor=None) -> tuple[Visitor, str]:
    """Create a visitor with a serial and a badge token. Returns (visitor, raw token)."""
    visitor = Visitor(**validated_data)
    visitor.badge_serial = generate_badge_serial()
    raw_token = issue_badge_token(visitor, save=False)

    with transaction.atomic():
        visitor.save()

    log_visitor_action(actor, "create", visitor, category=visitor.category)
    return visitor, raw_token


def update_visitor(visitor: Visitor, validated_data: dict, *, actor=None) -> Visitor:
    """Apply an admin edit. The badge itself is untouched — serial and token stand."""
    for field, value in validated_data.items():
        setattr(visitor, field, value)
    visitor.save()

    log_visitor_action(
        actor, "update", visitor, fields=",".join(sorted(validated_data)) or "-"
    )
    return visitor


def revoke_badge(visitor: Visitor, *, actor=None) -> Visitor:
    """Kill a lost card. The next scan of it logs a `revoked` event, not a welcome.

    The scan history stays: the point of revoking is that you still want to see
    where that badge turns up afterwards.
    """
    if visitor.is_active:
        visitor.is_active = False
        visitor.save(update_fields=["is_active", "updated_at"])

    log_visitor_action(actor, "revoke", visitor)
    return visitor


def soft_delete_visitor(visitor: Visitor, *, actor=None) -> Visitor:
    """Remove a registration from the dashboard without dropping the row.

    ``ScanEvent.visitor`` is PROTECT, so a real DELETE would fail the moment the
    visitor has been scanned. The badge is revoked at the same time — a deleted
    registration must not still open the door.
    """
    if visitor.deleted_at is None:
        visitor.deleted_at = timezone.now()
        visitor.is_active = False
        visitor.save(update_fields=["deleted_at", "is_active", "updated_at"])

    log_visitor_action(actor, "delete", visitor)
    return visitor
