"""The walk-in desk's two routes, mounted at `/api/v1/desk/`.

Two paths, two methods, and that is the whole app. No router, because a router
would generate list, retrieve, update and destroy routes for a viewset the
moment somebody swapped the base class -- on the one part of this API reachable
without a login.
"""

from django.urls import path

from .views import DeskQrView, DeskRegistrationView

urlpatterns = [
    path("registrations", DeskRegistrationView.as_view(), name="desk-registrations"),
    path("qr", DeskQrView.as_view(), name="desk-qr"),
]
