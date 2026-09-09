"""The people the event is for."""

from django.db import models

from apps.common.models import BaseModel


class VisitorCategory(models.TextChoices):
    NORMAL = "normal", "Normal"
    VIP = "vip", "VIP"


class Visitor(BaseModel):
    full_name = models.CharField(max_length=200)
    country = models.CharField(max_length=100)
    organization = models.CharField(max_length=200, blank=True)
    photo = models.ImageField(upload_to="visitors/")
    category = models.CharField(
        max_length=10,
        choices=VisitorCategory.choices,
        default=VisitorCategory.NORMAL,
    )
    # Human-readable and printed on the card, so staff can talk about a badge.
    badge_serial = models.CharField(max_length=20, unique=True)
    # SHA-256 of the token inside the QR. The raw token is never stored -- it is
    # derived on demand from the id and `token_version` (see visitors/services).
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    # Bumped to rotate ONE badge without touching anybody else's.
    #
    # The token is deterministic, which is what makes reprinting possible, but it
    # also means a compromised card could not otherwise be replaced: the same
    # inputs would always produce the same QR. This counter is the input that can
    # change, so `POST /badges/reissue` remains a real revocation.
    token_version = models.PositiveIntegerField(default=1)
    # Cleared to revoke a lost card without deleting its scan history.
    is_active = models.BooleanField(default=True)
    # DELETE /visitors/{id} is a soft delete: ScanEvent.visitor is PROTECT, and a
    # removed registration must not erase the entrance log it already produced.
    # Distinct from is_active — a revoked badge still belongs on the visitor list.
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ("full_name",)
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["is_active"]),
        ]

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def __str__(self) -> str:
        return f"{self.full_name} ({self.badge_serial})"
