#!/usr/bin/env bash
# Install the repository-managed Authworks production systemd --user unit.
# The unit expects this checkout at ~/adaptive/authworks and keeps SQLite data
# under ~/.local/share/authworks. Secrets stay in ~/.config/authworks.
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
configuration_home="$HOME/.config"
environment_directory="$configuration_home/authworks"
environment_file="$environment_directory/authworks.env"
user_unit_directory="$configuration_home/systemd/user"
data_directory="$HOME/.local/share/authworks"
unit_name="authworks.service"

if [[ ! -f "$environment_file" ]]; then
	cat >&2 <<EOF
Missing $environment_file.
Create it locally (mode 600) with at least:

AUTHWORKS_PUBLIC_ORIGIN=https://your-authworks-host.example
AUTHWORKS_SYSTEM_SECRET=generate-a-local-secret
EOF
	exit 1
fi

if ! rg -q '^AUTHWORKS_PUBLIC_ORIGIN=https://[^[:space:]]+$' "$environment_file"; then
	echo "$environment_file must contain an HTTPS AUTHWORKS_PUBLIC_ORIGIN." >&2
	exit 1
fi
if ! rg -q '^AUTHWORKS_SYSTEM_SECRET=.+$' "$environment_file"; then
	echo "$environment_file must contain AUTHWORKS_SYSTEM_SECRET." >&2
	exit 1
fi

chmod 600 "$environment_file"
mkdir -p "$user_unit_directory" "$data_directory"
chmod 700 "$environment_directory" "$data_directory"
ln -sfn "$script_directory/$unit_name" "$user_unit_directory/$unit_name"

systemctl --user daemon-reload
loginctl enable-linger "$USER" || true
systemctl --user enable --now "$unit_name"

cat <<EOF
Installed $unit_name.

  systemctl --user status ${unit_name%.service}
  journalctl --user -u ${unit_name%.service} -f

The public HTTPS proxy is configured separately with ops/Caddyfile.
EOF
