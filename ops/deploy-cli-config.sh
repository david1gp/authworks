#!/usr/bin/env bash
# Safe configuration loader for ops/deploy-cli.sh.
#
# Reads only these keys from the deployment environment file:
#   AUTHWORKS_CLI_DEPLOY_TARGETS, AUTHWORKS_CLI_REQUIRED_TARGETS
# The file is parsed as text and never sourced, so command substitutions,
# eval payloads, and unrelated assignments cannot execute. Precedence per key:
# an explicitly exported variable (including an empty value) overrides the
# file. Unset or empty required targets mean no requirements.
#
# Callers must set ROOT_DIR before sourcing. After load_deploy_cli_config,
# DEPLOY_CLI_ENV_FILE holds the resolved file path.
set -euo pipefail

DEPLOY_CLI_ENV_FILE=""

deploy_cli_config_unquote() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if ((${#value} >= 2)); then
    local first="${value:0:1}"
    local last="${value: -1}"
    if [[ "$first" == '"' && "$last" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$first" == "'" && "$last" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi
  printf '%s' "$value"
}

load_deploy_cli_config() {
  DEPLOY_CLI_ENV_FILE="${AUTHWORKS_CLI_DEPLOY_ENV_FILE:-$ROOT_DIR/.env.deploy-cli}"

  local targets_exported=0 required_exported=0
  local exported_targets="" exported_required=""
  if [[ "${AUTHWORKS_CLI_DEPLOY_TARGETS+x}" == x ]]; then
    targets_exported=1
    exported_targets="$AUTHWORKS_CLI_DEPLOY_TARGETS"
  fi
  if [[ "${AUTHWORKS_CLI_REQUIRED_TARGETS+x}" == x ]]; then
    required_exported=1
    exported_required="$AUTHWORKS_CLI_REQUIRED_TARGETS"
  fi

  local file_targets_set=0 file_required_set=0
  local file_targets="" file_required=""
  if [[ -f "$DEPLOY_CLI_ENV_FILE" ]]; then
    local line key value
    while IFS= read -r line || [[ -n "$line" ]]; do
      for key in AUTHWORKS_CLI_DEPLOY_TARGETS AUTHWORKS_CLI_REQUIRED_TARGETS; do
        # shellcheck disable=SC2076
        if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*= ]]; then
          value="$(deploy_cli_config_unquote "${line#*=}")"
          case "$key" in
            AUTHWORKS_CLI_DEPLOY_TARGETS)
              file_targets="$value"
              file_targets_set=1
              ;;
            AUTHWORKS_CLI_REQUIRED_TARGETS)
              file_required="$value"
              file_required_set=1
              ;;
          esac
        fi
      done
    done < "$DEPLOY_CLI_ENV_FILE"
  elif [[ "${AUTHWORKS_CLI_DEPLOY_ENV_FILE+x}" == x ]]; then
    printf 'Deployment environment file not found: %s\n' "$DEPLOY_CLI_ENV_FILE" >&2
    return 1
  fi

  if [[ "$targets_exported" == 1 ]]; then
    AUTHWORKS_CLI_DEPLOY_TARGETS="$exported_targets"
  elif [[ "$file_targets_set" == 1 ]]; then
    AUTHWORKS_CLI_DEPLOY_TARGETS="$file_targets"
  else
    unset AUTHWORKS_CLI_DEPLOY_TARGETS || true
  fi
  if [[ "$required_exported" == 1 ]]; then
    AUTHWORKS_CLI_REQUIRED_TARGETS="$exported_required"
  elif [[ "$file_required_set" == 1 ]]; then
    AUTHWORKS_CLI_REQUIRED_TARGETS="$file_required"
  else
    unset AUTHWORKS_CLI_REQUIRED_TARGETS || true
  fi
}
