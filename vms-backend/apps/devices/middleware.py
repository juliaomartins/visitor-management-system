"""WebSocket authentication for paired devices.

The HTTP counterpart is `authentication.py`, which reads an `Authorization`
header. The browser `WebSocket` API cannot set headers, so the screen passes its
token in the query string instead:

    ws://192.168.1.50:8000/ws/screen/?token=<device_token>

Keep that token out of access logs — it is a credential sitting in a URL.

This middleware only resolves the device onto the scope; it never rejects. The
consumer decides, because a rejection is a close code the screen can act on.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async

from apps.common.utils import hash_token


class DeviceAuthMiddleware:
    """Put `scope["device"]` in place, or None."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        qs = parse_qs(scope.get("query_string", b"").decode())
        token = (qs.get("token") or [None])[0]
        scope["device"] = await self._get(token) if token else None
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get(self, token):
        from .models import Device

        return Device.objects.filter(
            token_hash=hash_token(token), is_active=True
        ).first()
