"""Visitor routes, mounted at /api/v1/ by config/urls.py.

`SimpleRouter` rather than `DefaultRouter`: no API-root view, and
`trailing_slash=False` keeps the paths exactly as CLAUDE.md documents them —
`/api/v1/visitors`, not `/api/v1/visitors/`.
"""

from rest_framework.routers import SimpleRouter

from .views import VisitorViewSet

router = SimpleRouter(trailing_slash=False)
router.register("visitors", VisitorViewSet, basename="visitor")

urlpatterns = router.urls
