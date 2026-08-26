"""Shared endpoints. Currently one: is this the VMS server, and is it alive?"""

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.network import primary_lan_ip


class HealthSerializer(serializers.Serializer):
    """What a device gets back when it finds the server."""

    service = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    server_time = serializers.DateTimeField(read_only=True)
    lan_ip = serializers.CharField(read_only=True)


class HealthView(APIView):
    """`GET /api/v1/health` — the address probe.

    Devices reach this server by IP, and that IP moves. When it does, every
    symptom is indirect: the lobby screen reconnects forever, the guard's phone
    queues scans that never sync. So both apps keep a list of candidate addresses
    and probe them here before giving up and asking someone to type one in.

    Deliberately public and deliberately tiny. A device that has lost the server
    has no token it can use — the scanner may not be paired yet, and the screen
    cannot authenticate against a host it cannot find. `/api/v1/schema/` would
    have worked as a probe but ships the entire OpenAPI document to answer
    "are you there".

    `service` is the point: it distinguishes THIS server from some other machine
    that happens to answer on port 8000, so a device does not cheerfully pair
    itself to a printer.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="health_retrieve",
        summary="Liveness and identity probe",
        description=(
            "Public. Used by the scanner and the lobby screen to find the server "
            "when its address has changed. Returns the LAN address the server "
            "believes it has, which is what devices should be pointed at."
        ),
        responses={200: HealthSerializer},
        auth=[],
        tags=["health"],
    )
    def get(self, request):
        # Rendered through the serializer rather than returned as a raw dict, so
        # the timestamp carries the event's offset like every other endpoint
        # instead of bare UTC, and the payload cannot drift from the schema.
        payload = HealthSerializer(
            {
                "service": "vms",
                "status": "ok",
                "server_time": timezone.now(),
                # Handy when the address in a device's config is stale: the server
                # says where it actually is, and the operator can copy it across.
                "lan_ip": primary_lan_ip(),
            }
        )
        return Response(payload.data)
