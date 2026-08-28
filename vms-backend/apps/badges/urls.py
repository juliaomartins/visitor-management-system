"""Badge routes, mounted at /api/v1/ by config/urls.py."""

from django.urls import path

from .views import (
    BadgeCardView,
    BadgeCredentialExportView,
    BadgeReissueSheetView,
    BadgeReissueView,
    BadgeRosterExportView,
)

urlpatterns = [
    path("badges/card", BadgeCardView.as_view(), name="badge-card"),
    path(
        "badges/reissue-sheet",
        BadgeReissueSheetView.as_view(),
        name="badge-reissue-sheet",
    ),
    # Reads only. Safe during the event.
    path("badges/roster.xlsx", BadgeRosterExportView.as_view(), name="badge-roster"),
    # Reissues every row. See the view.
    path("badges/export", BadgeCredentialExportView.as_view(), name="badge-export"),
    # Reissues, and returns the raw tokens so a client can draw the QR itself.
    path("badges/reissue", BadgeReissueView.as_view(), name="badge-reissue"),
]
