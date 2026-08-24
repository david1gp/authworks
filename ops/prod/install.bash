#!/usr/bin/env bash
set -euo pipefail

ports_file="$HOME/.config/authworks/prodctl-ports.env"
if [[ -f "$ports_file" ]]; then
	# shellcheck disable=SC1090
	source "$ports_file"
fi
export PATH="$HOME/.bun/bin:$PATH"

: "${PRODCTL_PORT_DEFAULT:?prodctl did not provide the default port}"

environment_directory="$HOME/.config/authworks"
environment_file="$environment_directory/authworks.env"
data_directory="$HOME/.local/share/authworks"

install -d -m 700 "$environment_directory" "$data_directory"
if [[ ! -f "$environment_file" ]]; then
	echo "missing pre-provisioned environment file: $environment_file" >&2
	exit 1
fi
if [[ "$(stat -c '%a' "$environment_file")" != "600" ]]; then
	echo "environment file must have mode 600: $environment_file" >&2
	exit 1
fi
printf '\nAUTHWORKS_PORT=%s\n' "$PRODCTL_PORT_DEFAULT" >>"$environment_file"
chmod 600 "$environment_file"

bun install --frozen-lockfile
bun run build
