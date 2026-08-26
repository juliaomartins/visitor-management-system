"""Auth routes, mounted at /api/v1/auth/ by config/urls.py.

No trailing slashes — the API surface in CLAUDE.md is written without them.
"""

from django.urls import path

from .views import (
    AdminTokenObtainPairView,
    CookieTokenBlacklistView,
    CookieTokenRefreshView,
)

urlpatterns = [
    path("token", AdminTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("token/blacklist", CookieTokenBlacklistView.as_view(), name="token_blacklist"),
]
