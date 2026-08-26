"""WebSocket routes.

Registered in `config/asgi.py`, not `config/urls.py` — `ws/screen/` is not an
HTTP path and will never appear in `openapi.yaml`.
"""

from django.urls import path

from .consumers import ScreenConsumer

websocket_urlpatterns = [
    path("ws/screen/", ScreenConsumer.as_asgi()),
]
