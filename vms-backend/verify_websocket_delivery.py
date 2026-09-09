"""Run a real in-process screen-to-scan delivery check.

Usage from vms-backend:
    ..\\.venv\\Scripts\\python.exe manage.py shell < verify_websocket_delivery.py

The script intentionally uses ASCII output because PowerShell can corrupt UTF-8
emoji when feeding a file into Django's interactive shell.
"""

import asyncio
import os
import uuid

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

import django

django.setup()

from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator

from apps.common.utils import hash_token
from apps.devices.models import Device, DeviceKind
from apps.scans.services import record_scan
from apps.visitors.models import Visitor
from apps.visitors.services import badge_token
from config.asgi import application


async def main():
    device = await sync_to_async(
        lambda: Device.objects.filter(kind=DeviceKind.SCREEN, is_active=True).first()
    )()
    visitor = await sync_to_async(
        lambda: Visitor.objects.filter(is_active=True, deleted_at__isnull=True).first()
    )()

    if device is None:
        raise RuntimeError("No active screen device exists. Pair a screen first.")
    if visitor is None:
        raise RuntimeError("No active visitor exists. Seed or register one first.")

    # A database hash is not a usable token. This probe needs the raw token, so
    # create a temporary screen device with a known token and remove it after.
    raw_token = uuid.uuid4().hex
    probe = await sync_to_async(Device.objects.create)(
        name="WebSocket delivery probe",
        kind=DeviceKind.SCREEN,
        token_hash=hash_token(raw_token),
        is_active=True,
    )

    communicator = WebsocketCommunicator(
        application, f"/ws/screen/?token={raw_token}"
    )
    scan = None
    try:
        connected, _ = await communicator.connect()
        if not connected:
            raise RuntimeError("Screen WebSocket handshake was rejected.")

        scan = await sync_to_async(record_scan)(
            raw_token=await sync_to_async(badge_token)(visitor),
            device=probe,
            client_uuid=uuid.uuid4(),
        )
        if scan.result != "valid":
            raise RuntimeError(f"Probe scan was {scan.result}, expected valid.")

        event = await communicator.receive_json_from(timeout=2)
        if event.get("id") != scan.id:
            raise RuntimeError(
                f"Received event {event.get('id')!r}, expected scan {scan.id!r}."
            )

        print("PASS: authenticated screen received the valid scan event")
        print(f"event_id={event['id']}")
        print(f"full_name={event['full_name']}")
    finally:
        await communicator.disconnect()
        if scan is not None:
            await sync_to_async(scan.delete)()
        await sync_to_async(probe.delete)()


if __name__ == "__main__":
    asyncio.run(main())