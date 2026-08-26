"""Badge routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path

from .views import BadgeCardView, BadgeReissueSheetView

urlpatterns = [
    path("badges/card", BadgeCardView.as_view(), name="badge-card"),
    path(
        "badges/reissue-sheet",
        BadgeReissueSheetView.as_view(),
        name="badge-reissue-sheet",
    ),
]
