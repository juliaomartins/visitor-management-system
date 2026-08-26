"""Device routes, mounted at /api/v1/ by config/urls.py."""

from rest_framework.routers import SimpleRouter

from .views import DeviceViewSet

router = SimpleRouter(trailing_slash=False)
router.register("devices", DeviceViewSet, basename="device")

urlpatterns = router.urls
