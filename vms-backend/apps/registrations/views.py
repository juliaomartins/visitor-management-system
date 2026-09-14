"""Public self-registration, and the admin switch for it.

KEPT OUT OF `apps.visitors` ON PURPOSE. The admin `VisitorViewSet` is IsAdmin on
every route; bolting an AllowAny action onto it would put one public door in a
class whose every other door is locked, and the next person to add a field to
its serializer would widen that door without noticing. Here the public surface
is its own viewset with its own four-field serializer, registered on its own
router under `/api/v1/public/`.

The badge is issued by the SAME service the admin path uses,
`visitors.services.register_visitor`: one serial generator, one token
derivation, one audit line. No PDF is rendered at creation -- the admin path
does not render one either; cards are drawn on demand by `/badges/card` when the
kiosk desk prints.
"""

import logging

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.visitors.models import Visitor, VisitorCategory, VisitorSource
from apps.visitors.services import register_visitor

from .models import RegistrationSettings
from .permissions import RegistrationOpen
from .photos import MAX_UPLOAD_BYTES
from .serializers import (
    PublicRegistrationResultSerializer,
    PublicRegistrationSerializer,
    PublicRegistrationStatusSerializer,
    RegistrationSettingsSerializer,
)
from .throttling import (
    PublicRegistrationGlobalThrottle,
    PublicRegistrationThrottle,
    PublicStatusThrottle,
)

audit = logging.getLogger("vms.audit")

#: The photo limit plus room for the text fields and multipart framing.
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 256 * 1024


class RequestTooLarge(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_detail = "The upload is too large."
    default_code = "too_large"


class PublicRegistrationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Create-only. No list, retrieve, update or delete route exists."""

    # No authenticator at all: a stale admin JWT in some browser must not turn
    # the public form into a 401, and nothing here depends on who is asking.
    authentication_classes = []
    permission_classes = [AllowAny, RegistrationOpen]
    throttle_classes = [PublicRegistrationThrottle, PublicRegistrationGlobalThrottle]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = PublicRegistrationSerializer
    queryset = Visitor.objects.none()

    def initial(self, request, *args, **kwargs):
        # Permission and throttles first, then refuse an oversized body BEFORE
        # anything parses it -- parsing is what writes the upload to disk.
        super().initial(request, *args, **kwargs)
        length = request.META.get("CONTENT_LENGTH") or ""
        if length.isdigit() and int(length) > MAX_REQUEST_BYTES:
            raise RequestTooLarge()

    @extend_schema(
        operation_id="public_registrations_create",
        summary="Register yourself as a visitor",
        description=(
            "Public, unauthenticated. Creates a visitor with category `normal` and "
            "issues their badge. Returns only what a success screen needs to draw "
            "the QR. 403 while registration is closed; 413 above the upload limit; "
            "429 when rate-limited."
        ),
        request={"multipart/form-data": PublicRegistrationSerializer},
        responses={
            201: PublicRegistrationResultSerializer,
            400: OpenApiResponse(description="A field failed validation."),
            403: OpenApiResponse(description="Registration is closed."),
            413: OpenApiResponse(description="The upload is too large."),
            429: OpenApiResponse(description="Too many registrations."),
        },
        tags=["public"],
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        visitor, raw_token = register_visitor(
            {
                **serializer.validated_data,
                "category": VisitorCategory.NORMAL,
                "source": VisitorSource.SELF,
            },
            actor=None,
        )

        result = PublicRegistrationResultSerializer(
            {
                "full_name": visitor.full_name,
                "badge_serial": visitor.badge_serial,
                "badge_token": raw_token,
            }
        )
        return Response(result.data, status=status.HTTP_201_CREATED)


class PublicRegistrationStatusView(APIView):
    """Whether the form should render at all."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [PublicStatusThrottle]

    @extend_schema(
        operation_id="public_registrations_status_retrieve",
        summary="Is public registration open?",
        responses={200: PublicRegistrationStatusSerializer},
        tags=["public"],
    )
    def get(self, request):
        settings_row = RegistrationSettings.load()
        return Response({"enabled": settings_row.public_registration_enabled})


class RegistrationSettingsView(APIView):
    """The admin switch. Admin-only, on the admin router, never under /public."""

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="registration_settings_retrieve",
        summary="Read the public registration switch",
        responses={200: RegistrationSettingsSerializer},
        tags=["registration-settings"],
    )
    def get(self, request):
        return Response(RegistrationSettingsSerializer(RegistrationSettings.load()).data)

    @extend_schema(
        operation_id="registration_settings_partial_update",
        summary="Open or close public registration",
        request=RegistrationSettingsSerializer,
        responses={200: RegistrationSettingsSerializer},
        tags=["registration-settings"],
    )
    def patch(self, request):
        row = RegistrationSettings.load()
        serializer = RegistrationSettingsSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        row = serializer.save(updated_by=request.user)

        audit.info(
            "registration.public_enabled=%s actor=%s",
            row.public_registration_enabled,
            getattr(request.user, "username", "anonymous"),
        )
        return Response(RegistrationSettingsSerializer(row).data)
