"""The lobby screen's live socket.

TWO groups. `lobby_screens` is joined by every connected screen; `services.py`
publishes into it on commit and this consumer forwards the payload untouched, so
what arrives over the socket is byte-for-byte what `/screen/feed` returns and the
screen can dedupe the two paths on `id`.

The second is `device.<pk>`, joined by this screen alone. It exists for one
message: revocation. The token is checked when the socket is ACCEPTED and never
again, so without a push an already-connected screen would keep receiving
arrivals long after it was revoked from the dashboard — until the next server
restart or network blip, which could be hours. Revoking has to reach a socket
that is already open.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.devices.services import device_group_name, touch_device


class ScreenConsumer(AsyncJsonWebsocketConsumer):
    group_name = "lobby_screens"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.device_group = None

    async def connect(self):
        device = self.scope.get("device")
        if not device or device.kind != "screen":
            # 4401: unauthorized. A scanner token must not be able to watch the
            # arrivals feed, and the screen shows a clear failure rather than
            # retrying a socket that will never be accepted.
            return await self.close(code=4401)

        self.device_group = device_group_name(device.pk)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(self.device_group, self.channel_name)
        await self.accept()
        await self._touch(device)

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if self.device_group:
            await self.channel_layer.group_discard(
                self.device_group, self.channel_name
            )

    async def device_revoked(self, event):
        """This screen was revoked. Close with the same code an unauthorised
        connect gets, so the screen has one thing to recognise: 4401 means the
        stored token is finished and only a new pairing code fixes it.

        "device.revoked" -> device_revoked. Dots in the `type` become underscores
        in the method name, and a mismatch fails SILENTLY.
        """
        await self.close(code=4401)

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
