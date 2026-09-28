"""What a walk-in desk may send, and the little it gets back.

NOT MODEL SERIALIZERS, for the reason `apps.registrations` gives: these start
from nothing and add five fields, so a field added to the Visitor model can
never widen this door by accident.

The text cleaning and the photo sanitiser are the public form's, imported rather
than copied. A photo arriving from a laptop at the desk is no more trustworthy
than one arriving from a phone in the queue: same 5 MB ceiling, same header
check before decode, same re-encode to a stripped JPEG.
"""

from rest_framework import serializers

from apps.registrations.photos import PhotoRejected, sanitise_photo
from apps.registrations.serializers import _clean_required, _clean_text
from apps.visitors.models import VisitorCategory

FORMULA_PREFIXES = ("=", "+", "-", "@")


class DeskRegistrationSerializer(serializers.Serializer):
    """`POST /desk/registrations`, multipart. Exactly these five fields."""

    full_name = serializers.CharField(max_length=200)
    country = serializers.CharField(max_length=100)
    organization = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=""
    )
    # The one thing this path has that the public form does not: the desk is
    # staffed, so it may mark a guest VIP. Nothing else about the badge differs.
    category = serializers.ChoiceField(
        choices=VisitorCategory.choices,
        default=VisitorCategory.NORMAL,
        help_text="`normal` or `vip`.",
    )
    photo = serializers.ImageField(
        help_text="JPEG, PNG or WebP, at most 5 MB. Re-encoded by the server."
    )

    def validate_full_name(self, value: str) -> str:
        return _clean_required(value, "Full name")

    def validate_country(self, value: str) -> str:
        return _clean_required(value, "Country")

    def validate_organization(self, value: str) -> str:
        cleaned = _clean_text(value)
        if cleaned.startswith(FORMULA_PREFIXES):
            raise serializers.ValidationError(
                "Organization cannot start with = + - or @."
            )
        return cleaned

    def validate_photo(self, value):
        try:
            return sanitise_photo(value)
        except PhotoRejected as error:
            raise serializers.ValidationError(str(error)) from error


class DeskRegistrationResultSerializer(serializers.Serializer):
    """Only what the desk screen needs to show the visitor.

    `badge_token` is the QR payload, and it is also the key the desk hands back
    to `GET /desk/qr` to have the code drawn. No id, no photo URL, no token
    hash: nothing here lets the desk reach any other visitor's badge.
    """

    full_name = serializers.CharField()
    badge_serial = serializers.CharField(
        help_text="Printed on the card; quoted at the kiosk desk if a scan fails."
    )
    badge_token = serializers.CharField(
        help_text="Raw badge token for the QR code. Returned once, never again."
    )
    category = serializers.CharField(help_text="`normal` or `vip`, as registered.")
