from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.visitors.models import Visitor

from .models import ScanEvent


class ScanEventSerializer(serializers.ModelSerializer):
    """The audit view of a scan — every row, including the failures."""

    class Meta:
        model = ScanEvent
        fields = [
            "id",
            "visitor",
            "device",
            "scanned_at",
            "result",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ScreenEventSerializer(serializers.ModelSerializer):
    """What the lobby screen renders, and nothing more.

    Sent over the WebSocket and returned by the backfill endpoint, so both paths
    produce identical objects and the screen can dedupe on `id`.
    """

    full_name = serializers.CharField(source="visitor.full_name", read_only=True)
    country = serializers.CharField(source="visitor.country", read_only=True)
    category = serializers.CharField(source="visitor.category", read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = ScanEvent
        fields = ["id", "full_name", "country", "photo_url", "category", "scanned_at"]

    @extend_schema_field(OpenApiTypes.URI)
    def get_photo_url(self, obj: ScanEvent) -> str | None:
        photo = getattr(obj.visitor, "photo", None)
        if not photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(photo.url) if request else photo.url


class ScanRequestSerializer(serializers.Serializer):
    """What the guard's phone posts for each badge it sees."""

    token = serializers.CharField(
        max_length=128,
        trim_whitespace=True,
        help_text="The raw token read out of the QR code.",
    )
    scanned_at = serializers.DateTimeField(
        required=False,
        help_text=(
            "When the badge was presented. Sent by the device, because the "
            "offline queue may sync minutes later. Defaults to now."
        ),
    )


class ScanVisitorSerializer(serializers.ModelSerializer):
    """The little the guard's phone needs: enough to match a face to a name."""

    class Meta:
        model = Visitor
        fields = ["id", "full_name", "country", "organization", "category", "badge_serial"]


class ScanResponseSerializer(serializers.ModelSerializer):
    """The answer to `POST /scans` — always 200, with the verdict in `result`.

    `visitor` is null for an `invalid` scan; a forged badge resolves to nobody.
    """

    event_id = serializers.IntegerField(source="id", read_only=True)
    visitor = ScanVisitorSerializer(read_only=True)

    class Meta:
        model = ScanEvent
        fields = ["event_id", "result", "scanned_at", "visitor"]


class ScreenFeedSerializer(serializers.Serializer):
    """`GET /screen/feed?since=` — the reconnect backfill.

    `last_id` is the cursor to send next. It advances even when the page was
    truncated, so a screen that has been down for an hour catches up over
    several polls instead of one huge response.
    """

    events = ScreenEventSerializer(many=True, read_only=True)
    last_id = serializers.IntegerField(read_only=True)
