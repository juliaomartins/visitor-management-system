"""Routes reachable WITHOUT a token, mounted at /api/v1/public/ by config/urls.py.

A router of its own, included separately from every admin router, so the whole
unauthenticated surface of the backend is this one file:

    POST /api/v1/public/registrations          register yourself
    GET  /api/v1/public/registrations/status   is the form open?

(`/api/v1/devices/pair` predates this and stays where it is.)
"""

from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import PublicRegistrationStatusView, PublicRegistrationViewSet

router = SimpleRouter(trailing_slash=False)
router.register(
    "registrations", PublicRegistrationViewSet, basename="public-registration"
)

urlpatterns = [
    # Before the router's patterns, so `status` is never read as a detail id --
    # the viewset has no detail route today, and this keeps it that way safely.
    path(
        "registrations/status",
        PublicRegistrationStatusView.as_view(),
        name="public-registration-status",
    ),
    *router.urls,
]
