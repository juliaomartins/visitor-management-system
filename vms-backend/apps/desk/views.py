"""The walk-in desk: two routes, and there will not be a third.

    POST /api/v1/desk/registrations   [desk device]  register a walk-in
    GET  /api/v1/desk/qr              [desk device]  draw that badge's QR

WHY THIS IS ITS OWN APP. The desk is reached without a login, from a laptop
standing in a public venue, so its surface has to be small enough to read in one
sitting: two views, one five-field serializer, no queryset a caller can widen.
Bolting a no-login route onto `apps.visitors` -- where every other route is
IsAdmin -- would put one open door in a corridor of locked ones.

WHAT A STOLEN DESK TOKEN BUYS, stated plainly because the LAN is plain http and
a token crossing it can be sniffed:

  * creating visitors (noisy: they appear on the dashboard list, marked `desk`,
    and the count moves);
  * drawing the QR for a badge token the holder ALREADY has.

It cannot list, search, read, edit or delete a visitor, cannot reach a photo,
a report or the roster, and cannot ask for a badge it did not just create --
`GET /desk/qr` takes the token itself, so there is nothing to enumerate. An
admin revokes the desk from `/devices` in one click, exactly like a lost phone.

TWO REFUSALS, AND THE DESK PAGE TREATS THEM DIFFERENTLY. No token, an unknown
token or a revoked one is 401: this browser has to pair again, and the page says
so. A token belonging to a scanner or a screen is 403 -- a real device of the
wrong kind, which pairing again would not fix.
"""

import io
import logging

from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.badges.services import qr_image
from apps.common.permissions import IsDeskDevice
from apps.devices.authentication import DeviceAuthentication
from apps.common.utils import hash_token
from apps.registrations.photos import MAX_UPLOAD_BYTES
from apps.visitors.models import Visitor, VisitorSource
from apps.visitors.services import register_visitor

from .serializers import DeskRegistrationResultSerializer, DeskRegistrationSerializer
from .throttling import DeskQrThrottle, DeskRegistrationThrottle

audit = logging.getLogger("vms.audit")

#: The photo limit plus room for the text fields and multipart framing.
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 256 * 1024

#: The header the QR route reads the badge token from.
#:
#: NOT A QUERY STRING. A badge token is a working credential, and uvicorn writes
#: query strings into its access log -- the same reason the screen's device token
#: is called out in CLAUDE.md. A header keeps it out of the log while leaving the
#: route a plain GET.
BADGE_TOKEN_HEADER = "X-Badge-Token"

#: Drawn at 41 modules; scaled up so a phone photographing the screen gets clean
#: edges whatever the browser does with the element.
QR_PIXELS = 960


class RequestTooLarge(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_detail = "The upload is too large."
    default_code = "too_large"


class DeskRegistrationView(APIView):
    """Create a visitor and return what the desk screen shows. Nothing else."""

    # Device auth only: an admin JWT left in a browser must not reach this
    # route, and a desk token is the only credential it accepts.
    authentication_classes = [DeviceAuthentication]
    permission_classes = [IsDeskDevice]
    throttle_classes = [DeskRegistrationThrottle]
    parser_classes = [MultiPartParser, FormParser]

    def initial(self, request, *args, **kwargs):
        # Permissions and throttles first, then refuse an oversized body BEFORE
        # anything parses it -- parsing is what writes the upload to disk.
        super().initial(request, *args, **kwargs)
        length = request.META.get("CONTENT_LENGTH") or ""
        if length.isdigit() and int(length) > MAX_REQUEST_BYTES:
            raise RequestTooLarge()

    @extend_schema(
        operation_id="desk_registrations_create",
        summary="Register a walk-in visitor",
        description=(
            "Desk devices only. Creates a visitor with `source=desk` and the "
            "chosen category, and issues their badge. The response is the one "
            "and only sight of the badge token. 413 above the upload limit; 429 "
            "when rate-limited."
        ),
        request={"multipart/form-data": DeskRegistrationSerializer},
        responses={
            201: DeskRegistrationResultSerializer,
            400: OpenApiResponse(description="A field failed validation."),
            403: OpenApiResponse(description="A paired desk device is required."),
            413: OpenApiResponse(description="The upload is too large."),
            429: OpenApiResponse(description="Too many registrations."),
        },
        tags=["desk"],
    )
    def post(self, request):
        serializer = DeskRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # The same service the admin desk and the public form use: one serial
        # generator, one token derivation, one audit line.
        visitor, raw_token = register_visitor(
            {**serializer.validated_data, "source": VisitorSource.DESK},
            actor=None,
        )

        # Which desk, on top of the service's own line: these registrations are
        # the ones nobody signed in to make.
        device = request.auth
        audit.info(
            "desk.register device=%s name=%s visitor=%s serial=%s category=%s",
            getattr(device, "pk", None),
            getattr(device, "name", None),
            visitor.pk,
            visitor.badge_serial,
            visitor.category,
        )

        result = DeskRegistrationResultSerializer(
            {
                "full_name": visitor.full_name,
                "badge_serial": visitor.badge_serial,
                "badge_token": raw_token,
                "category": visitor.category,
            }
        )
        return Response(result.data, status=status.HTTP_201_CREATED)


class DeskQrView(APIView):
    """Draw the QR for a badge token the caller already holds.

    The token is the lookup key, so this route cannot be walked: there is no id
    and no serial to increment, and a token is 64 hex characters. A badge that
    has been soft-deleted is refused -- the desk should not be handing out a
    code the door will turn away.
    """

    authentication_classes = [DeviceAuthentication]
    permission_classes = [IsDeskDevice]
    throttle_classes = [DeskQrThrottle]

    @extend_schema(
        operation_id="desk_qr_retrieve",
        summary="Draw the QR code for a badge",
        description=(
            "Desk devices only. Send the badge token from the registration "
            "response in the `X-Badge-Token` header -- never in the query "
            "string, which the server writes to its access log. Returns a PNG "
            "for the visitor to photograph."
        ),
        parameters=[
            OpenApiParameter(
                name=BADGE_TOKEN_HEADER,
                type=str,
                location=OpenApiParameter.HEADER,
                required=True,
                description="The badge token returned by POST /desk/registrations.",
            )
        ],
        responses={
            (200, "image/png"): OpenApiResponse(
                response={"type": "string", "format": "binary"},
                description="The QR code, with the event mark in the middle.",
            ),
            400: OpenApiResponse(description="No badge token was sent."),
            403: OpenApiResponse(description="A paired desk device is required."),
            404: OpenApiResponse(description="No badge matches that token."),
        },
        tags=["desk"],
    )
    def get(self, request):
        raw_token = request.headers.get(BADGE_TOKEN_HEADER, "").strip()
        if not raw_token:
            raise ValidationError({BADGE_TOKEN_HEADER: ["This header is required."]})

        visitor = Visitor.objects.filter(
            token_hash=hash_token(raw_token), deleted_at__isnull=True
        ).first()
        if visitor is None:
            raise NotFound("No badge matches that token.")

        image = qr_image(raw_token).resize((QR_PIXELS, QR_PIXELS))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

        response = HttpResponse(buffer.getvalue(), content_type="image/png")
        # A badge QR is a credential: no shared cache may keep a copy of it.
        response["Cache-Control"] = "no-store, private"
        return response
