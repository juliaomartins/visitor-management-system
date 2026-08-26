from rest_framework import serializers

from apps.scans.serializers import ScanEventSerializer

from .models import Visitor


class VisitorSerializer(serializers.ModelSerializer):
    """`token_hash` is deliberately absent — it never leaves the database.

    `is_active` is read-only: a badge is killed through `POST /visitors/{id}/revoke`
    so the action lands in the audit log as a revocation, not as a field edit.
    """

    class Meta:
        model = Visitor
        fields = [
            "id",
            "full_name",
            "country",
            "organization",
            "photo",
            "category",
            "badge_serial",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "badge_serial",
            "is_active",
            "created_at",
            "updated_at",
        ]


class VisitorIssuedSerializer(VisitorSerializer):
    """The response to `POST /visitors` — the one and only sight of the raw token.

    `badge_token` is what goes into the QR. It is not stored anywhere and cannot
    be recovered: the caller must print the card now (CLAUDE.md constraint #3).
    """

    badge_token = serializers.CharField(
        read_only=True,
        help_text="Raw badge token for the QR code. Shown once, never again.",
    )

    class Meta(VisitorSerializer.Meta):
        fields = [*VisitorSerializer.Meta.fields, "badge_token"]


class VisitorDetailSerializer(VisitorSerializer):
    """`GET /visitors/{id}` — the registration plus every scan it produced."""

    scan_events = ScanEventSerializer(many=True, read_only=True)

    class Meta(VisitorSerializer.Meta):
        fields = [*VisitorSerializer.Meta.fields, "scan_events"]
