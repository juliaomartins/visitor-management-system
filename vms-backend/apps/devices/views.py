"""Device pairing and lifecycle.

    POST /api/v1/devices/pairing-code   [admin]              mint a setup code
    GET  /api/v1/devices                [admin]              list paired devices
    POST /api/v1/devices/{id}/revoke    [admin]              kill a lost phone
    POST /api/v1/devices/pair           [public, throttled]  redeem a setup code

`pair` is the only route in the whole API reachable without a token, so it is
also the only one that is rate limited by IP.
"""

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.common.throttling import PairingRateThrottle

from . import services
from .models import Device
from .serializers import (
    DevicePairedSerializer,
    DevicePairRequestSerializer,
    DeviceSerializer,
    PairingCodeSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="List paired devices"),
)
class DeviceViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [IsAdmin]

    @extend_schema(
        summary="Generate a pairing code",
        description=(
            "Short-lived, single-use. Read it off the dashboard and type it into "
            "the device standing next to you."
        ),
        request=PairingCodeSerializer,
        responses={201: PairingCodeSerializer},
    )
    @action(detail=False, methods=["post"], url_path="pairing-code")
    def pairing_code(self, request, *args, **kwargs):
        serializer = PairingCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pairing_code = services.create_pairing_code(
            serializer.validated_data["kind"], actor=request.user
        )
        return Response(
            PairingCodeSerializer(pairing_code).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        summary="Redeem a pairing code",
        description=(
            "Returns the permanent device token. It is stored only as a SHA-256 "
            "digest, so this response is the single chance to capture it."
        ),
        request=DevicePairRequestSerializer,
        responses={201: DevicePairedSerializer},
        auth=[],
    )
    @action(
        detail=False,
        methods=["post"],
        permission_classes=[AllowAny],
        authentication_classes=[],
        throttle_classes=[PairingRateThrottle],
    )
    def pair(self, request, *args, **kwargs):
        serializer = DevicePairRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            device, raw_token = services.redeem_pairing_code(
                serializer.validated_data["code"],
                name=serializer.validated_data.get("name", ""),
            )
        except services.PairingError as exc:
            # Pairing happens once, at setup, with an admin present — a bad code
            # is a mistake to correct, not a business outcome to record.
            raise ValidationError({"code": [str(exc)]}) from exc

        # A successful pair is proof this IP is not guessing, so its failed-attempt
        # history goes. Setting up ten doors in a row must never lock out the
        # eleventh.
        PairingRateThrottle.forget(request)

        # Read by DevicePairedSerializer.token, then gone. Never stored.
        device.token = raw_token
        return Response(
            DevicePairedSerializer(device).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        summary="Revoke a device",
        description="The device's scan history stays; its token stops working.",
        request=None,
        responses={200: DeviceSerializer},
    )
    @action(detail=True, methods=["post"])
    def revoke(self, request, *args, **kwargs):
        device = services.revoke_device(self.get_object(), actor=request.user)
        return Response(DeviceSerializer(device).data)
