"""Report routes, mounted at /api/v1/ by config/urls.py.

The extension is part of the path rather than a `?format=` parameter: it is what
makes a browser save the file with a sensible name, and it is what a person types.
"""

from django.urls import path

from .views import (
    EntryCsvView,
    EntryDocumentView,
    EntryReportView,
    EntryWorkbookView,
)

urlpatterns = [
    path("reports/entries", EntryReportView.as_view(), name="report-entries"),
    path("reports/entries.csv", EntryCsvView.as_view(), name="report-entries-csv"),
    path("reports/entries.xlsx", EntryWorkbookView.as_view(), name="report-entries-xlsx"),
    path("reports/entries.pdf", EntryDocumentView.as_view(), name="report-entries-pdf"),
]
