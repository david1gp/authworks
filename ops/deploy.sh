#!/usr/bin/env bash
set -euo pipefail

echo "Running the @adaptive-ds/authworks deployment preflight."
bun run check

if [[ -n "${AUTHWORKS_SMOKE_URL:-}" ]]; then
	bun run smoke:public
else
	echo "Skipping public smoke; set AUTHWORKS_SMOKE_URL to run it."
fi

echo "Build, tests, and configured smoke checks complete."
