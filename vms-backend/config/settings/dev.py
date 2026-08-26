"""Local development settings. LAN uses http://, never https:// (constraint #9)."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = ["*"]

# The dashboard/screen are served from other origins on the LAN.
CORS_ALLOW_ALL_ORIGINS = True

CSRF_TRUSTED_ORIGINS = env(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
