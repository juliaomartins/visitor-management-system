"""Badge PDFs.

    POST /api/v1/badges/card           [admin]  one card, from a raw token
    POST /api/v1/badges/reissue-sheet  [admin]  an A4 sheet, reissuing as it goes
    POST /api/v1/badges/export         [admin]  an .xlsx with QR, reissuing as it goes
    POST /api/v1/badges/reissue        [admin]  raw tokens as JSON, reissuing as it goes
    GET  /api/v1/badges/roster.xlsx    [admin]  photo + QR, reissuing NOTHING

The three POSTs carry something that must not sit in a URL: a raw badge token in
the first case, a destructive reissue in the other two. The roster is a GET
because it only reads.
"""

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.common.utils import hash_token
from apps.visitors.models import Visitor

from . import services
from . import exports
from .serializers import (
    BadgeCardRequestSerializer,
    BadgeExportRequestSerializer,
    BadgeReissueSheetRequestSerializer,
    ReissueResponseSerializer,
)

PDF = "application/pdf"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


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


def _xlsx(content: bytes, filename: str) -> HttpResponse:
    """Always an attachment. A browser cannot preview a workbook anyway, and a
    credential file should land in a folder rather than a tab somebody forgets."""
    response = HttpResponse(content, content_type=XLSX)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# Long enough for a full formal name, short enough that the header cannot drift
# near the filesystem's limit once the stem and the date are in front of it.
NAME_SLUG_LIMIT = 40


def _export_name(stem: str, *, suffix: str = "") -> str:
    """`stem-YYYY-MM-DD[-suffix].xlsx`, dated in the timezone the doors are in.

    `timezone.localdate()` and not `date.today()`: storage is UTC and the event
    is in Asia/Dili, so for the first nine hours of every local day those two
    disagree. An export at 09:00 on the 2nd would be filed as the 1st.

    ISO order because a downloads folder sorted by name is then sorted by date,
    which is the only reason to put a date in a filename. `apps/reports` already
    names its files this way.
    """
    dated = f"{stem}-{timezone.localdate().isoformat()}"
    return f"{dated}-{suffix}.xlsx" if suffix else f"{dated}.xlsx"


def _visitor_slug(visitor: Visitor) -> str:
    """A visitor's name, safe for both a filename and the header carrying it.

    `Content-Disposition` here is the plain `filename="..."` form with no RFC
    5987 `filename*`, so the value has to be ASCII — a raw accent makes the
    header malformed rather than pretty. `slugify` folds it: José do Rosário
    becomes jose-do-rosario.

    A name written in a non-Latin script folds to NOTHING, and this is an
    international conference — so the badge serial stands in rather than
    letting the file come out named for the date and a stray hyphen.
    """
    return slugify(visitor.full_name)[:NAME_SLUG_LIMIT].strip("-") or (
        visitor.badge_serial.lower()
    )


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
        summary="Reissue badges and render a printable PDF",
        description=(
            "DESTRUCTIVE. Every listed visitor is given a NEW badge token, which "
            "invalidates the QR on any card already printed for them, including "
            "one they are currently wearing.\n\n"
            "This is not a choice the endpoint makes: the raw token exists only at "
            "the moment it is created, so reprinting is impossible and reissuing "
            "is the only thing the server can do.\n\n"
            "Nine cards per A4 sheet with cut marks; more than nine paginates. "
            "A run of exactly one comes back as a single 54x85.6mm card page "
            "instead, since one card on A4 wastes the sheet."
        ),
        request=BadgeReissueSheetRequestSerializer,
        responses={
            200: OpenApiResponse(
                OpenApiTypes.BINARY,
                description=(
                    "An A4 sheet of badges as a PDF, or a single CR80 card "
                    "page when exactly one visitor was requested."
                ),
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
            issued = services.collect_badge_tokens(ordered, actor=request.user)
            pdf = _render(lambda: services.render_a4_sheet_pdf(issued))

        # One visitor comes back as a single card page, so name the file for what
        # is actually in it rather than for the endpoint that produced it.
        if len(issued) == 1:
            return _pdf(pdf, f"badge-{issued[0][0].badge_serial}.pdf")
        return _pdf(pdf, f"badge-sheet-{len(issued)}.pdf")


class BadgeRosterExportView(APIView):
    """The visitor list as a spreadsheet: photograph, name and the live QR.

    Safe to run at any point during the event: it reissues nothing, so every card
    already in circulation keeps working. The QR it draws is the one already on
    that card — `badge_token` derives it, so producing it costs nothing.

    It is consequently a file of working badges. That is not the same as
    destructive, but it is not the credential-free list this endpoint used to
    return; see the note in `exports.py`.
    """

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="badges_roster_export_retrieve",
        summary="Export the visitor roster as .xlsx",
        description=(
            "Who is registered, as a printing worklist: a title banner naming "
            "the event, then No. / Name / Country / Organization / Photo / "
            "QR Code / Registered from row 5, with the banner frozen.\n\n"
            "NON-DESTRUCTIVE. Nothing is reissued and no card stops working. "
            "Each QR is the visitor's existing badge token, derived rather "
            "than stored, so the code drawn here is the code already on "
            "their card.\n\n"
            "It therefore contains working credentials. Use POST "
            "/badges/export instead only when an outside card producer needs "
            "freshly minted tokens and every current card is being replaced."
        ),
        responses={
            200: OpenApiResponse(
                OpenApiTypes.BINARY, description="An .xlsx workbook."
            )
        },
        tags=["badges"],
    )
    def get(self, request):
        visitors = list(
            Visitor.objects.filter(deleted_at__isnull=True).order_by("full_name")
        )
        workbook = exports.build_roster_workbook(visitors)
        return _xlsx(workbook, _export_name("visitors"))


class BadgeCredentialExportView(APIView):
    """The visitor list WITH a scannable QR per row — by reissuing every one.

    This is the file a card producer needs, and the reason it is destructive is
    the reason the system is safe: the raw token exists only on the printed card
    and in the response that created it. To put a working QR in a spreadsheet the
    server has to mint a new one, which retires the card the visitor is holding.
    """

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="badges_export_create",
        summary="Reissue badges and export them as .xlsx with QR codes",
        description=(
            "DESTRUCTIVE. Every visitor in the file is given a NEW badge token, "
            "which invalidates the QR on any card already printed for them.\n\n"
            "This is not a choice the endpoint makes: the raw token is stored "
            "nowhere, so a scannable QR can be minted but never recovered.\n\n"
            "The workbook carries the QR as an image and the exact payload as "
            "text, so a card producer can re-render it at their own size. A "
            "second sheet spells out what the file is, because a spreadsheet "
            "outlives the click that made it.\n\n"
            "Omit `visitor_ids` to take every visitor who has not been deleted."
        ),
        request=BadgeExportRequestSerializer,
        responses={
            200: OpenApiResponse(
                OpenApiTypes.BINARY,
                description="An .xlsx workbook with one QR per visitor.",
            )
        },
        tags=["badges"],
    )
    def post(self, request):
        serializer = BadgeExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested = serializer.validated_data.get("visitor_ids")

        if requested:
            found = {
                str(visitor.id): visitor
                for visitor in Visitor.objects.filter(
                    id__in=requested, deleted_at__isnull=True
                )
            }
            missing = [str(pk) for pk in requested if str(pk) not in found]
            if missing:
                # Refuse the whole run rather than silently exporting a short file
                # — a gap here is a visitor who arrives with a dead badge.
                raise ValidationError(
                    {
                        "visitor_ids": [
                            f"Unknown or deleted visitors: {', '.join(missing)}"
                        ]
                    }
                )
            ordered = [found[str(pk)] for pk in requested]
        else:
            ordered = list(
                Visitor.objects.filter(deleted_at__isnull=True).order_by("full_name")
            )
            if not ordered:
                raise ValidationError(
                    {"visitor_ids": ["There are no visitors to export."]}
                )

        # Reissue and build together, or not at all. The new raw tokens die with
        # this request, so a failure after minting would leave every visitor with
        # a dead card and no file to print a new one from.
        with transaction.atomic():
            issued = services.collect_badge_tokens(ordered, actor=request.user)
            workbook = _render(lambda: exports.build_credential_workbook(issued))

        # The suffix names a DELIBERATE selection, so it keys off whether ids
        # were sent rather than off the count: exporting everyone by selecting
        # nobody gets no suffix, while selecting all of them explicitly does.
        #
        # One visitor gets their name. Several get a count, because a filename
        # cannot carry forty names and electing one of them to stand for the
        # rest reads as though the file were about that person.
        if not requested:
            suffix = ""
        elif len(issued) == 1:
            suffix = _visitor_slug(issued[0][0])
        else:
            suffix = f"{len(issued)}-visitors"

        return _xlsx(workbook, _export_name("visitors-badges", suffix=suffix))


class BadgeReissueView(APIView):
    """Reissue badges and hand the RAW tokens back as JSON.

    This is what lets the dashboard show a working QR on screen. It has to
    reissue, for the same reason everything else here does: the server keeps
    `sha256(token)` and cannot reproduce the code already printed on a card.

    The response is the only copy of these tokens. Nothing caches it, and it is
    admin-only — the same disclosure `POST /visitors` already makes at
    registration, which is the other moment a raw token is visible.
    """

    permission_classes = [IsAdmin]

    @extend_schema(
        operation_id="badges_reissue_create",
        summary="Reissue badges and return their raw tokens",
        description=(
            "DESTRUCTIVE. Every listed visitor is given a NEW badge token, which "
            "invalidates the QR on any card already printed for them.\n\n"
            "Returns the raw tokens so a client can render the QR itself — on "
            "screen, or into its own layout. The server cannot return the token "
            "of an existing card, only of one it has just minted.\n\n"
            "This response is the ONLY copy. Nothing stores it."
        ),
        request=BadgeReissueSheetRequestSerializer,
        responses={200: ReissueResponseSerializer},
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
            raise ValidationError(
                {"visitor_ids": [f"Unknown or deleted visitors: {', '.join(missing)}"]}
            )

        ordered = [found[str(pk)] for pk in requested]

        with transaction.atomic():
            issued = services.rotate_badge_tokens(ordered, actor=request.user)

        payload = ReissueResponseSerializer(
            {
                "issued": [
                    {
                        "visitor_id": visitor.id,
                        "badge_serial": visitor.badge_serial,
                        "full_name": visitor.full_name,
                        "category": visitor.category,
                        "token": raw_token,
                    }
                    for visitor, raw_token in issued
                ]
            }
        ).data

        response = Response(payload)
        # The one response in this API that must never sit in a cache.
        response["Cache-Control"] = "no-store, max-age=0"
        return response
