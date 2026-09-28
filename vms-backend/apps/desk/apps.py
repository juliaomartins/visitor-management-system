from django.apps import AppConfig


class DeskConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    # Full dotted path: apps live in an `apps/` package, and without this
    # makemigrations silently ignores the app (CLAUDE.md constraint #7).
    name = "apps.desk"
