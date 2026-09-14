from rest_framework.permissions import BasePermission

from .models import RegistrationSettings


class RegistrationOpen(BasePermission):
    """403 while public registration is switched off, whatever the client sent.

    Read from the database on every request -- one primary-key lookup -- so an
    admin closing registration takes effect on the very next submission, with no
    cache to wait out.

    With `authentication_classes = []` on the view, DRF answers a failed
    permission with 403 rather than 401: there is nothing to authenticate with.
    """

    message = "Registration is closed."

    def has_permission(self, request, view) -> bool:
        return RegistrationSettings.load().public_registration_enabled
