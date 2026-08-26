"""Admin accounts. There are no visitor logins — visitors carry a printed badge."""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Dashboard administrators only.

    Subclassed up front so the project is never stuck on Django's default user;
    swapping AUTH_USER_MODEL after the first migration is a data migration.
    """

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self) -> str:
        return self.get_username()
