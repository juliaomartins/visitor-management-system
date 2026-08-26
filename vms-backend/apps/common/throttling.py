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
    """Failed pairing attempts per IP on `/devices/pair`.

    The only endpoint reachable without a token, and it hands one out, so it needs
    a limit. But the obvious limit is the wrong one, and it was: every phone,
    screen and laptop at the event reaches the server through the same router, so
    a per-IP budget is shared by every device being set up — and counting
    SUCCESSES against it means a normal morning of pairing five doors locks the
    sixth out for an hour.

    So a successful pair clears the budget (see `forget`), and only failures
    accumulate. Legitimate setup never trips this no matter how many devices are
    paired; guessing at codes trips it quickly, which is the only thing it is
    there to stop.

    Brute force was never the real risk anyway: codes are six characters from a
    32-symbol alphabet, single-use, and dead after fifteen minutes.

    Keyed on the IP unconditionally — unlike `AnonRateThrottle`, presenting a JWT
    is not a way around it.
    """

    scope = "pairing"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }

    @classmethod
    def forget(cls, request) -> None:
        """Wipe this IP's failed-attempt history after a successful pair."""
        throttle = cls()
        key = throttle.get_cache_key(request, None)
        if key:
            throttle.cache.delete(key)
