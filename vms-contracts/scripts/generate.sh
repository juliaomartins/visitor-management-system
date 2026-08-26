#!/usr/bin/env bash
# Regenerate the contracts from the backend's OpenAPI schema.
#
# Run this after ANY serializer change:
#   cd vms-backend && python manage.py spectacular --file openapi.yaml
#   cd ../vms-contracts && ./scripts/generate.sh
#
# src/schema.d.ts is generated output — never hand-edit it (CLAUDE.md #8).
set -euo pipefail

cd "$(dirname "$0")/.."

BACKEND_SCHEMA="../vms-backend/openapi.yaml"

if [ ! -f "$BACKEND_SCHEMA" ]; then
  echo "error: $BACKEND_SCHEMA not found — generate it in vms-backend first." >&2
  exit 1
fi

cp "$BACKEND_SCHEMA" ./openapi.yaml
npx --yes openapi-typescript ./openapi.yaml -o ./src/schema.d.ts

echo "contracts regenerated from $BACKEND_SCHEMA"
