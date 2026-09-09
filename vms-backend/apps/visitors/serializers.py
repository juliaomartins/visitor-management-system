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


class VisitorWithTokenSerializer(VisitorSerializer):
    """A visitor plus the working QR code for their badge.

    `badge_token` is derivable rather than random: the same value is on the
    printed card and can be recomputed at any time, so the dashboard can draw a
    live QR for someone registered last week.

    IT IS A WORKING CREDENTIAL. Anyone holding the string can produce a badge
    that scans, so this serializer is never the default. `GET /visitors/{id}`
    uses it because one visitor is one badge, and the list endpoint uses it only
    when `?with_tokens=true` is asked for explicitly — see the view.
    """

    badge_token = serializers.SerializerMethodField(
        help_text="Raw badge token for the QR code. Stable for the life of the badge."
    )

    class Meta(VisitorSerializer.Meta):
        fields = [*VisitorSerializer.Meta.fields, "badge_token"]

    def get_badge_token(self, visitor: Visitor) -> str:
        from .services import badge_token

        return badge_token(visitor)


class VisitorDetailSerializer(VisitorWithTokenSerializer):
    """`GET /visitors/{id}` — the registration, its scans, and its badge token."""

    scan_events = ScanEventSerializer(many=True, read_only=True)

    class Meta(VisitorWithTokenSerializer.Meta):
        fields = [*VisitorWithTokenSerializer.Meta.fields, "scan_events"]


class VisitorPurgedSerializer(serializers.Serializer):
    """What a permanent delete reports back.

    Not a ModelSerializer: by the time this is rendered the row is gone. It
    exists so the shape is in the schema and the dashboard can read
    `scans_orphaned` from a generated type rather than a hand-written one.
    """

    badge_serial = serializers.CharField(
        help_text="The serial of the registration that was removed."
    )
    scans_orphaned = serializers.IntegerField(
        help_text=(
            "Scan events kept but detached from the visitor. They still count "
            "towards the entrance log; they no longer say who presented the badge."
        )
    )
