"""Rate limits on the two endpoints anyone can reach.

    public_registration          10/hour per client address, every POST
    public_registration_global   200/hour across all clients, every POST
    public_status                60/min per client address

WHY TWO LIMITS ON ONE ENDPOINT. One person registers once; ten an hour covers a
helper registering a family from one phone. But `settings/base.py` records that
devices at the event may all reach the server through the router's single
address -- and public requests also arrive through the dashboard's rewrite
proxy. If either collapses every phone onto one address, a per-client limit
alone would lock out the whole queue after ten registrations. The global cap is
what protects the single uvicorn process regardless of how addresses resolve,
and 200/hour is several times the walk-in traffic this event expects.

EVERY POST COUNTS, not only failures (the `/devices/pair` model). There a
success is the legitimate outcome; here a success is exactly what a flood
produces.

THE ADDRESS IS `REMOTE_ADDR`, NEVER `X-Forwarded-For` FROM DJANGO. DRF's default
`get_ident` returns the X-Forwarded-For header verbatim when it is present, and a
client can send any value it likes -- a fresh one per request would slip the
per-client limit entirely. uvicorn already resolves forwarded headers from
trusted proxies (127.0.0.1 by default, which is where the dashboard's rewrite
comes from) into `REMOTE_ADDR`, so that is the one value used.

LocMemCache, like the existing throttles: exact with one worker, which is the
only way this backend runs (CLAUDE.md constraint #1).
"""

from rest_framework.throttling import SimpleRateThrottle


def _client_address(request) -> str:
    return request.META.get("REMOTE_ADDR") or "unknown"


class PublicRegistrationThrottle(SimpleRateThrottle):
    scope = "public_registration"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": _client_address(request)}


class PublicRegistrationGlobalThrottle(SimpleRateThrottle):
    scope = "public_registration_global"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": "all"}


class PublicStatusThrottle(SimpleRateThrottle):
    scope = "public_status"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": _client_address(request)}
