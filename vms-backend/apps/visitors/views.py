"""Visitor CRUD for the dashboard. All routes are admin-only.

Filtering rides on DRF's own `SearchFilter`/`OrderingFilter` plus three explicit
query params. No `django-filter` — one dependency for three `if` statements is a
poor trade on a project that deliberately runs without Redis or Celery.

The list is unpaginated on purpose: the event is ~250 visitors on a LAN, and the
dashboard filters a single fetched collection far more smoothly than it pages.
"""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.common.permissions import IsAdmin

from . import services
from .models import Visitor, VisitorCategory
from .serializers import (
    VisitorDetailSerializer,
    VisitorIssuedSerializer,
    VisitorSerializer,
)

TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


@extend_schema_view(
    list=extend_schema(
        summary="List visitors",
        parameters=[
            OpenApiParameter(
                "category",
                OpenApiTypes.STR,
                description="Filter by badge category.",
                enum=[c.value for c in VisitorCategory],
            ),
            OpenApiParameter(
                "is_active",
                OpenApiTypes.BOOL,
                description="Filter by badge state. `false` lists revoked badges.",
            ),
            OpenApiParameter(
                "country",
                OpenApiTypes.STR,
                description="Exact country match, case-insensitive.",
            ),
        ],
    ),
    retrieve=extend_schema(summary="Visitor detail, with scan history"),
    create=extend_schema(
        summary="Register a visitor and issue a badge",
        description=(
            "Returns `badge_token`, the raw value for the QR code. It is stored "
            "only as a SHA-256 digest, so this response is the single chance to "
            "capture it — generate the badge PDF from it immediately."
        ),
    ),
    partial_update=extend_schema(summary="Edit a visitor"),
    destroy=extend_schema(summary="Soft-delete a visitor (also revokes the badge)"),
)
class VisitorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # photo upload
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["full_name", "organization", "badge_serial", "country"]
    ordering_fields = ["full_name", "country", "category", "badge_serial", "created_at"]
    ordering = ["full_name"]
    # No PUT: the API surface offers PATCH only.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        # Soft-deleted registrations are invisible everywhere in the API.
        queryset = Visitor.objects.filter(deleted_at__isnull=True)

        if self.action == "retrieve":
            queryset = queryset.prefetch_related("scan_events")

        params = self.request.query_params

        category = params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        country = params.get("country")
        if country:
            queryset = queryset.filter(country__iexact=country)

        is_active = (params.get("is_active") or "").lower()
        if is_active in TRUE_VALUES:
            queryset = queryset.filter(is_active=True)
        elif is_active in FALSE_VALUES:
            queryset = queryset.filter(is_active=False)

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VisitorDetailSerializer
        if self.action == "create":
            # `badge_token` is read-only, so this is the plain visitor payload on
            # the way in and the token-bearing payload on the way out.
            return VisitorIssuedSerializer
        return VisitorSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        visitor, raw_token = services.register_visitor(
            serializer.validated_data, actor=request.user
        )
        # Read by VisitorIssuedSerializer.badge_token, then discarded with the
        # response object. Never written to the database.
        visitor.badge_token = raw_token

        output = self.get_serializer(visitor)
        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(output.data),
        )

    def update(self, request, *args, **kwargs):
        visitor = self.get_object()
        serializer = self.get_serializer(
            visitor, data=request.data, partial=kwargs.pop("partial", False)
        )
        serializer.is_valid(raise_exception=True)

        services.update_visitor(visitor, serializer.validated_data, actor=request.user)
        return Response(self.get_serializer(visitor).data)

    def perform_destroy(self, instance):
        services.soft_delete_visitor(instance, actor=self.request.user)

    @extend_schema(
        summary="Revoke a lost badge",
        description=(
            "The visitor stays on the list and keeps their scan history; the "
            "badge stops working. Reprinting means issuing a new token."
        ),
        request=None,
        responses={200: VisitorSerializer},
    )
    @action(detail=True, methods=["post"])
    def revoke(self, request, *args, **kwargs):
        visitor = services.revoke_badge(self.get_object(), actor=request.user)
        return Response(VisitorSerializer(visitor, context=self.get_serializer_context()).data)
