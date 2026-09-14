"""The switch that opens and closes public self-registration.

ONE ROW, ENFORCED BY THE DATABASE. The flag is event-wide, not per user, so it is
a singleton: the primary key is pinned to 1 and a check constraint refuses any
other value. `load()` creates the row on first read, so there is no data
migration to forget and no "settings missing" state to handle anywhere.

It lives in the database and not in the browser because the endpoint has to
enforce it. A switch the dashboard merely hides the form behind is a switch
anyone with `curl` walks past.
"""

from django.conf import settings
from django.db import models


class RegistrationSettings(models.Model):
    SINGLETON_ID = 1

    id = models.PositiveSmallIntegerField(
        primary_key=True, default=SINGLETON_ID, editable=False
    )
    # Closed until an admin opens it. A fresh install must not accept strangers.
    public_registration_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "registration settings"
        verbose_name_plural = "registration settings"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(id=1),
                name="registration_settings_singleton",
            ),
        ]

    def save(self, *args, **kwargs):
        # Whatever the caller set, there is only ever row 1.
        self.pk = self.SINGLETON_ID
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "RegistrationSettings":
        row, _ = cls.objects.get_or_create(pk=cls.SINGLETON_ID)
        return row

    def __str__(self) -> str:
        state = "open" if self.public_registration_enabled else "closed"
        return f"Public registration: {state}"
