import type { ResultErr } from "#result"

const defaultExitCode = 1
const failureExitCodes = new Map([
  ["passwords.contentoren-ssotest-ensure.authorization-unavailable", 44],
  ["passwords.contentoren-ssotest-ensure.input-invalid", 45],
  ["passwords.contentoren-ssotest-ensure.realm-not-found", 46],
  ["passwords.contentoren-ssotest-ensure.realm-ambiguous", 47],
  ["passwords.contentoren-ssotest-ensure.realm-inactive", 48],
  ["passwords.contentoren-ssotest-ensure.organization-not-found", 49],
  ["passwords.contentoren-ssotest-ensure.organization-ambiguous", 50],
  ["passwords.contentoren-ssotest-ensure.organization-inactive", 51],
  ["passwords.contentoren-ssotest-ensure.human-ambiguous", 52],
  ["passwords.contentoren-ssotest-ensure.human-conflict", 53],
  ["passwords.contentoren-ssotest-ensure.human-deleted", 54],
  ["passwords.contentoren-ssotest-ensure.machine-conflict", 55],
  ["passwords.contentoren-ssotest-ensure.membership-elevated", 56],
  ["passwords.contentoren-ssotest-ensure.membership-ambiguous", 57],
  ["passwords.contentoren-ssotest-ensure.password-policy-rejected", 58],
  ["passwords.contentoren-ssotest-ensure.api-unreachable", 59],
  ["passwords.contentoren-ssotest-ensure.api-unauthorized", 60],
  ["passwords.contentoren-ssotest-ensure.api-forbidden", 61],
  ["passwords.contentoren-ssotest-ensure.api-rate-limited", 62],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response", 63],
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
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.realm-list", 64],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.organization-list", 65],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.password-policy-get", 66],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.user-list", 67],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.machine-user-list", 68],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.user-create", 69],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.user-email-verification-set", 70],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.user-lifecycle-set", 71],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.password-credential-replace", 72],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-create", 73],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-update", 74],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.envelope", 75],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.items", 76],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.id", 77],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.realm-id", 78],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.organization-id", 79],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.user-id", 80],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.created-at", 81],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.updated-at", 82],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.roles", 83],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.next-page-token", 84],
  ["passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.unknown", 85],
  ["passwords.contentoren-ssotest-ensure.api-failed", 86],
])

export function passwordContentorenSsoTestProductionEnsureExitCodeGet(failure: ResultErr | string): number {
  if (typeof failure === "string") return failureExitCodes.get(failure) ?? defaultExitCode
  const mappedCode = failure.code === undefined ? undefined : failureExitCodes.get(failure.code)
  if (mappedCode !== undefined) return mappedCode
  if (failure.code === "platform.unreachable" || failure.code === "platform.unavailable") return 59
  if (failure.code === "platform.unauthorized" || failure.statusCode === 401) return 60
  if (failure.code === "platform.forbidden" || failure.statusCode === 403) return 61
  if (failure.code === "platform.rate-limited" || failure.statusCode === 429) return 62
  if (failure.op === "passwordPolicyCheck") return 58
  if (failure.statusCode !== undefined && failure.statusCode >= 500) return 86
  return defaultExitCode
}
