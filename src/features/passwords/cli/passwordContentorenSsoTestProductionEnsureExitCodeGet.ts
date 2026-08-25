import type { ResultErr } from "#result"

const defaultExitCode = 1
const apiRejectedExitCodes = new Map([
  ["passwords.contentoren-ssotest-ensure.api-rejected.realm-list", 32],
  ["passwords.contentoren-ssotest-ensure.api-rejected.organization-list", 33],
  ["passwords.contentoren-ssotest-ensure.api-rejected.password-policy-get", 34],
  ["passwords.contentoren-ssotest-ensure.api-rejected.user-list", 35],
  ["passwords.contentoren-ssotest-ensure.api-rejected.machine-user-list", 36],
  ["passwords.contentoren-ssotest-ensure.api-rejected.membership-list", 37],
  ["passwords.contentoren-ssotest-ensure.api-rejected.user-create", 38],
  ["passwords.contentoren-ssotest-ensure.api-rejected.user-email-verification-set", 39],
  ["passwords.contentoren-ssotest-ensure.api-rejected.user-lifecycle-set", 40],
  ["passwords.contentoren-ssotest-ensure.api-rejected.password-credential-replace", 41],
  ["passwords.contentoren-ssotest-ensure.api-rejected.membership-create", 42],
  ["passwords.contentoren-ssotest-ensure.api-rejected.membership-update", 43],
])

export function passwordContentorenSsoTestProductionEnsureExitCodeGet(failure: ResultErr | string): number {
  const code = typeof failure === "string" ? failure : failure.code
  return (code === undefined ? undefined : apiRejectedExitCodes.get(code)) ?? defaultExitCode
}
