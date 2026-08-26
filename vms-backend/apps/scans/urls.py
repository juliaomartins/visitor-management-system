"""Scan routes, mounted at /api/v1/ by config/urls.py.

`/screen/feed` sits here rather than in its own app: it reads ScanEvent and
serves the same payload as the consumer will in phase 2.
"""

from django.urls import path

from .views import ScanView, ScreenFeedView

urlpatterns = [
    path("scans", ScanView.as_view(), name="scans"),
    path("screen/feed", ScreenFeedView.as_view(), name="screen-feed"),
]
