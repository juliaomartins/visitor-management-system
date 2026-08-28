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


class DoorLoadSerializer(serializers.Serializer):
    """One door's share of the traffic."""

    device = serializers.CharField(read_only=True)
    total = serializers.IntegerField(read_only=True)
    valid = serializers.IntegerField(read_only=True)
    refused = serializers.IntegerField(read_only=True)
    share = serializers.FloatField(read_only=True)


class AbsentVisitorSerializer(serializers.Serializer):
    """Registered, with no valid scan in the period."""

    badge_serial = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    country = serializers.CharField(read_only=True)
    organization = serializers.CharField(read_only=True, allow_blank=True)
    category = serializers.CharField(read_only=True)


class ReportInsightsSerializer(serializers.Serializer):
    """The derived findings — what the counts mean.

    Served alongside the raw summary so the dashboard shows the same conclusions
    the PDF and the workbook print, rather than the page re-deriving them in
    TypeScript and quietly drifting.
    """

    registered = serializers.IntegerField(read_only=True)
    arrived = serializers.IntegerField(read_only=True)
    attendance_rate = serializers.FloatField(read_only=True)
    refused = serializers.IntegerField(read_only=True)
    refusal_rate = serializers.FloatField(read_only=True)
    quiet_hours = serializers.IntegerField(read_only=True)
    not_arrived_count = serializers.IntegerField(read_only=True)

    first_arrival = serializers.DateTimeField(read_only=True, allow_null=True)
    last_arrival = serializers.DateTimeField(read_only=True, allow_null=True)
    median_arrival = serializers.DateTimeField(read_only=True, allow_null=True)
    span_minutes = serializers.IntegerField(read_only=True)

    peak_hour = serializers.DateTimeField(read_only=True, allow_null=True)
    peak_total = serializers.IntegerField(read_only=True)
    peak_share = serializers.FloatField(read_only=True)

    vip_arrived = serializers.IntegerField(read_only=True)
    vip_share = serializers.FloatField(read_only=True)
    repeat_people = serializers.IntegerField(read_only=True)
    repeat_share = serializers.FloatField(read_only=True)

    doors = DoorLoadSerializer(many=True, read_only=True)
    not_arrived = AbsentVisitorSerializer(many=True, read_only=True)
    narrative = serializers.ListField(
        child=serializers.CharField(), read_only=True,
        help_text="The findings in sentences, in the order they should be read.",
    )


class EntryReportSerializer(serializers.Serializer):
    """`GET /reports/entries` — the log, its totals, and what they mean.

    `insights` carries the derived findings the PDF and the workbook print, so the
    dashboard renders the same conclusions rather than re-deriving them in
    TypeScript and quietly drifting from the exports.
    """

    timezone = serializers.CharField(read_only=True)
    date_from = serializers.DateField(read_only=True)
    date_to = serializers.DateField(read_only=True)
    summary = EntrySummarySerializer(read_only=True)
    insights = ReportInsightsSerializer(read_only=True)
    entries = EntrySerializer(many=True, read_only=True)
