"""The two endpoints the event actually runs on.

    POST /api/v1/scans              [scanner device, 30/min]  a guard scans a badge
    GET  /api/v1/screen/feed?since= [screen device]           reconnect backfill

The feed is not a fallback to be deleted once the WebSocket lands in phase 2
(CLAUDE.md constraint #6). `InMemoryChannelLayer` has no queue behind it: restart
the server and every group membership disappears along with any scan in those
seconds. Polling `?since=<last_id>` is what closes that hole, and it is the same
data over the same serializer, so events arriving on both paths dedupe on `id`.
"""

from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsScannerDevice, IsScreenDevice
from apps.common.throttling import ScanRateThrottle
from apps.devices.authentication import DeviceAuthentication

from . import services
from .models import ScanEvent, ScanResult
from .serializers import (
    ScanRequestSerializer,
    ScanResponseSerializer,
    ScreenEventSerializer,
    ScreenFeedSerializer,
)


class ScanView(APIView):
    """A badge was presented at the door."""

    authentication_classes = [DeviceAuthentication]
    permission_classes = [IsScannerDevice]
    throttle_classes = [ScanRateThrottle]

    @extend_schema(
        operation_id="scans_create",
        summary="Record a badge scan",
        description=(
            "Always 200 — read `result`, not the status code. A revoked or forged "
            "badge is a business outcome (`revoked` / `invalid`), which keeps the "
            "scanner app's error handling to genuine network failures. A visitor "
            "re-presented within the dedupe window returns `duplicate`: still "
            "logged, but kept off the lobby screen."
        ),
        request=ScanRequestSerializer,
        responses={200: ScanResponseSerializer},
        tags=["scans"],
    )
    def post(self, request):
        serializer = ScanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        scan = services.record_scan(
            raw_token=serializer.validated_data["token"],
            device=request.auth,
            scanned_at=serializer.validated_data.get("scanned_at"),
            client_uuid=serializer.validated_data.get("client_uuid"),
        )
        return Response(ScanResponseSerializer(scan).data)


class ScreenFeedView(APIView):
    """Everything the screen missed while it was not listening."""

    authentication_classes = [DeviceAuthentication]
    permission_classes = [IsScreenDevice]

    @extend_schema(
        operation_id="screen_feed_retrieve",
        summary="Backfill arrivals after a reconnect",
        parameters=[
            OpenApiParameter(
                "since",
                OpenApiTypes.INT,
                description=(
                    "Last `id` the screen has already rendered. Omit or pass 0 on "
                    "a cold start."
                ),
            )
        ],
        responses={200: ScreenFeedSerializer},
        tags=["screen"],
    )
    def get(self, request):
        since = self._since(request)

        events = (
            ScanEvent.objects.filter(result=ScanResult.VALID, id__gt=since)
            .select_related("visitor")
            .order_by("id")[: settings.SCREEN_FEED_MAX_EVENTS]
        )
        data = ScreenEventSerializer(
            events, many=True, context={"request": request}
        ).data

        return Response(
            {"events": data, "last_id": data[-1]["id"] if data else since}
        )

    @staticmethod
    def _since(request) -> int:
        """A junk cursor means a cold start, not a 400 — never wedge the screen."""
        try:
            return max(int(request.query_params.get("since", 0)), 0)
        except (TypeError, ValueError):
            return 0
