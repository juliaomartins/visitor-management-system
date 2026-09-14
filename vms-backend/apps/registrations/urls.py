"""Admin routes for public registration, mounted at /api/v1/ by config/urls.py.

    GET   /api/v1/registration-settings    read the switch     [admin]
    PATCH /api/v1/registration-settings    open or close it    [admin]
"""

from django.urls import path

from .views import RegistrationSettingsView

urlpatterns = [
    path(
        "registration-settings",
        RegistrationSettingsView.as_view(),
        name="registration-settings",
    ),
]
