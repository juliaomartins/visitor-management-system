"""Pairing and device lifecycle.

A device is paired exactly once: an admin generates a short code on the
dashboard, someone types it into the phone or the screen, and the device gets a
permanent token in return. The raw token is shown once — only its digest is
stored, exactly like a badge token.
"""

import logging
import secrets

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.common.utils import generate_token, hash_token

from .models import Device, DeviceKind, PairingCode

audit = logging.getLogger("vms.audit")

# No 0/O/1/I — someone reads this off a laptop and types it into a phone.
CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
CODE_LENGTH = 6
CODE_ATTEMPTS = 10


class PairingError(Exception):
    """The code cannot be redeemed. Carries a message meant for the device screen."""


def generate_pairing_code() -> str:
    """Return an unused 6-character code."""
    for _ in range(CODE_ATTEMPTS):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if not PairingCode.objects.filter(code=code).exists():
            return code
    raise RuntimeError(f"No free pairing code after {CODE_ATTEMPTS} attempts.")


def create_pairing_code(kind: str, *, actor=None) -> PairingCode:
    """Mint a code for a device of `kind`, valid for `DEVICE_PAIRING_CODE_TTL`."""
    pairing_code = PairingCode.objects.create(
        code=generate_pairing_code(),
        kind=kind,
        expires_at=timezone.now() + settings.DEVICE_PAIRING_CODE_TTL,
    )
    audit.info(
        "device.pairing_code actor=%s kind=%s code=%s",
        getattr(actor, "username", None) or "anonymous",
        kind,
        pairing_code.code,
    )
    return pairing_code


def default_device_name(kind: str) -> str:
    """`Scanner 3`, `Screen 1` — so the dashboard list is readable without input."""
    label = DeviceKind(kind).label
    return f"{label} {Device.objects.filter(kind=kind).count() + 1}"


def redeem_pairing_code(code: str, *, name: str = "") -> tuple[Device, str]:
    """Exchange a code for a device token. Returns (device, RAW token).

    Locked and single-use: two phones racing on the same code must not both end
    up paired. The raw token is the caller's only copy.
    """
    code = (code or "").strip().upper()

    with transaction.atomic():
        pairing_code = (
            PairingCode.objects.select_for_update().filter(code=code).first()
        )
        if pairing_code is None:
            raise PairingError("That pairing code is not valid.")
        if pairing_code.used_at is not None:
            raise PairingError("That pairing code has already been used.")
        if pairing_code.expires_at <= timezone.now():
            raise PairingError("That pairing code has expired.")

        raw_token = generate_token()
        device = Device.objects.create(
            name=(name or "").strip() or default_device_name(pairing_code.kind),
            kind=pairing_code.kind,
            token_hash=hash_token(raw_token),
        )

        pairing_code.used_at = timezone.now()
        pairing_code.save(update_fields=["used_at", "updated_at"])

    audit.info(
        "device.paired kind=%s id=%s name=%s code=%s",
        device.kind,
        device.pk,
        device.name,
        code,
    )
    return device, raw_token


def revoke_device(device: Device, *, actor=None) -> Device:
    """Kill a lost phone. Its scan history stays — that is the point of revoking."""
    if device.is_active:
        device.is_active = False
        device.save(update_fields=["is_active", "updated_at"])

    audit.info(
        "device.revoke actor=%s id=%s name=%s",
        getattr(actor, "username", None) or "anonymous",
        device.pk,
        device.name,
    )
    return device


# `last_seen_at` is a dashboard convenience, not an audit record. Writing it on
# every request would add a needless UPDATE to the scan hot path.
LAST_SEEN_RESOLUTION_SECONDS = 60


def touch_device(device: Device) -> None:
    """Record that a device just spoke to us.

    This is the only signal the dashboard has for whether a door is alive, so it
    has to be written from every path a device can reach: the HTTP authenticator
    for scans and the backfill, and the WebSocket consumer for a screen that is
    holding a socket open and therefore making no HTTP requests at all.

    Throttled, because a phone scanning steadily would otherwise write this row
    once per badge for no added information.
    """
    now = timezone.now()
    last = device.last_seen_at

    if last and (now - last).total_seconds() < LAST_SEEN_RESOLUTION_SECONDS:
        return

    device.last_seen_at = now
    device.save(update_fields=["last_seen_at", "updated_at"])
