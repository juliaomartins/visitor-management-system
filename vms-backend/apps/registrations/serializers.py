"""What the public may send, and the little it gets back.

NOT MODEL SERIALIZERS. A ModelSerializer starts from the model and subtracts;
these start from nothing and add four fields. Category, token, status, serial,
source and timestamps are not declared, so they cannot be written -- and, on the
way out, nothing that identifies the row (id, token hash, photo URL) can leak.
"""

import unicodedata

from rest_framework import serializers

from .models import RegistrationSettings
from .photos import PhotoRejected, sanitise_photo

#: A cell that starts with one of these is a formula when the roster is opened in
#: Excel. A real name or organisation never needs to.
FORMULA_PREFIXES = ("=", "+", "-", "@")


def _clean_text(value: str) -> str:
    """NFKC, no control or invisible formatting characters, single spaces.

    Whitespace becomes a space FIRST, and only then are the remaining control
    and formatting characters dropped. Tab and newline are themselves control
    characters, so dropping before converting glued the words either side of
    them together -- "Maria<TAB>Sousa" came out as "MariaSousa".
    """
    value = unicodedata.normalize("NFKC", value)
    value = "".join(" " if ch.isspace() else ch for ch in value)
    value = "".join(
        ch for ch in value if unicodedata.category(ch) not in {"Cc", "Cf"}
    )
    return " ".join(value.split())


def _clean_required(value: str, label: str) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        raise serializers.ValidationError(f"{label} is required.")
    if cleaned.startswith(FORMULA_PREFIXES):
        raise serializers.ValidationError(f"{label} cannot start with = + - or @.")
    return cleaned


class PublicRegistrationSerializer(serializers.Serializer):
    """`POST /public/registrations`, multipart. Exactly these four fields."""

    full_name = serializers.CharField(max_length=200)
    country = serializers.CharField(max_length=100)
    organization = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=""
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


class PublicRegistrationResultSerializer(serializers.Serializer):
    """Only what the success screen draws.

    `badge_token` is the QR payload -- a working credential, returned to the
    person it was just issued to and to nobody else. No id, no token hash, no
    photo URL: nothing here lets a caller find or fetch any other visitor.
    """

    full_name = serializers.CharField()
    badge_serial = serializers.CharField(
        help_text="Printed on the card; quoted at the kiosk desk if a scan fails."
    )
    badge_token = serializers.CharField(
        help_text="Raw badge token for the QR code. Returned once, never again."
    )


class PublicRegistrationStatusSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()


class RegistrationSettingsSerializer(serializers.ModelSerializer):
    """The admin's view of the switch."""

    updated_by = serializers.SlugRelatedField(
        slug_field="username", read_only=True, allow_null=True
    )

    class Meta:
        model = RegistrationSettings
        fields = ["public_registration_enabled", "updated_at", "updated_by"]
        read_only_fields = ["updated_at", "updated_by"]
