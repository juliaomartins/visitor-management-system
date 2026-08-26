"""The lobby screen's live socket.

One group, `lobby_screens`, joined by every connected screen. `services.py`
publishes into it on commit; this consumer forwards the payload untouched, so
what arrives over the socket is byte-for-byte what `/screen/feed` returns and the
screen can dedupe the two paths on `id`.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.devices.services import touch_device


class ScreenConsumer(AsyncJsonWebsocketConsumer):
    group_name = "lobby_screens"

    async def connect(self):
        device = self.scope.get("device")
        if not device or device.kind != "screen":
            # 4401: unauthorized. A scanner token must not be able to watch the
            # arrivals feed, and the screen shows a clear failure rather than
            # retrying a socket that will never be accepted.
            return await self.close(code=4401)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self._touch(device)

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        """The screen's keep-alive ping, and the only reason to read from it.

        A screen holding an open socket makes no HTTP requests at all after its
        first backfill, so without this its `last_seen_at` would freeze at connect
        time and the dashboard would call a perfectly healthy display "silent" ten
        minutes later. The ping arrives every 30s; `touch_device` throttles the
        write to once a minute.

        The content is ignored. Nothing a screen sends is trusted or acted on —
        its token is read-only by design.
        """
        device = self.scope.get("device")
        if device is not None:
            await self._touch(device)

    @staticmethod
    @database_sync_to_async
    def _touch(device):
        touch_device(device)

    async def visitor_arrived(self, event):
        # "visitor.arrived" → visitor_arrived. Dots in the `type` become
        # underscores in the method name, and a mismatch fails SILENTLY — no
        # error anywhere. It is the most common cause of "events aren't arriving".
        await self.send_json(event["payload"])
