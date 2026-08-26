"""ASGI entry point — THE way this project is served.

    uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 1

Never `--workers N`, never gunicorn with multiple workers (CLAUDE.md constraint
#1). `InMemoryChannelLayer` keeps group membership in a dict inside this process:
with two workers, a scan handled by worker 2 never reaches a screen connected to
worker 1, and it fails *intermittently* — the worst kind of bug at a live event.

Import order matters. `get_asgi_application()` runs before anything that touches
a model, or you get AppRegistryNotReady.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

django_asgi_app = get_asgi_application()  # MUST run before any model import

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.devices.middleware import DeviceAuthMiddleware  # noqa: E402
from apps.scans.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": DeviceAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
