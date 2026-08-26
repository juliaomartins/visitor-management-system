from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.common.media import absolute_media_url
from apps.visitors.models import Visitor

from .models import ScanEvent


class ScanEventSerializer(serializers.ModelSerializer):
    """The audit view of a scan — every row, including the failures."""

    # The dashboard shows scan history to a person, and "Front door" tells them
    # which entrance this was; a UUID does not. The id stays for anything that
    # needs to key on the device itself.
    device_name = serializers.CharField(source="device.name", read_only=True)

    class Meta:
        model = ScanEvent
        fields = [
            "id",
            "visitor",
            "device",
            "device_name",
            "scanned_at",
            "result",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "device_name", "created_at", "updated_at"]


class ScreenEventSerializer(serializers.ModelSerializer):
    """What the lobby screen renders, and nothing more.

    Sent over the WebSocket and returned by the backfill endpoint, so both paths
    produce identical objects and the screen can dedupe on `id`.
    """

    full_name = serializers.CharField(source="visitor.full_name", read_only=True)
    country = serializers.CharField(source="visitor.country", read_only=True)
    organization = serializers.CharField(source="visitor.organization", read_only=True)
    category = serializers.CharField(source="visitor.category", read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = ScanEvent
        fields = [
            "id",
            "full_name",
            "country",
            "organization",
            "photo_url",
            "category",
            "scanned_at",
        ]

    @extend_schema_field(OpenApiTypes.URI)
    def get_photo_url(self, obj: ScanEvent) -> str | None:
        """Absolute, and never derived from the request — see apps/common/media.py."""
        return absolute_media_url(getattr(obj.visitor, "photo", None))


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
    client_uuid = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text=(
            "Identifier the device generated for this scan. Posting it twice "
            "returns the scan already recorded rather than creating a second "
            "one — the offline queue retries, and a lost response must not "
            "become a second arrival."
        ),
    )


class ScanVisitorSerializer(serializers.ModelSerializer):
    """What the guard's phone shows: enough to match the face to the card.

    The photo is the point. A name tells a guard who the badge claims to be; only
    the photo tells them whether the person holding it is that person.
    """

    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Visitor
        fields = [
            "id",
            "full_name",
            "country",
            "organization",
            "category",
            "badge_serial",
            "photo_url",
        ]

    @extend_schema_field(OpenApiTypes.URI)
    def get_photo_url(self, obj: Visitor) -> str | None:
        return absolute_media_url(obj.photo)


class ScanResponseSerializer(serializers.ModelSerializer):
    """The answer to `POST /scans` — always 200, with the verdict in `result`.

    `visitor` is null for an `invalid` scan; a forged badge resolves to nobody.
    """

    event_id = serializers.IntegerField(source="id", read_only=True)
    # allow_null so the generated clients type it as nullable — a forged badge
    # resolves to nobody, and the scanner has to handle that case explicitly.
    visitor = ScanVisitorSerializer(read_only=True, allow_null=True)

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
