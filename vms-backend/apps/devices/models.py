"""Paired hardware: guard phones and the lobby screen.

Devices authenticate with a permanent token instead of a login — a guard should
never see a sign-in form (CLAUDE.md constraint #4).
"""

from django.db import models

from apps.common.models import BaseModel


class DeviceKind(models.TextChoices):
    SCANNER = "scanner", "Scanner"
    SCREEN = "screen", "Screen"


class Device(BaseModel):
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=DeviceKind.choices)
    # SHA-256 of the device token held in expo-secure-store / the screen's config.
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    # Cleared to kill a lost phone.
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("name",)
        indexes = [models.Index(fields=["kind", "is_active"])]

    # DRF sets a Device as `request.user` on device-authenticated endpoints, and
    # permission/throttle code asks every principal whether it is authenticated.
    # A Device that reached a view has already proved its token.
    is_authenticated = True
    is_anonymous = False

    def __str__(self) -> str:
        return f"{self.name} ({self.get_kind_display()})"


class PairingCode(BaseModel):
    """Short-lived code typed into a device once, then exchanged for a token."""

    code = models.CharField(max_length=8, unique=True)
    kind = models.CharField(max_length=10, choices=DeviceKind.choices)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["expires_at"])]

    def __str__(self) -> str:
        return f"{self.code} ({self.get_kind_display()})"
