"""Ceilings for the walk-in desk.

KEYED ON THE DEVICE, NOT THE ADDRESS. Every desk at the event shares the
router's address, and the desk laptop's requests reach uvicorn through the
dashboard's proxy from 127.0.0.1 anyway -- an address key would throttle one
desk out because another was busy. The device token is the one thing that
identifies a desk, and it is also the thing an admin can revoke.

The numbers are a ceiling on damage, not a target. A real desk registers a
visitor every minute or two at its busiest; 120 an hour is far above that and
still low enough that a stolen token cannot fill the roster before somebody
notices the count moving on the dashboard.
"""

from rest_framework.throttling import SimpleRateThrottle


class DeskThrottle(SimpleRateThrottle):
    """Per paired desk device."""

    def get_cache_key(self, request, view):
        device = getattr(request, "auth", None)
        if device is None:
            return None  # unauthenticated requests are refused before this
        return self.cache_format % {"scope": self.scope, "ident": device.pk}


class DeskRegistrationThrottle(DeskThrottle):
    scope = "desk_registration"


class DeskQrThrottle(DeskThrottle):
    """Drawing a QR is cheap, and one registration can ask for it several times
    (the visitor re-photographs it, the staff member re-opens the screen)."""

    scope = "desk_qr"
