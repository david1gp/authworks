#!/usr/bin/env bash
# Shell tests for ops/deploy-cli.sh and ops/install-cli.sh.
#
# Everything runs against a temporary prefix: no root privileges and no writes
# outside the test directory. The escape hatch AUTHWORKS_CLI_SYSTEM_ALLOW_NON_ROOT
# exists for exactly this.
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT_DIR/ops/deploy-cli.sh"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/bin" "$TEST_DIR/home with space"
export HOME="$TEST_DIR/home with space"
export TRACE_FILE="$TEST_DIR/trace"
export MOCK_HOME_ROOT="$TEST_DIR/accounts with space"
export PATH="$TEST_DIR/bin:$PATH"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}
assert_contains() {
  [[ "$1" == *"$2"* ]] || fail "Expected output to contain: $2"
}
assert_not_contains() {
  [[ "$1" != *"$2"* ]] || fail "Expected output not to contain: $2"
}
assert_not_exists() {
  [[ ! -e "$1" ]] || fail "Expected path not to exist: $1"
}

# A mock bun that builds a bundle instead of really bundling the checkout, and
# answers --version with the real CLI's answer shape.
cat > "$TEST_DIR/bin/bun" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'bun %s\n' "$*" >> "$TRACE_FILE"
if [[ "${1:-}" == *"$MOCK_BUNDLE_MARK"* && "${2:-}" == --version ]]; then
  [[ "${MOCK_BUN_FAIL:-}" != 1 ]] || exit 1
  printf '0.3.0\n'
  exit 0
fi
if [[ "${1:-}" == */.release.*/authworks.bundle && "${2:-}" == --version ]]; then
  [[ "${MOCK_BUN_FAIL:-}" != 1 ]] || exit 1
  printf '0.3.0\n'
  exit 0
fi
if [[ "${1:-}" == */authworks.bundle && "${2:-}" == --version ]]; then
  [[ "${MOCK_BUN_FAIL:-}" != 1 ]] || exit 1
  printf '0.3.0\n'
  exit 0
fi
if [[ "${1:-}" == build ]]; then
  while (($#)); do
    if [[ "$1" == --outfile ]]; then
      printf '#!/usr/bin/env bun\nprintf "mock authworks CLI\\n"\n' > "$2"
      exit 0
    fi
    shift
  done
fi
exit 1
MOCK
export MOCK_BUNDLE_MARK="authworks.bundle"

cat > "$TEST_DIR/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'ssh %s\n' "$*" >> "$TRACE_FILE"
printf 'noninteractive SSH greeting\n'
[[ "$1" == -- ]] && shift
target="$1"
shift
# deploy-cli strips the :system suffix before invoking ssh, so the remote
# system-wide path is recognised by its --system flag. Absolute upload paths
# are remapped into the mock root, which stands in for the remote /tmp.
if [[ "$*" == *--system* ]]; then
  command_text="${*//\/tmp\/.authworks.upload./$MOCK_HOME_ROOT/system/tmp/.authworks.upload.}"
  AUTHWORKS_CLI_SYSTEM_ALLOW_NON_ROOT=1 HOME="$MOCK_HOME_ROOT/system" bash -c "$command_text"
  exit 0
fi
HOME="$MOCK_HOME_ROOT/${target%@*}" bash -c "$*"
MOCK
cat > "$TEST_DIR/bin/scp" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'scp %s\n' "$*" >> "$TRACE_FILE"
[[ "$1" == -- ]] && shift
destination="${2#*:}"
if [[ "$destination" == /tmp/* ]]; then
  mkdir -p "$MOCK_HOME_ROOT/system/tmp"
  cp -- "$1" "$MOCK_HOME_ROOT/system$destination"
  exit 0
fi
account="${2%%@*}"
mkdir -p "$MOCK_HOME_ROOT/$account/$(dirname -- "$destination")"
cp -- "$1" "$MOCK_HOME_ROOT/$account/$destination"
MOCK
chmod +x "$TEST_DIR/bin/"*
mkdir -p "$MOCK_HOME_ROOT/system"

# Exported targets override the environment file; dry-run builds nothing.
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="from-file@host"\n' > "$TEST_DIR/targets.env"
export AUTHWORKS_CLI_DEPLOY_ENV_FILE="$TEST_DIR/targets.env"
export AUTHWORKS_CLI_DEPLOY_TARGETS='local explicit@server'
output="$(bash "$SCRIPT" --dry-run)"
assert_contains "$output" 'local'
assert_contains "$output" 'explicit@server'
assert_not_contains "$output" 'from-file@host'
assert_not_exists "$TRACE_FILE"
assert_not_exists "$HOME/.local"

# Empty or missing targets are a no-op, not a failure: the repo stays generic.
unset AUTHWORKS_CLI_DEPLOY_TARGETS AUTHWORKS_CLI_REQUIRED_TARGETS || true
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS=""\n' > "$TEST_DIR/targets.env"
rm -f -- "$TRACE_FILE"
output="$(bash "$SCRIPT")"
assert_contains "$output" 'No CLI deploy targets configured'
assert_not_exists "$TRACE_FILE"
assert_not_exists "$HOME/.local"
: > "$TEST_DIR/targets.env"
rm -f -- "$TRACE_FILE"
output="$(bash "$SCRIPT")"
assert_contains "$output" 'No CLI deploy targets configured'
assert_not_exists "$TRACE_FILE"

# Required targets still fail when nothing is configured.
if AUTHWORKS_CLI_REQUIRED_TARGETS='root@wonder1-server:system' bash "$SCRIPT" >"$TEST_DIR/out" 2>"$TEST_DIR/err"; then
  fail 'Required target with no configured targets unexpectedly succeeded'
fi
assert_contains "$(<"$TEST_DIR/err")" 'Required deployment target missing: root@wonder1-server:system'

# All four target forms are accepted and planned correctly.
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="local system david@leo-server root@wonder1-server:system"\n' > "$TEST_DIR/targets.env"
bash "$SCRIPT" --dry-run >"$TEST_DIR/out" 2>"$TEST_DIR/err" || fail "Target grammar rejected: $(<"$TEST_DIR/err")"
assert_contains "$(<"$TEST_DIR/out")" 'root@wonder1-server:system'
assert_contains "$(<"$TEST_DIR/out")" 'system-wide install over ssh on root@wonder1-server'
assert_contains "$(<"$TEST_DIR/out")" 'system-wide install in /opt/authworks-cli'
assert_contains "$(<"$TEST_DIR/out")" 'per-user install over ssh on david@leo-server'

# Unsafe targets are rejected before any build or network activity.
for invalid_target in 'wonder1-server:system' 'root@wonder1-server:system:extra' 'root@:system' 'host; touch /tmp/unsafe'; do
  printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="%s"\n' "$invalid_target" > "$TEST_DIR/targets.env"
  if bash "$SCRIPT" --dry-run >"$TEST_DIR/out" 2>"$TEST_DIR/err"; then
    fail "Unsafe target unexpectedly accepted: $invalid_target"
  fi
  assert_contains "$(<"$TEST_DIR/err")" 'Invalid deployment target'
done
assert_not_exists /tmp/unsafe

# Local install: one built artifact, atomic link swap, launcher resolves bun.
unset AUTHWORKS_CLI_DEPLOY_TARGETS AUTHWORKS_CLI_REQUIRED_TARGETS || true
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="local"\n' > "$TEST_DIR/targets.env"
rm -f -- "$TRACE_FILE"
mkdir -p "$TEST_DIR/checkout" "$HOME/.local/bin" "$HOME/.local/share/authworks-cli"
printf 'checkout stays intact\n' > "$TEST_DIR/checkout/authworks"
ln -s "$TEST_DIR/checkout/authworks" "$HOME/.local/bin/authworks"
bash "$SCRIPT" >/dev/null 2>"$TEST_DIR/err" || fail "Local deployment failed: $(<"$TEST_DIR/err")"
[[ "$(<"$TEST_DIR/checkout/authworks")" == 'checkout stays intact' ]] || fail 'Checkout symlink target was overwritten'
[[ -L "$HOME/.local/bin/authworks" ]] || fail 'Local authworks link was not installed'
local_release="$(readlink "$HOME/.local/bin/authworks")"
[[ "$local_release" == "$HOME/.local/share/authworks-cli/"*/authworks ]] || fail 'Local authworks link points elsewhere'
IFS= read -r artifact_head < "${local_release%/authworks}/authworks.bundle"
[[ "$artifact_head" == '#!/usr/bin/env bun' ]] || fail 'Local artifact was not installed'
[[ "$(rg -c '^bun build ' "$TRACE_FILE")" == 1 ]] || fail 'Expected exactly one bundle build'
cp "$TEST_DIR/bin/bun" "$HOME/.local/bin/bun"
[[ "$(PATH=/usr/bin:/bin "$HOME/.local/bin/authworks" --version)" == '0.3.0' ]] || fail 'Local launcher could not locate Bun'

# A failed verification preserves the previous bundle and link.
previous_bundle="$(<"${local_release%/authworks}/authworks.bundle")"
previous_link="$local_release"
export MOCK_BUN_FAIL=1
if AUTHWORKS_CLI_DEPLOY_TARGETS=local bash "$SCRIPT" >"$TEST_DIR/out" 2>"$TEST_DIR/err"; then
  fail 'Failed bundle verification unexpectedly succeeded'
fi
unset MOCK_BUN_FAIL
[[ "$(readlink "$HOME/.local/bin/authworks")" == "$previous_link" ]] || fail 'Failed install changed previous link'
[[ "$(<"${previous_link%/authworks}/authworks.bundle")" == "$previous_bundle" ]] || fail 'Failed install changed previous bundle'
[[ "$(<"$TEST_DIR/checkout/authworks")" == 'checkout stays intact' ]] || fail 'Failed install modified checkout'

# Remote per-user install over ssh.
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="david@leo-server"\n' > "$TEST_DIR/targets.env"
rm -f -- "$TRACE_FILE"
account_home="$MOCK_HOME_ROOT/david"
mkdir -p "$account_home/.local/bin" "$account_home/.local/share/authworks-cli"
cp "$TEST_DIR/bin/bun" "$account_home/.local/bin/bun"
bash "$SCRIPT" >/dev/null 2>"$TEST_DIR/err" || fail "Remote deployment failed: $(<"$TEST_DIR/err")"
remote_release="$(readlink "$account_home/.local/bin/authworks")"
[[ "$remote_release" == "$account_home/.local/share/authworks-cli/"*/authworks ]] || fail 'Remote authworks link points elsewhere'
cmp "${local_release%/authworks}/authworks.bundle" "${remote_release%/authworks}/authworks.bundle" || fail 'Remote bundle differs from the local build'
[[ "$(HOME="$account_home" PATH=/usr/bin:/bin "$account_home/.local/bin/authworks" --version)" == '0.3.0' ]] || fail 'Remote launcher could not locate Bun'
[[ "$(rg -c '^scp ' "$TRACE_FILE")" == 1 ]] || fail 'Expected exactly one bundle copy for a per-user remote target'

# System-wide install: one release per machine in a temp prefix, no root needed.
rm -f -- "$TRACE_FILE"
SYSTEM_PREFIX="$TEST_DIR/system prefix"
SYSTEM_BIN_DIR="$TEST_DIR/system bin"
export AUTHWORKS_CLI_SYSTEM_PREFIX="$SYSTEM_PREFIX"
export AUTHWORKS_CLI_SYSTEM_BIN_DIR="$SYSTEM_BIN_DIR"
export AUTHWORKS_CLI_SYSTEM_BUN="$TEST_DIR/bin/bun"
export AUTHWORKS_CLI_SYSTEM_ALLOW_NON_ROOT=1
expected_release_id="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
AUTHWORKS_CLI_DEPLOY_TARGETS=system bash "$SCRIPT" >"$TEST_DIR/out" 2>"$TEST_DIR/err" \
  || fail "System-wide deployment failed: $(<"$TEST_DIR/err")"
system_releases="$SYSTEM_PREFIX/authworks-cli/releases"
[[ -d "$system_releases" ]] || fail 'System release directory is missing'
system_current="$SYSTEM_PREFIX/authworks-cli/current"
[[ -L "$system_current" ]] || fail 'System current symlink is missing'
system_release="$(readlink "$system_current")"
[[ -f "$system_release/authworks.bundle" ]] || fail 'System release is missing the bundle'
system_release_name="$(basename -- "$system_release")"
[[ "$system_release_name" == "0.3.0-$expected_release_id" ]] || fail "Unexpected system release name: $system_release_name"
[[ -L "$SYSTEM_BIN_DIR/authworks" ]] || fail 'System binary link is missing'
[[ "$(readlink "$SYSTEM_BIN_DIR/authworks")" == *current/authworks ]] || fail 'System binary link does not point at the current release'
system_launcher="$system_release/authworks"
grep -Fq "exec \"$TEST_DIR/bin/bun\"" "$system_launcher" || fail 'System launcher does not use the Bun resolved at install time'
if grep -Fq '$HOME' "$system_launcher"; then fail 'System launcher references an account home'; fi
[[ "$("$SYSTEM_BIN_DIR/authworks" --version)" == '0.3.0' ]] || fail 'System launcher could not run the CLI'
[[ -r "$system_release/authworks.bundle" ]] || fail 'System release bundle is not readable'

# Only the last three releases are kept; the active one is never pruned.
for _ in 1 2 3 4; do
  AUTHWORKS_CLI_DEPLOY_TARGETS=system bash "$SCRIPT" >/dev/null 2>"$TEST_DIR/err" \
    || fail 'Repeated system-wide deployment failed'
done
system_release_count="$(find "$system_releases" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
[[ "$system_release_count" == 3 ]] || fail "Expected 3 kept system releases, found $system_release_count"
[[ -L "$system_current" ]] || fail 'Pruning removed the active system release link'

# A failed system-wide install keeps the active release and cleans staging.
system_release_before="$(readlink "$system_current")"
export MOCK_BUN_FAIL=1
if AUTHWORKS_CLI_DEPLOY_TARGETS=system bash "$SCRIPT" >"$TEST_DIR/out" 2>"$TEST_DIR/err"; then
  fail 'Failed system-wide deployment unexpectedly succeeded'
fi
unset MOCK_BUN_FAIL
[[ "$(readlink "$system_current")" == "$system_release_before" ]] || fail 'Failed system install changed the active release'
[[ -z "$(find "$system_releases" -mindepth 1 -maxdepth 1 -name '.staging.*')" ]] || fail 'Failed system install left a staging directory behind'

# System-wide install requires root unless the test escape hatch is set.
if [[ "${EUID:-$(id -u)}" != 0 ]]; then
  if (unset AUTHWORKS_CLI_SYSTEM_ALLOW_NON_ROOT; AUTHWORKS_CLI_DEPLOY_TARGETS=system bash "$SCRIPT" >"$TEST_DIR/out" 2>"$TEST_DIR/err"); then
    fail 'System-wide deployment without root unexpectedly succeeded'
  fi
  assert_contains "$(<"$TEST_DIR/err")" 'requires root'
fi

# Remote system target installs into the remote system prefix, and the :system
# suffix is never passed to ssh as part of the host name.
REMOTE_PREFIX="$TEST_DIR/remote system prefix"
REMOTE_BIN_DIR="$TEST_DIR/remote system bin"
export AUTHWORKS_CLI_SYSTEM_PREFIX="$REMOTE_PREFIX"
export AUTHWORKS_CLI_SYSTEM_BIN_DIR="$REMOTE_BIN_DIR"
rm -f -- "$TRACE_FILE"
AUTHWORKS_CLI_DEPLOY_TARGETS='root@wonder1-server:system' bash "$SCRIPT" >"$TEST_DIR/out" 2>"$TEST_DIR/err" \
  || fail "Remote system deployment failed: $(<"$TEST_DIR/err")"
[[ -L "$REMOTE_PREFIX/authworks-cli/current" ]] || fail 'Remote system release is missing'
[[ -L "$REMOTE_BIN_DIR/authworks" ]] || fail 'Remote system binary link is missing'
assert_contains "$(<"$TRACE_FILE")" 'root@wonder1-server'
assert_contains "$(<"$TRACE_FILE")" '/tmp/.authworks.upload.'
assert_not_contains "$(<"$TRACE_FILE")" 'wonder1-server:system'
[[ "$(rg -c '^scp ' "$TRACE_FILE")" == 1 ]] || fail 'Expected exactly one bundle copy for the remote system target'

# Configured and flag required targets; the file is parsed as inert text.
unset AUTHWORKS_CLI_SYSTEM_PREFIX AUTHWORKS_CLI_SYSTEM_BIN_DIR AUTHWORKS_CLI_SYSTEM_BUN || true
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="local david@leo-server"\nAUTHWORKS_CLI_REQUIRED_TARGETS="david@leo-server"\n' > "$TEST_DIR/targets.env"
bash "$SCRIPT" --dry-run >/dev/null || fail 'File-configured required target unexpectedly failed'
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="local david@leo-server"\nAUTHWORKS_CLI_REQUIRED_TARGETS="leo@leo-server"\n' > "$TEST_DIR/targets.env"
if bash "$SCRIPT" --dry-run >"$TEST_DIR/out" 2>"$TEST_DIR/err"; then fail 'Missing configured required target unexpectedly succeeded'; fi
assert_contains "$(<"$TEST_DIR/err")" 'Required deployment target missing: leo@leo-server'
if AUTHWORKS_CLI_REQUIRED_TARGETS='' bash "$SCRIPT" --dry-run >/dev/null; then
  :
else
  fail 'Exported empty requirements should override the configured file value'
fi
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="local david@leo-server"\nAUTHWORKS_CLI_REQUIRED_TARGETS="local"\n' > "$TEST_DIR/targets.env"
bash "$SCRIPT" --dry-run --require-target david@leo-server >/dev/null \
  || fail 'Configured plus flag required targets unexpectedly failed'
if bash "$SCRIPT" --dry-run --require-target leo@leo-server >"$TEST_DIR/out" 2>"$TEST_DIR/err"; then
  fail 'Flag required-target check unexpectedly succeeded'
fi
# shellcheck disable=SC2016
printf 'AUTHWORKS_CLI_DEPLOY_TARGETS="local"\nAUTHWORKS_CLI_REQUIRED_TARGETS="$(touch %s)"\n' "$TEST_DIR/required-exec" > "$TEST_DIR/targets.env"
if bash "$SCRIPT" --dry-run >"$TEST_DIR/out" 2>"$TEST_DIR/err"; then fail 'Unsafe required target unexpectedly succeeded'; fi
assert_not_exists "$TEST_DIR/required-exec"

printf 'PASS: authworks CLI deploy shell tests\n'
