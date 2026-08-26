from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Admin account, as the dashboard sees it. Never exposes the password hash."""

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "is_active",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]


class AdminTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Username + password → JWT pair, for administrators only.

    A non-staff account would receive a token that `IsAdmin` rejects on every
    endpoint, which reads as a broken dashboard. Failing at login instead says
    what actually happened.
    """

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_staff:
            raise AuthenticationFailed(
                "This account is not an administrator.", code="not_admin"
            )
        return data


class AccessTokenSerializer(serializers.Serializer):
    """The auth response body.

    Only the access token is returned. The refresh token goes out as an httpOnly
    cookie so no JavaScript on the dashboard can read it.
    """

    access = serializers.CharField(read_only=True)


class RefreshTokenSerializer(serializers.Serializer):
    """Body for refresh/blacklist.

    Normally empty — the refresh token arrives in the `vms_refresh` cookie. The
    explicit field exists for non-browser clients (curl during a rehearsal).
    """

    refresh = serializers.CharField(required=False, allow_blank=True)
