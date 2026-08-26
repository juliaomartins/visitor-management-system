"""Response shapes for the entrance log. No models in this app.

Every visitor field is nullable, because an `invalid` scan matched no badge and
therefore has no visitor. That is not an edge case to be tidied away — a forged
or foreign QR presented at the door is exactly what the audit half of this report
exists to record.
"""

from rest_framework import serializers

from apps.scans.models import ScanEvent


class EntrySerializer(serializers.ModelSerializer):
    """One badge presentation, valid or not."""

    # `default=None` so DRF stops at a null visitor instead of raising while
    # walking `visitor.full_name`.
    full_name = serializers.CharField(
        source="visitor.full_name", read_only=True, default=None, allow_null=True
    )
    country = serializers.CharField(
        source="visitor.country", read_only=True, default=None, allow_null=True
    )
    organization = serializers.CharField(
        source="visitor.organization", read_only=True, default=None, allow_null=True
    )
    category = serializers.CharField(
        source="visitor.category", read_only=True, default=None, allow_null=True
    )
    badge_serial = serializers.CharField(
        source="visitor.badge_serial", read_only=True, default=None, allow_null=True
    )
    device_name = serializers.CharField(source="device.name", read_only=True)

    class Meta:
        model = ScanEvent
        fields = [
            "id",
            "scanned_at",
            "result",
            "visitor",
            "full_name",
            "country",
            "organization",
            "category",
            "badge_serial",
            "device_name",
        ]


class HourBucketSerializer(serializers.Serializer):
    """One local hour. `hour` carries its offset, so the client never guesses."""

    hour = serializers.DateTimeField(read_only=True)
    total = serializers.IntegerField(read_only=True)
    valid = serializers.IntegerField(read_only=True)
    duplicate = serializers.IntegerField(read_only=True)
    refused = serializers.IntegerField(read_only=True)


class CountryCountSerializer(serializers.Serializer):
    country = serializers.CharField(read_only=True)
    total = serializers.IntegerField(read_only=True)


class CategoryCountSerializer(serializers.Serializer):
    category = serializers.CharField(read_only=True)
    total = serializers.IntegerField(read_only=True)


class ResultCountsSerializer(serializers.Serializer):
    """Always all four keys, zero-filled — see counts_by_result()."""

    valid = serializers.IntegerField(read_only=True)
    invalid = serializers.IntegerField(read_only=True)
    revoked = serializers.IntegerField(read_only=True)
    duplicate = serializers.IntegerField(read_only=True)


class EntrySummarySerializer(serializers.Serializer):
    total = serializers.IntegerField(read_only=True)
    unique_visitors = serializers.IntegerField(read_only=True)
    by_result = ResultCountsSerializer(read_only=True)
    by_hour = HourBucketSerializer(many=True, read_only=True)
    by_country = CountryCountSerializer(many=True, read_only=True)
    by_category = CategoryCountSerializer(many=True, read_only=True)


class EntryReportSerializer(serializers.Serializer):
    """`GET /reports/entries` — the log and its totals, from one filtered query."""

    timezone = serializers.CharField(read_only=True)
    date_from = serializers.DateField(read_only=True)
    date_to = serializers.DateField(read_only=True)
    summary = EntrySummarySerializer(read_only=True)
    entries = EntrySerializer(many=True, read_only=True)
