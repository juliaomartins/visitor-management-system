"""Shared permission classes.

Every admin-facing endpoint is staff-only. `User` exists for dashboard
administrators and nobody else — visitors carry a printed badge, guards carry a
paired device (CLAUDE.md constraint #4).
"""

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Authenticated staff account. Used by every `[admin]` route."""

    message = "Administrator access required."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            return False
        # getattr, not attribute access: a Device can also be request.user.
        return bool(getattr(user, "is_active", False) and getattr(user, "is_staff", False))


class IsDevice(BasePermission):
    """Any active paired device. Subclass and set `kind` to narrow it."""

    message = "A paired device token is required."
    kind: str | None = None

    def has_permission(self, request, view) -> bool:
        device = getattr(request, "auth", None)
        if device is None or not getattr(device, "is_active", False):
            return False
        return self.kind is None or device.kind == self.kind


class IsScannerDevice(IsDevice):
    """A guard phone. Screens must not be able to POST scans."""

    message = "A paired scanner device is required."
    kind = "scanner"


class IsScreenDevice(IsDevice):
    """The lobby display. Its token is read-only and scoped to the feed.

    Assume the token gets extracted — the screen sits in a public lobby.
    """

    message = "A paired screen device is required."
    kind = "screen"
