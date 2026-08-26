from rest_framework import serializers

from .models import Device, PairingCode


class DeviceSerializer(serializers.ModelSerializer):
    """`token_hash` is deliberately absent — the raw token is shown once, at pairing."""

    class Meta:
        model = Device
        fields = [
            "id",
            "name",
            "kind",
            "is_active",
            "last_seen_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "last_seen_at", "created_at", "updated_at"]


class PairingCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PairingCode
        fields = [
            "id",
            "code",
            "kind",
            "expires_at",
            "used_at",
            "created_at",
            "updated_at",
        ]
        # Only `kind` is supplied; the code and its lifetime are the server's call.
        read_only_fields = [
            "id",
            "code",
            "expires_at",
            "used_at",
            "created_at",
            "updated_at",
        ]


class DevicePairRequestSerializer(serializers.Serializer):
    """What a device posts to `/devices/pair` — the only endpoint with no token."""

    code = serializers.CharField(
        max_length=8, help_text="The 6-character code shown on the dashboard."
    )
    name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Optional label, e.g. 'North door'. Defaults to 'Scanner 2'.",
    )


class DevicePairedSerializer(DeviceSerializer):
    """The pairing response — the one and only sight of the raw device token.

    The scanner writes `token` to expo-secure-store; the screen keeps it in its
    local config. It cannot be recovered afterwards, only reissued by pairing again.
    """

    token = serializers.CharField(
        read_only=True,
        help_text="Permanent device token. Sent as `Authorization: Device <token>`.",
    )

    class Meta(DeviceSerializer.Meta):
        fields = [*DeviceSerializer.Meta.fields, "token"]
