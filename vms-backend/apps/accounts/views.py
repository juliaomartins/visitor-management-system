"""Admin authentication.

Three endpoints, all simplejwt underneath:

    POST /api/v1/auth/token            username + password → access (+ cookie)
    POST /api/v1/auth/token/refresh    cookie → fresh access (+ rotated cookie)
    POST /api/v1/auth/token/blacklist  cookie → revoked, cookie cleared

The refresh token never appears in a response body. It is set as an httpOnly
cookie scoped to `/api/v1/auth`, so the dashboard holds only the short-lived
access token, in memory. This app stores every visitor's photo — a refresh token
sitting in localStorage is not a risk worth taking.
"""

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

from .serializers import (
    AccessTokenSerializer,
    AdminTokenObtainPairSerializer,
    RefreshTokenSerializer,
)

COOKIE = settings.REFRESH_COOKIE


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE["NAME"],
        token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=COOKIE["SECURE"],
        samesite=COOKIE["SAMESITE"],
        path=COOKIE["PATH"],
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE["NAME"], path=COOKIE["PATH"], samesite=COOKIE["SAMESITE"])


def _access_only(response_data: dict) -> tuple[dict, str | None]:
    """Split simplejwt's payload into the body we return and the cookie value."""
    data = dict(response_data)
    refresh = data.pop("refresh", None)
    return data, refresh


def _refresh_from_request(request) -> str:
    """Body first, cookie second. Browsers only ever use the cookie."""
    supplied = request.data.get("refresh") if hasattr(request.data, "get") else None
    return supplied or request.COOKIES.get(COOKIE["NAME"]) or ""


class AdminTokenObtainPairView(TokenObtainPairView):
    """`POST /api/v1/auth/token` — admin login."""

    serializer_class = AdminTokenObtainPairSerializer

    @extend_schema(
        operation_id="auth_token_create",
        summary="Admin login",
        responses={200: AccessTokenSerializer},
        auth=[],
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        body, refresh = _access_only(serializer.validated_data)
        response = Response(body, status=status.HTTP_200_OK)
        if refresh:
            _set_refresh_cookie(response, refresh)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """`POST /api/v1/auth/token/refresh` — rotate on the cookie.

    `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION` mean every call issues a
    new refresh token and kills the old one, so the cookie is rewritten here.
    """

    @extend_schema(
        operation_id="auth_token_refresh_create",
        summary="Refresh the access token",
        request=RefreshTokenSerializer,
        responses={200: AccessTokenSerializer},
        auth=[],
    )
    def post(self, request, *args, **kwargs):
        token = _refresh_from_request(request)
        if not token:
            raise InvalidToken("No refresh token was supplied.")

        serializer = self.get_serializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:  # pragma: no cover - simplejwt re-raise path
            raise InvalidToken(exc.args[0]) from exc

        body, refresh = _access_only(serializer.validated_data)
        response = Response(body, status=status.HTTP_200_OK)
        if refresh:
            _set_refresh_cookie(response, refresh)
        return response


class CookieTokenBlacklistView(TokenBlacklistView):
    """`POST /api/v1/auth/token/blacklist` — logout.

    Blacklisting an already-dead token still clears the cookie: a logout must not
    leave the browser holding something that looks like a session.
    """

    @extend_schema(
        operation_id="auth_token_blacklist_create",
        summary="Log out",
        request=RefreshTokenSerializer,
        responses={205: None},
        auth=[],
    )
    def post(self, request, *args, **kwargs):
        token = _refresh_from_request(request)
        response = Response(status=status.HTTP_205_RESET_CONTENT)

        if token:
            serializer = self.get_serializer(data={"refresh": token})
            try:
                serializer.is_valid(raise_exception=True)
            except (TokenError, InvalidToken):
                pass  # already expired or blacklisted — logout is still a logout

        _clear_refresh_cookie(response)
        return response
