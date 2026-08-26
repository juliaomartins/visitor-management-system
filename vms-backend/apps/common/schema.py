"""Schema plumbing: publish serializer components no endpoint reaches yet.

drf-spectacular only emits a component for a serializer some endpoint reaches.
Phase 0 has no endpoints, which would leave `openapi.yaml` empty and make the
generated contracts useless. This postprocessing hook resolves the phase 0
serializers through drf-spectacular's own machinery so `schema.d.ts` is real,
derived output — never hand-written (CLAUDE.md constraint #8).

As of phase 1b only `UserSerializer` is still listed: every other serializer is
now reached by a real endpoint. It stays because the dashboard's generated types
should include the admin account shape, and no endpoint returns it yet. Delete
this module the moment one does.
"""

from rest_framework.views import APIView

PHASE_0_COMPONENTS = [
    "apps.accounts.serializers.UserSerializer",
]


def _import(path: str):
    module_path, _, name = path.rpartition(".")
    module = __import__(module_path, fromlist=[name])
    return getattr(module, name)


def register_phase0_components(result, generator, request, public, **kwargs):
    """POSTPROCESSING_HOOK: add the phase 0 serializers to `components.schemas`."""
    from drf_spectacular.openapi import AutoSchema
    from drf_spectacular.plumbing import ResolvedComponent

    schemas = result.setdefault("components", {}).setdefault("schemas", {})

    for path in PHASE_0_COMPONENTS:
        serializer_class = _import(path)

        schema = AutoSchema()
        schema.registry = generator.registry
        schema.method = "GET"
        schema.path = "/"
        schema.view = APIView()
        schema.view.request = request

        schema.resolve_serializer(serializer_class(), ResolvedComponent.SCHEMA)

    # resolve_serializer() registers nested components too; take the lot.
    for component in generator.registry._components.values():
        if component.type == ResolvedComponent.SCHEMA:
            schemas.setdefault(component.name, component.schema)

    return result
