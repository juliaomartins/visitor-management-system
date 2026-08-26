#!/usr/bin/env bash
#
# Fail if the generated API artifacts are out of date.
#
#   ./scripts/check_contracts.sh
#
# Three files in this repo are generated, never written by hand:
#
#   vms-backend/openapi.yaml       drf-spectacular, from the serializers and views
#   vms-contracts/openapi.yaml     a copy of the above
#   vms-contracts/src/schema.d.ts  openapi-typescript, from that copy
#
# This regenerates all three and then asks git whether anything moved. If it did,
# the committed artifacts disagree with the code that produces them, and the
# frontends are compiling against a schema the backend no longer serves — the
# failure shows up as a runtime 404 or an undefined field, long after the change
# that caused it.
#
# Run it before every commit. In CI, run it on every push.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

GENERATED=(
  "vms-backend/openapi.yaml"
  "vms-contracts/openapi.yaml"
  "vms-contracts/src/schema.d.ts"
)

# The shared venv, whichever layout this machine uses. PYTHON=... overrides.
if [ -n "${PYTHON:-}" ]; then
  :
elif [ -x "$ROOT/.venv/Scripts/python.exe" ]; then
  PYTHON="$ROOT/.venv/Scripts/python.exe"     # Windows
elif [ -x "$ROOT/.venv/bin/python" ]; then
  PYTHON="$ROOT/.venv/bin/python"             # POSIX
else
  PYTHON="python"
fi

echo "==> regenerating openapi.yaml"
( cd "$ROOT/vms-backend" \
  && DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.dev}" \
     "$PYTHON" manage.py spectacular --file openapi.yaml --fail-on-warn )

echo "==> regenerating contracts"
( cd "$ROOT/vms-contracts" && bash ./scripts/generate.sh )

echo "==> checking for drift"
# Working tree against the index, so staged regenerations count as up to date and
# a forgotten one does not. With nothing staged this is a plain check against HEAD.
if git diff --exit-code -- "${GENERATED[@]}"; then
  echo "contracts are up to date"
  exit 0
fi

cat >&2 <<'MESSAGE'

The generated API artifacts are stale.

Regeneration above changed at least one of them, which means a serializer, view
or route was edited without refreshing the schema the frontends compile against.

The files are already fixed in your working tree - stage them:

    git add vms-backend/openapi.yaml vms-contracts/openapi.yaml vms-contracts/src/schema.d.ts

MESSAGE
exit 1
