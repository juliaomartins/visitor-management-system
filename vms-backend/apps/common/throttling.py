"""Rate limits.

Backed by the default `LocMemCache`, which lives inside the process — the same
single-process assumption the channel layer makes (CLAUDE.md constraint #1).
With one uvicorn worker the counters are exact. They would silently multiply by
N with N workers, which is one more reason never to add `--workers`.
"""

from rest_framework.throttling import SimpleRateThrottle


class ScanRateThrottle(SimpleRateThrottle):
    """30/min per paired device. A real guard does about 10.

    Keyed on the device, not the IP: every guard phone comes through the same
    router, and one jammed camera must not lock out the other doors.
    """

    scope = "scans"

    def get_cache_key(self, request, view):
        device = getattr(request, "auth", None)
        if device is None:
            return None  # unauthenticated — the permission layer rejects it first
        return self.cache_format % {"scope": self.scope, "ident": device.pk}


class PairingRateThrottle(SimpleRateThrottle):
    """5/hour per IP on `/devices/pair`.

    The only endpoint reachable without a token, and it hands one out. Keyed on
    the IP unconditionally — unlike `AnonRateThrottle`, presenting a JWT is not a
    way around it.
    """

    scope = "pairing"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }
