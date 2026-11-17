#!/usr/bin/env bash
# Deploy the authworks CLI bundle to every configured target.
#
# Targets come from the environment only:
#   AUTHWORKS_CLI_DEPLOY_TARGETS, AUTHWORKS_CLI_REQUIRED_TARGETS
# read from .env.deploy-cli (or $AUTHWORKS_CLI_DEPLOY_ENV_FILE), parsed as text
# and never sourced. Exported variables (including empty values) override the
# file per key.
#
# The bundle is built once and reused for every target.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"
# shellcheck source=deploy-cli-config.sh
source "$SCRIPT_DIR/deploy-cli-config.sh"

usage() {
  printf 'Usage: bun run deploy:cli [--dry-run] [--require-target <target> ...]\n'
}

DRY_RUN=0
REQUIRE_FLAGS=()
while (($#)); do
  case "${1:-}" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --require-target)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        usage >&2
        exit 2
      fi
      REQUIRE_FLAGS+=("$2")
      shift 2
      ;;
    --require-target=*)
      if [[ -z "${1#--require-target=}" ]]; then
        usage >&2
        exit 2
      fi
      REQUIRE_FLAGS+=("${1#--require-target=}")
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

load_deploy_cli_config || exit 1
ENV_FILE="$DEPLOY_CLI_ENV_FILE"

REQUIRED_TARGETS=()
if [[ -n "${AUTHWORKS_CLI_REQUIRED_TARGETS:-}" ]]; then
  read -r -a REQUIRED_TARGETS <<< "${AUTHWORKS_CLI_REQUIRED_TARGETS//$'\n'/ }" || true
fi
if ((${#REQUIRE_FLAGS[@]})); then
  REQUIRED_TARGETS+=("${REQUIRE_FLAGS[@]}")
fi

TARGETS=()
if [[ -n "${AUTHWORKS_CLI_DEPLOY_TARGETS:-}" ]]; then
  read -r -a TARGETS <<< "${AUTHWORKS_CLI_DEPLOY_TARGETS//$'\n'/ }" || true
fi

# An empty target list is a no-op: the repository stays generic and deploys
# nothing until targets are configured.
if [[ "${#TARGETS[@]}" -eq 0 ]]; then
  if ((${#REQUIRED_TARGETS[@]} > 0)); then
    printf 'Required deployment target missing: %s (no CLI deploy targets configured).\n' "${REQUIRED_TARGETS[0]}" >&2
    exit 1
  fi
  printf 'No CLI deploy targets configured; nothing to deploy (set AUTHWORKS_CLI_DEPLOY_TARGETS or configure %s).\n' "$ENV_FILE"
  exit 0
fi

# Target grammar:
#   local            current account, per-user installation
#   system           this machine, system-wide installation
#   user@host        remote account, per-user installation
#   user@host:system remote machine, system-wide installation
target_valid() {
  local target="$1"
  case "$target" in
    local | system)
      return 0
      ;;
  esac
  local account=""
  local host="$target"
  if [[ "$host" == *:system ]]; then
    host="${host%:system}"
    if [[ "$host" != *@* ]]; then
      return 1
    fi
    account="${host%%@*}"
    host="${host#*@}"
    [[ "$account" =~ ^[A-Za-z0-9._-]+$ ]] || return 1
    [[ "$host" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || return 1
    return 0
  fi
  [[ "$target" =~ ^[A-Za-z0-9._-]+(@[A-Za-z0-9][A-Za-z0-9.-]*)?$ ]]
}

for target in "${TARGETS[@]}"; do
  if ! target_valid "$target"; then
    printf 'Invalid deployment target: %s (use local, system, an SSH destination such as user@host, or user@host:system).\n' "$target" >&2
    exit 1
  fi
done

printf 'CLI deployment targets:\n'
printf '  %s\n' "${TARGETS[@]}"
if ((${#REQUIRED_TARGETS[@]})); then
  for required in "${REQUIRED_TARGETS[@]}"; do
    required_present=0
    for target in "${TARGETS[@]}"; do
      if [[ "$target" == "$required" ]]; then
        required_present=1
        break
      fi
    done
    if [[ "$required_present" == 0 ]]; then
      printf 'Required deployment target missing: %s (resolved targets: %s).\n' "$required" "${TARGETS[*]}" >&2
      exit 1
    fi
  done
fi
target_install_plan() {
  local target="$1"
  case "$target" in
    local)
      printf 'per-user install for the current account'
      ;;
    system)
      printf 'system-wide install in %s' "${AUTHWORKS_CLI_SYSTEM_PREFIX:-/opt}/authworks-cli"
      ;;
    *:system)
      printf 'system-wide install over ssh on %s' "${target%:system}"
      ;;
    *)
      printf 'per-user install over ssh on %s' "$target"
      ;;
  esac
}

printf 'Install plan:\n'
for target in "${TARGETS[@]}"; do
  printf '  %s: %s\n' "$target" "$(target_install_plan "$target")"
done
if [[ "$DRY_RUN" == 1 ]]; then
  printf 'Dry run: no build, network access, or filesystem writes.\n'
  exit 0
fi

for command_name in bun chmod install ln rm mkdir mktemp mv; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command_name" >&2
    exit 1
  fi
done

TEMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT
ARTIFACT="$TEMP_DIR/authworks"

# The release id identifies the deployed revision in the system-wide release
# directory name (<version>-<id>).
RELEASE_ID="$(git rev-parse --short HEAD 2>/dev/null || true)"
RELEASE_ID="$(printf '%s' "$RELEASE_ID" | tr -cd '0-9A-Za-z._-')"
export AUTHWORKS_CLI_RELEASE_ID="$RELEASE_ID"

# Same invocation as `bun run build:cli`, redirected at a temporary artifact so
# every target receives one identical build.
bun build ./src/outputs/cli.ts --target=bun --format=esm --outfile "$ARTIFACT"
chmod 755 "$ARTIFACT"

# Environment forwarded to a remote installation. Only characters that are
# safe inside a single-quoted shell word are forwarded.
remote_environment_prefix() {
  local prefix=""
  local name=""
  local value=""
  local allowed=""
  for name in AUTHWORKS_CLI_RELEASE_ID AUTHWORKS_CLI_SYSTEM_PREFIX AUTHWORKS_CLI_SYSTEM_BIN_DIR; do
    value="${!name:-}"
    [[ -n "$value" ]] || continue
    case "$name" in
      AUTHWORKS_CLI_RELEASE_ID) allowed='0-9A-Za-z._-' ;;
      *) allowed='0-9A-Za-z._/ -' ;;
    esac
    value="$(printf '%s' "$value" | tr -cd "$allowed")"
    [[ -n "$value" ]] || continue
    prefix+="$name='$value' "
  done
  printf '%s' "$prefix"
}

install_local() {
  bash "$SCRIPT_DIR/install-cli.sh" "$ARTIFACT"
  printf 'Installed local CLI at %s\n' "$HOME/.local/bin/authworks"
}

install_local_system() {
  bash "$SCRIPT_DIR/install-cli.sh" --system "$ARTIFACT"
  printf 'Installed system CLI at %s\n' "${AUTHWORKS_CLI_SYSTEM_BIN_DIR:-/usr/local/bin}/authworks"
}

install_remote() {
  local target="$1"
  for command_name in ssh scp; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      printf 'Required command not found: %s\n' "$command_name" >&2
      return 1
    fi
  done
  ssh -- "$target" 'mkdir -p "$HOME/.local/share/authworks-cli" "$HOME/.local/bin"'
  local upload_name=".authworks.upload.${TEMP_DIR##*/}"
  scp -- "$ARTIFACT" "$target:.local/share/authworks-cli/$upload_name"
  ssh -- "$target" "$(remote_environment_prefix)bash -s -- '$upload_name'" < "$SCRIPT_DIR/install-cli.sh"
  printf 'Installed CLI on %s\n' "$target"
}

install_remote_system() {
  local target="$1"
  for command_name in ssh scp; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      printf 'Required command not found: %s\n' "$command_name" >&2
      return 1
    fi
  done
  # The remote account must write both the system prefix and the shared binary
  # directory, so it has to be root.
  local upload_name=".authworks.upload.${TEMP_DIR##*/}"
  scp -- "$ARTIFACT" "$target:/tmp/$upload_name"
  ssh -- "$target" "$(remote_environment_prefix)bash -s -- --system '/tmp/$upload_name'" \
    < "$SCRIPT_DIR/install-cli.sh"
  printf 'Installed system CLI on %s\n' "$target"
}

for target in "${TARGETS[@]}"; do
  if [[ "$target" == local ]]; then
    install_local
  elif [[ "$target" == system ]]; then
    install_local_system
  elif [[ "$target" == *:system ]]; then
    install_remote_system "${target%:system}"
  else
    install_remote "$target"
  fi
done
