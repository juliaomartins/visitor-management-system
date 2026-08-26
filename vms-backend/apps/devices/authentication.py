"""HTTP authentication for paired devices.

    Authorization: Device <raw-token>

A guard never sees a login form (CLAUDE.md constraint #4). The phone pairs once,
stores the token in expo-secure-store, and sends it forever. Only the SHA-256
digest is stored server-side, so a database dump does not yield a working token.

The WebSocket equivalent lives in `middleware.py` (phase 2) — the browser
`WebSocket` API cannot set headers, so the screen passes its token in the query
string instead.
"""

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework import authentication, exceptions

from apps.common.utils import hash_token

from .models import Device
from .services import touch_device

KEYWORD = "Device"

class DeviceAuthentication(authentication.BaseAuthentication):
    """Resolve `Authorization: Device <token>` to a `Device`.

    Sets both `request.user` and `request.auth` to the device. `request.auth` is
    what the device permissions read; `request.user` is set so DRF's throttling
    and logging see an authenticated principal rather than an anonymous one.
    """

    keyword = KEYWORD

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword.lower().encode():
            return None  # not our scheme — let the next authenticator look

        if len(header) == 1:
            raise exceptions.AuthenticationFailed("No device token supplied.")
        if len(header) > 2:
            raise exceptions.AuthenticationFailed(
                "Device token must not contain spaces."
            )

        try:
            raw = header[1].decode()
        except UnicodeError:
            raise exceptions.AuthenticationFailed(
                "Device token contains invalid characters."
            ) from None

        device = Device.objects.filter(token_hash=hash_token(raw)).first()
        if device is None:
            raise exceptions.AuthenticationFailed("Unknown device token.")
        if not device.is_active:
            # Revoked phone. Say so plainly — the scanner app shows this to whoever
            # is holding it, and "revoked" is more actionable than "unauthorized".
            raise exceptions.AuthenticationFailed("This device has been revoked.")

        touch_device(device)
        return (device, device)

    def authenticate_header(self, request):
        return self.keyword


class DeviceAuthenticationScheme(OpenApiAuthenticationExtension):
    """Teach drf-spectacular about the `Device` scheme.

    Without this, `/scans` and `/screen/feed` generate as unauthenticated and the
    contracts hand the scanner and screen a client that sends no token. Declared
    as an apiKey header because `Device` is not one of OpenAPI's named HTTP
    schemes.
    """

    target_class = "apps.devices.authentication.DeviceAuthentication"
    name = "deviceAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": (
                "Permanent token from `POST /api/v1/devices/pair`, sent as "
                "`Authorization: Device <token>`."
            ),
        }
