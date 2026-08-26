"""Shared routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path

from .views import HealthView

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
]
