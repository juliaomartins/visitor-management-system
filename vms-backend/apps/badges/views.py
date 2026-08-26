"""Badge PDFs.

    POST /api/v1/badges/card           [admin]  one card, from a raw token
    POST /api/v1/badges/reissue-sheet  [admin]  an A4 sheet, reissuing as it goes

Both are POST because both carry something that must not sit in a URL: a raw badge
token in the first case, and a destructive reissue in the second.
"""

from django.db import transaction
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.common.utils import hash_token
from apps.visitors.models import Visitor

from . import services
from .serializers import (
    BadgeCardRequestSerializer,
    BadgeReissueSheetRequestSerializer,
)

PDF = "application/pdf"


class RenderingUnavailable(APIException):
    """503 rather than 500: the server is fine, one capability is missing."""

    status_code = 503
    default_code = "pdf_rendering_unavailable"


def _render(call):
    """Turn a missing GTK runtime into an answer, not a stack trace."""
    try:
        return call()
    except services.BadgeRenderingUnavailable as exc:
        raise RenderingUnavailable(str(exc)) from exc


def _pdf(content: bytes, filename: str) -> HttpResponse:
    response = HttpResponse(content, content_type=PDF)
    # `inline` so a browser previews it; the registrar prints from the viewer
    # rather than hunting through a downloads folder mid-queue.
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response


class BadgeCardView(APIView):
    """Render one badge from the token the receipt is still holding."""

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="badges_card_create",
        summary="Render a single badge PDF",
        description=(
            "Takes the raw badge token returned once by `POST /visitors` and "
            "returns a CR80 card as a PDF. The token draws the QR and is then "
            "discarded; it is never stored, and the visitor is resolved from its "
            "digest.\n\n"
            "There is no GET equivalent. Only the digest is kept, so the server "
            "cannot reprint a card without being handed the token again."
        ),
        request=BadgeCardRequestSerializer,
        responses={
            200: OpenApiResponse(OpenApiTypes.BINARY, description="A CR80 badge PDF."),
            404: OpenApiResponse(description="No visitor holds that token."),
        },
        tags=["badges"],
    )
    def post(self, request):
        serializer = BadgeCardRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        raw_token = serializer.validated_data["token"]
        visitor = Visitor.objects.filter(
            token_hash=hash_token(raw_token), deleted_at__isnull=True
        ).first()

        if visitor is None:
            # Deliberately the same answer for a wrong token and a deleted
            # visitor: this endpoint should not confirm which tokens exist.
            raise NotFound("No visitor holds that token.")

        pdf = _render(lambda: services.render_card_pdf(visitor, raw_token))
        return _pdf(pdf, f"badge-{visitor.badge_serial}.pdf")


class BadgeReissueSheetView(APIView):
    """Print a sheet, and reissue every badge on it.

    Named for what it does rather than what it produces. There is no way to
    reprint an existing card — the raw token was never stored — so putting a
    visitor on this sheet mints them a new token and kills the old one. Any card
    already in someone's hand stops scanning the moment this runs.
    """

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="badges_reissue_sheet_create",
        summary="Reissue badges and render an A4 sheet",
        description=(
            "DESTRUCTIVE. Every listed visitor is given a NEW badge token, which "
            "invalidates the QR on any card already printed for them, including "
            "one they are currently wearing.\n\n"
            "This is not a choice the endpoint makes: the raw token exists only at "
            "the moment it is created, so reprinting is impossible and reissuing "
            "is the only thing the server can do.\n\n"
            "Ten cards per A4 sheet with cut marks; more than ten paginates."
        ),
        request=BadgeReissueSheetRequestSerializer,
        responses={
            200: OpenApiResponse(
                OpenApiTypes.BINARY, description="An A4 sheet of badges as a PDF."
            )
        },
        tags=["badges"],
    )
    def post(self, request):
        serializer = BadgeReissueSheetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested = serializer.validated_data["visitor_ids"]
        found = {
            str(visitor.id): visitor
            for visitor in Visitor.objects.filter(
                id__in=requested, deleted_at__isnull=True
            )
        }

        missing = [str(pk) for pk in requested if str(pk) not in found]
        if missing:
            # Refuse the whole run rather than silently printing a short sheet —
            # a sheet with a gap is a sheet somebody reconciles by hand.
            raise ValidationError(
                {"visitor_ids": [f"Unknown or deleted visitors: {', '.join(missing)}"]}
            )

        # Preserve the caller's order: the sheet is cut in reading order and the
        # registrar hands cards out from the top.
        ordered = [found[str(pk)] for pk in requested]

        # Reissue and render together, or not at all.
        #
        # The tokens are minted before anything is drawn, so a render that fails
        # would otherwise leave every visitor on the sheet with a dead old card
        # and no new one to replace it — the worst possible outcome, and one that
        # cannot be undone because the new raw tokens die with the request. The
        # transaction puts the old digests back.
        with transaction.atomic():
            issued = services.reissue_badges(ordered, actor=request.user)
            pdf = _render(lambda: services.render_a4_sheet_pdf(issued))

        return _pdf(pdf, f"badge-sheet-{len(issued)}.pdf")
