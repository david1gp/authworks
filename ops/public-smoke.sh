#!/usr/bin/env bash
set -euo pipefail

: "${AUTHWORKS_SMOKE_URL:?Set AUTHWORKS_SMOKE_URL to the deployed HTTPS origin.}"

base_url="${AUTHWORKS_SMOKE_URL%/}"
case "$base_url" in
	https://*) ;;
	*)
		echo "AUTHWORKS_SMOKE_URL must use https://." >&2
		exit 1
		;;
esac

if [[ "$base_url" == *\?* || "$base_url" == *#* ]]; then
	echo "AUTHWORKS_SMOKE_URL must be an origin without a query or fragment." >&2
	exit 1
fi

timeout_seconds="${AUTHWORKS_SMOKE_TIMEOUT_SECONDS:-15}"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT

request() {
	local pathname="$1"
	local expected_status="$2"
	local body_path="$3"
	local headers_path="$4"
	local actual_status

	actual_status="$(curl --silent --show-error --location --proto '=https' --tlsv1.2 --max-time "$timeout_seconds" \
		-D "$headers_path" -o "$body_path" -w '%{http_code}' "$base_url$pathname")"
	if [[ "$actual_status" != "$expected_status" ]]; then
		echo "$pathname returned HTTP $actual_status; expected $expected_status." >&2
		return 1
	fi
}

request_without_redirect() {
	local pathname="$1"
	local expected_status="$2"
	local body_path="$3"
	local headers_path="$4"
	local actual_status

	actual_status="$(curl --silent --show-error --proto '=https' --tlsv1.2 --max-time "$timeout_seconds" \
		-D "$headers_path" -o "$body_path" -w '%{http_code}' "$base_url$pathname")"
	if [[ "$actual_status" != "$expected_status" ]]; then
		echo "$pathname returned HTTP $actual_status; expected $expected_status." >&2
		return 1
	fi
}

request_without_redirect "/" 302 "$temporary_directory/index-redirect" "$temporary_directory/index-redirect.headers"
if ! rg -qi '^location: /login' "$temporary_directory/index-redirect.headers"; then
  echo "The deployed origin did not redirect / to /login." >&2
  exit 1
fi
if ! rg -qi '^cache-control: no-cache' "$temporary_directory/index-redirect.headers"; then
  echo "The deployed root redirect did not use no-cache policy." >&2
  exit 1
fi

request "/login/deep-link" 200 "$temporary_directory/deep-link.html" "$temporary_directory/deep-link.headers"
if ! rg -qi '^content-type: text/html' "$temporary_directory/deep-link.headers"; then
  echo "The deployed origin did not serve the SPA fallback for /login/deep-link." >&2
  exit 1
fi

request "/health" 200 "$temporary_directory/health.json" "$temporary_directory/health.headers"
if ! rg -qi '^content-type: application/json' "$temporary_directory/health.headers"; then
  echo "The deployed origin did not return JSON for /health." >&2
  exit 1
fi
if ! rg -qi '^cache-control: no-store' "$temporary_directory/health.headers" || ! rg -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$temporary_directory/health.json"; then
  echo "The deployed origin returned an invalid /health response." >&2
  exit 1
fi

mapfile -t assets < <(rg -o '/assets/[^"[:space:]]+' "$temporary_directory/deep-link.html" | sort -u)
if ((${#assets[@]} == 0)); then
	echo "The deployed origin HTML did not reference a production asset." >&2
	exit 1
fi
request "${assets[0]}" 200 "$temporary_directory/asset" "$temporary_directory/asset.headers"
if ! rg -qi '^cache-control: public, max-age=31536000, immutable' "$temporary_directory/asset.headers"; then
	echo "The deployed asset did not use immutable caching." >&2
	exit 1
fi

request "/favicon.svg" 200 "$temporary_directory/favicon.svg" "$temporary_directory/favicon.headers"
if ! rg -qi '^content-type: image/svg\+xml' "$temporary_directory/favicon.headers"; then
	echo "The deployed origin did not return the packaged favicon." >&2
	exit 1
fi
if ! rg -qi '^cache-control: public, max-age=3600' "$temporary_directory/favicon.headers"; then
	echo "The deployed favicon did not use the static cache policy." >&2
	exit 1
fi

request "/api/not-a-route" 404 "$temporary_directory/api-missing" "$temporary_directory/api-missing.headers"
request "/assets/missing.js" 404 "$temporary_directory/asset-missing" "$temporary_directory/asset-missing.headers"
request "/demo/login" 200 "$temporary_directory/demo" "$temporary_directory/demo.headers"
if ! rg -q '<div id="app"></div>' "$temporary_directory/demo"; then
	echo "The deployed origin did not serve the demo SPA." >&2
	exit 1
fi

echo "Public HTTPS smoke passed for $base_url (production redirect, health, SPA, assets, API precedence, and shared demos)."
