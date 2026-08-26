"""The lobby screen's live socket.

One group, `lobby_screens`, joined by every connected screen. `services.py`
publishes into it on commit; this consumer forwards the payload untouched, so
what arrives over the socket is byte-for-byte what `/screen/feed` returns and the
screen can dedupe the two paths on `id`.
"""

from channels.generic.websocket import AsyncJsonWebsocketConsumer


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

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def visitor_arrived(self, event):
        # "visitor.arrived" → visitor_arrived. Dots in the `type` become
        # underscores in the method name, and a mismatch fails SILENTLY — no
        # error anywhere. It is the most common cause of "events aren't arriving".
        await self.send_json(event["payload"])
