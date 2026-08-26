"""Absolute URLs for uploaded files.

Every consumer of a visitor photo is on another device: the lobby screen on
:3000, the guard's phone on the LAN, the badge PDF renderer. None of them can
resolve a relative `/media/...` path against the backend, and two of them arrive
without a request to build an absolute URL from — `scans/services.py` serializes
the WebSocket payload outside any request cycle.

So the base comes from settings, not from the request. That also keeps the
WebSocket push and the `/screen/feed` backfill byte-identical for the same event,
which is what lets the screen dedupe them on `id`.

Set `VMS_MEDIA_BASE_URL` to the server's LAN address for the event. The default of
`http://localhost:8000` is correct only for something running on the server
itself — on a phone, localhost is the phone.
"""

from django.conf import settings


def absolute_media_url(file) -> str | None:
    """Return an absolute URL for a `FieldFile`, or None when there is no file."""
    if not file:
        return None

    base = settings.MEDIA_BASE_URL.rstrip("/")
    path = file.url if file.url.startswith("/") else f"/{file.url}"
    return f"{base}{path}"
