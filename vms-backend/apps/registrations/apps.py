from django.apps import AppConfig


class RegistrationsConfig(AppConfig):
    # The full dotted path, or makemigrations silently ignores the app
    # (CLAUDE.md constraint #7).
    name = "apps.registrations"
    verbose_name = "Public registration"
