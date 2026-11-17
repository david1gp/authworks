#!/usr/bin/env bash
# Installs the authworks CLI bundle on the machine running this script.
#
# Per-user mode (default):
#   ~/.local/share/authworks-cli/<release>/ holds the bundle and its launcher;
#   ~/.local/bin/authworks links to the release launcher.
#
# System mode (--system):
#   ${AUTHWORKS_CLI_SYSTEM_PREFIX:-/opt}/authworks-cli/releases/<version>-<id>/
#   holds the release, ${AUTHWORKS_CLI_SYSTEM_PREFIX:-/opt}/authworks-cli/current
#   is an atomically swapped symlink to the active release and
#   ${AUTHWORKS_CLI_SYSTEM_BIN_DIR:-/usr/local/bin}/authworks links to it. The
#   launcher runs Bun from the path resolved at install time, preferring
#   /usr/local/bin/bun, and never from $HOME. The last 3 releases are kept.
#
# Usage: install-cli.sh [--system] <bundle>
#
# The bundle path may be an absolute path or, for SSH uploads, the reserved
# basename ".authworks.upload.<name>" of a file in the per-user share
# directory. Uploaded files are removed after a successful installation.
set -euo pipefail

INSTALL_NAME="authworks-cli"
BINARY_NAME="authworks"
SYSTEM_PREFIX_FALLBACK="/opt"
SYSTEM_BIN_DIR_FALLBACK="/usr/local/bin"
SYSTEM_RELEASE_KEEP=3

usage() {
  printf 'Usage: install-cli.sh [--system] <bundle>\n'
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

system_mode=0
positional=()
while (($#)); do
  case "${1:-}" in
    --system)
      system_mode=1
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    --)
      shift
      positional+=("$@")
      break
      ;;
    *)
      positional+=("$1")
      shift
      ;;
  esac
done

bundle_arg="${positional[0]:-}"
if [[ -z "$bundle_arg" ]]; then
  usage >&2
  exit 2
fi

if ((system_mode == 1)); then
  if [[ "${EUID:-$(id -u)}" != "0" && "${AUTHWORKS_CLI_SYSTEM_ALLOW_NON_ROOT:-}" != "1" ]]; then
    fail "System-wide install of $INSTALL_NAME requires root. Run it as root, or set AUTHWORKS_CLI_SYSTEM_ALLOW_NON_ROOT=1 to override (tests only)."
  fi
  install_root="${AUTHWORKS_CLI_SYSTEM_PREFIX:-$SYSTEM_PREFIX_FALLBACK}/$INSTALL_NAME"
  releases_dir="$install_root/releases"
  bin_dir="${AUTHWORKS_CLI_SYSTEM_BIN_DIR:-$SYSTEM_BIN_DIR_FALLBACK}"
  upload_dir=""
else
  install_root="$HOME/.local/share/$INSTALL_NAME"
  releases_dir=""
  bin_dir="$HOME/.local/bin"
  upload_dir="$install_root"
fi

# SSH supplies safe upload basenames; locally the argument is a built artifact path.
input_path_resolve() {
  local value="$1"
  local base="${value##*/}"
  if [[ "$value" != */* && "$base" == .authworks.upload.* ]]; then
    if [[ -z "$upload_dir" ]]; then
      fail "Expected an absolute path to the $INSTALL_NAME bundle in system mode."
    fi
    printf '%s/%s' "$upload_dir" "$base"
    return 0
  fi
  printf '%s' "$value"
}

bundle_path="$(input_path_resolve "$bundle_arg")"
[[ -f "$bundle_path" ]] || fail "CLI bundle not found: $bundle_path"

upload_bundle=0
if [[ "${bundle_path##*/}" == .authworks.upload.* ]]; then
  upload_bundle=1
fi

# Bun is resolved once, at install time: the launcher embeds that path so it
# never depends on the PATH of an interactive or non-interactive shell.
runtime_resolve() {
  local found
  if ((system_mode == 1)); then
    # An explicit override wins: it names the Bun installation the system-wide
    # launcher should use when the toolchain lives outside /usr/local/bin.
    if [[ -n "${AUTHWORKS_CLI_SYSTEM_BUN:-}" ]]; then
      printf '%s' "$AUTHWORKS_CLI_SYSTEM_BUN"
      return 0
    fi
    if [[ -x /usr/local/bin/bun ]]; then
      printf '/usr/local/bin/bun'
      return 0
    fi
  else
    if [[ -x "$HOME/.local/bin/bun" ]]; then
      printf '%s' "$HOME/.local/bin/bun"
      return 0
    fi
    if [[ -x "$HOME/.bun/bin/bun" ]]; then
      printf '%s' "$HOME/.bun/bin/bun"
      return 0
    fi
  fi
  found="$(command -v bun || true)"
  if [[ -z "$found" ]]; then
    return 1
  fi
  if [[ "$found" != /* ]]; then
    found="$(cd -- "$(dirname -- "$found")" && pwd)/$(basename -- "$found")"
  fi
  printf '%s' "$found"
}

runtime="$(runtime_resolve || true)"
if [[ -z "$runtime" ]]; then
  if ((system_mode == 1)); then
    fail "Bun not found for $INSTALL_NAME (checked AUTHWORKS_CLI_SYSTEM_BUN, /usr/local/bin/bun and PATH)."
  fi
  fail "Bun not found for $INSTALL_NAME (checked ~/.local/bin/bun, ~/.bun/bin/bun, and PATH)."
fi
if ((system_mode == 1)) && [[ ! -x "$runtime" ]]; then
  fail "Bun is not executable: $runtime"
fi
if ((system_mode == 1)) && [[ "$runtime" == "$HOME/"* ]]; then
  printf 'Warning: Bun resolved to %s, which lives under the installing account home and may be unusable for other users; prefer /usr/local/bin/bun.\n' "$runtime" >&2
fi

release_dir=""
link_tmp=""
staging_dir=""
cleanup() {
  [[ -z "$release_dir" ]] || rm -rf -- "$release_dir"
  [[ -z "$staging_dir" ]] || rm -rf -- "$staging_dir"
  [[ -z "$link_tmp" ]] || rm -f -- "$link_tmp"
  # Uploaded artifacts never outlive the installation, not even a failed one.
  if ((upload_bundle == 1)); then
    rm -f -- "$bundle_path"
  fi
}
trap cleanup EXIT

if ((system_mode == 1)); then
  install -d -m 755 -- "$releases_dir" "$bin_dir"
  # The release name carries the CLI version and a release id (commit sha or
  # timestamp), so the active release stays identifiable after a swap.
  staging_dir="$(mktemp -d "$releases_dir/.staging.XXXXXXXX")"
  release_dir="$staging_dir"
else
  mkdir -p -- "$install_root" "$bin_dir"
  release_dir="$(mktemp -d "$install_root/.release.XXXXXXXX")"
fi

# The bundle is self-contained: it needs no runtime node_modules, so the
# release directory holds only the bundle and its launcher.
install -m 755 -- "$bundle_path" "$release_dir/$BINARY_NAME.bundle"

# Verify the new release before anything points at it.
version_output="$("$runtime" "$release_dir/$BINARY_NAME.bundle" --version)" || fail "The $INSTALL_NAME bundle failed its --version check."

if ((system_mode == 1)); then
  version="$(printf '%s' "$version_output" | awk 'NR==1 {print $NF}')"
  version="$(printf '%s' "$version" | tr -cd '0-9A-Za-z.+-')"
  if [[ -z "$version" ]]; then
    version="unknown"
  fi
  release_id="$(printf '%s' "${AUTHWORKS_CLI_RELEASE_ID:-}" | tr -cd '0-9A-Za-z._-')"
  if [[ -z "$release_id" ]]; then
    release_id="$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  target_dir="$releases_dir/$version-$release_id"
  if [[ -e "$target_dir" ]]; then
    target_dir="$releases_dir/$version-$release_id-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  fi
  if [[ -e "$target_dir" ]]; then
    fail "System release directory already exists: $target_dir"
  fi
  mv -T -- "$staging_dir" "$target_dir"
  staging_dir=""
  release_dir="$target_dir"
  # Every account on the machine must be able to read and run the release.
  chmod 755 "$release_dir"
  chmod -R a+rX "$release_dir"

  # The launcher resolves Bun without assuming that noninteractive shells load
  # ~/.local/bin, and never references an account home.
  printf '%s\n' '#!/bin/sh' \
    "bundle=\"$release_dir/$BINARY_NAME.bundle\"" \
    "exec \"$runtime\" \"\$bundle\" \"\$@\"" > "$release_dir/$BINARY_NAME"
  chmod 755 "$release_dir/$BINARY_NAME"
  # The launcher must run the new bundle, not the release that is still active.
  "$release_dir/$BINARY_NAME" --version >/dev/null || fail "The $INSTALL_NAME launcher failed its --version check."

  # Activate the new release: the current symlink is swapped atomically and
  # the binary link points at it, so the switch happens in one step.
  link_tmp="$(mktemp "$install_root/.current.XXXXXXXX")"
  rm -f -- "$link_tmp"
  ln -s -- "$release_dir" "$link_tmp"
  mv -fT -- "$link_tmp" "$install_root/current"
  link_tmp=""
  # The release is live from here on; a later failure must not remove it.
  release_dir=""

  bin_target="$install_root/current/$BINARY_NAME"
  if command -v realpath >/dev/null 2>&1; then
    relative_root="$(realpath -m --relative-to="$bin_dir" "$install_root" 2>/dev/null || true)"
    if [[ -n "$relative_root" ]]; then
      bin_target="$relative_root/current/$BINARY_NAME"
    fi
  fi
  link_tmp="$(mktemp "$bin_dir/.$BINARY_NAME.link.XXXXXXXX")"
  rm -f -- "$link_tmp"
  ln -s -- "$bin_target" "$link_tmp"
  mv -fT -- "$link_tmp" "$bin_dir/$BINARY_NAME"
  link_tmp=""

  # Keep the last releases; older ones are pruned by install time.
  kept=0
  while IFS= read -r candidate; do
    candidate="${candidate%/}"
    if [[ -z "$candidate" ]]; then
      continue
    fi
    if [[ "$(basename -- "$candidate")" == "current" ]]; then
      continue
    fi
    kept=$((kept + 1))
    if ((kept > SYSTEM_RELEASE_KEEP)); then
      rm -rf -- "$candidate"
    fi
  done < <(ls -1dt -- "$releases_dir"/*/ 2>/dev/null || true)
else
  # The launcher resolves Bun without assuming that noninteractive shells load ~/.local/bin.
  printf '%s\n' '#!/bin/sh' \
    "bundle=\"$release_dir/$BINARY_NAME.bundle\"" \
    "if [ -x \"$runtime\" ]; then" \
    '  exec "'"$runtime"'" "$bundle" "$@"' \
    'fi' \
    'if [ -x "$HOME/.local/bin/bun" ]; then' \
    '  exec "$HOME/.local/bin/bun" "$bundle" "$@"' \
    'fi' \
    'if [ -x "$HOME/.bun/bin/bun" ]; then' \
    '  exec "$HOME/.bun/bin/bun" "$bundle" "$@"' \
    'fi' \
    'exec bun "$bundle" "$@"' > "$release_dir/$BINARY_NAME"
  chmod 755 "$release_dir/$BINARY_NAME"

  # Activate only after the complete release and runtime have been verified.
  # mv -T replaces the link itself, not a checkout target or the previous release.
  link_tmp="$(mktemp "$bin_dir/.$BINARY_NAME.link.XXXXXXXX")"
  rm -f -- "$link_tmp"
  ln -s -- "$release_dir/$BINARY_NAME" "$link_tmp"
  mv -fT -- "$link_tmp" "$bin_dir/$BINARY_NAME"
  link_tmp=""
fi

if ((upload_bundle == 1)); then
  rm -f -- "$bundle_path"
fi
release_dir=""
