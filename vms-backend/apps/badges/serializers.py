"""Request bodies for the badge endpoints. No models in this app, so no ModelSerializers."""

from rest_framework import serializers


class BadgeCardRequestSerializer(serializers.Serializer):
    """What the registration receipt posts back to get a printable card.

    The raw token, and only the raw token. The server resolves the visitor from
    its SHA-256 digest exactly as `/scans` does, so this is not an oracle: a
    caller who does not already hold the token gets nothing, and one who does is
    holding the badge anyway.
    """

    token = serializers.CharField(
        max_length=128,
        trim_whitespace=True,
        help_text=(
            "The raw badge token, as returned once by POST /visitors. Not stored; "
            "used to draw the QR and then discarded."
        ),
    )


class BadgeReissueSheetRequestSerializer(serializers.Serializer):
    """Which visitors to put on the sheet.

    Every one of them gets a NEW token — see the endpoint description. There is no
    way to reprint an existing card, because the raw token it carries was never
    stored.
    """

    visitor_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=250,
        help_text=(
            "Visitors to reissue and print, in the order they appear on the sheet."
        ),
    )
