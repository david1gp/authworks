import { expect, test } from "bun:test"
import { passwordContentorenSsoTestProductionEnsureExitCodeGet } from "../../src/features/passwords/cli/passwordContentorenSsoTestProductionEnsureExitCodeGet.js"
import { passwordContentorenSsoTestProductionEnsureFailureOutputCreate } from "../../src/features/passwords/cli/passwordContentorenSsoTestProductionEnsureFailureOutputCreate.js"

const closedFailureExitCodes = [
  ["authorization-unavailable", 44],
  ["input-invalid", 45],
  ["realm-not-found", 46],
  ["realm-ambiguous", 47],
  ["realm-inactive", 48],
  ["organization-not-found", 49],
  ["organization-ambiguous", 50],
  ["organization-inactive", 51],
  ["human-ambiguous", 52],
  ["human-conflict", 53],
  ["human-deleted", 54],
  ["machine-conflict", 55],
  ["membership-elevated", 56],
  ["membership-ambiguous", 57],
  ["password-policy-rejected", 58],
  ["api-unreachable", 59],
  ["api-unauthorized", 60],
  ["api-forbidden", 61],
  ["api-rate-limited", 62],
  ["api-invalid-response", 63],
  ["api-invalid-response.realm-list", 64],
  ["api-invalid-response.organization-list", 65],
  ["api-invalid-response.password-policy-get", 66],
  ["api-invalid-response.user-list", 67],
  ["api-invalid-response.machine-user-list", 68],
  ["api-invalid-response.user-create", 69],
  ["api-invalid-response.user-email-verification-set", 70],
  ["api-invalid-response.user-lifecycle-set", 71],
  ["api-invalid-response.password-credential-replace", 72],
  ["api-invalid-response.membership-create", 73],
  ["api-invalid-response.membership-update", 74],
  ["api-invalid-response.membership-list.envelope", 75],
  ["api-invalid-response.membership-list.items", 76],
  ["api-invalid-response.membership-list.id", 77],
  ["api-invalid-response.membership-list.realm-id", 78],
  ["api-invalid-response.membership-list.organization-id", 79],
  ["api-invalid-response.membership-list.user-id", 80],
  ["api-invalid-response.membership-list.created-at", 81],
  ["api-invalid-response.membership-list.updated-at", 82],
  ["api-invalid-response.membership-list.roles", 83],
  ["api-invalid-response.membership-list.next-page-token", 84],
  ["api-invalid-response.membership-list.unknown", 85],
  ["api-failed", 86],
  ["api-rejected.realm-list", 32],
  ["api-rejected.organization-list", 33],
  ["api-rejected.password-policy-get", 34],
  ["api-rejected.user-list", 35],
  ["api-rejected.machine-user-list", 36],
  ["api-rejected.membership-list", 37],
  ["api-rejected.user-create", 38],
  ["api-rejected.user-email-verification-set", 39],
  ["api-rejected.user-lifecycle-set", 40],
  ["api-rejected.password-credential-replace", 41],
  ["api-rejected.membership-create", 42],
  ["api-rejected.membership-update", 43],
] as const

const failureCode = (suffix: string): string => `passwords.contentoren-ssotest-ensure.${suffix}`

test("Contentoren ssotest closed failure codes preserve exact exit and stderr contracts", () => {
  for (const [suffix, exitCode] of closedFailureExitCodes) {
    const code = failureCode(suffix)
    expect(passwordContentorenSsoTestProductionEnsureExitCodeGet(code)).toBe(exitCode)
    expect(passwordContentorenSsoTestProductionEnsureFailureOutputCreate(code)).toBe(
      `${JSON.stringify({ error: { code } })}\n`,
    )
  }
  expect(passwordContentorenSsoTestProductionEnsureExitCodeGet(failureCode("internal-failed"))).toBe(1)
  expect(passwordContentorenSsoTestProductionEnsureExitCodeGet("unknown.failure")).toBe(1)
  expect(
    passwordContentorenSsoTestProductionEnsureExitCodeGet({ errorMessage: "unknown", op: "unknown", success: false }),
  ).toBe(1)
})
