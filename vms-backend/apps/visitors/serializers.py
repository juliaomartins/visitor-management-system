from rest_framework import serializers

from apps.scans.serializers import ScanEventSerializer

from .models import Visitor


class VisitorSerializer(serializers.ModelSerializer):
    """`token_hash` is deliberately absent — it never leaves the database.

    `is_active` is read-only: it is switched through `POST /visitors/{id}/activate`
    and `/deactivate` so each change lands in the audit log as a named action
    rather than as an anonymous field edit buried in a PATCH of four other
    fields. Neither one touches the badge token, so the printed card keeps
    working across the whole cycle.
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
    """`GET /visitors/{id}` — the registration, its scans, and its badge token.

    `badge_token` is here because the token is derived rather than random: the
    same value is on the printed card and can be recomputed at any time, so the
    dashboard can show a working QR for a visitor registered last week.

    ADMIN-ONLY, AND DETAIL-ONLY. It is a working credential, so it is deliberately
    absent from the list endpoint — one request should not hand back 250 usable
    badges.
    """

    scan_events = ScanEventSerializer(many=True, read_only=True)
    badge_token = serializers.SerializerMethodField(
        help_text="Raw badge token for the QR code. Stable for the life of the badge."
    )

    class Meta(VisitorSerializer.Meta):
        fields = [*VisitorSerializer.Meta.fields, "scan_events", "badge_token"]

    def get_badge_token(self, visitor: Visitor) -> str:
        from .services import badge_token

        return badge_token(visitor)
