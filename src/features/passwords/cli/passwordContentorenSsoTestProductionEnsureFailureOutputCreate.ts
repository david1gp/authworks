import type { ResultErr } from "#result"

const inputInvalidCode = "passwords.contentoren-ssotest-ensure.input-invalid"
const authorizationUnavailableCode = "passwords.contentoren-ssotest-ensure.authorization-unavailable"
const realmNotFoundCode = "passwords.contentoren-ssotest-ensure.realm-not-found"
const realmAmbiguousCode = "passwords.contentoren-ssotest-ensure.realm-ambiguous"
const realmInactiveCode = "passwords.contentoren-ssotest-ensure.realm-inactive"
const organizationNotFoundCode = "passwords.contentoren-ssotest-ensure.organization-not-found"
const organizationAmbiguousCode = "passwords.contentoren-ssotest-ensure.organization-ambiguous"
const organizationInactiveCode = "passwords.contentoren-ssotest-ensure.organization-inactive"
const humanAmbiguousCode = "passwords.contentoren-ssotest-ensure.human-ambiguous"
const humanConflictCode = "passwords.contentoren-ssotest-ensure.human-conflict"
const humanDeletedCode = "passwords.contentoren-ssotest-ensure.human-deleted"
const machineConflictCode = "passwords.contentoren-ssotest-ensure.machine-conflict"
const membershipElevatedCode = "passwords.contentoren-ssotest-ensure.membership-elevated"
const membershipAmbiguousCode = "passwords.contentoren-ssotest-ensure.membership-ambiguous"
const passwordPolicyRejectedCode = "passwords.contentoren-ssotest-ensure.password-policy-rejected"
const apiUnreachableCode = "passwords.contentoren-ssotest-ensure.api-unreachable"
const apiUnauthorizedCode = "passwords.contentoren-ssotest-ensure.api-unauthorized"
const apiForbiddenCode = "passwords.contentoren-ssotest-ensure.api-forbidden"
const apiRateLimitedCode = "passwords.contentoren-ssotest-ensure.api-rate-limited"
const apiInvalidResponseCode = "passwords.contentoren-ssotest-ensure.api-invalid-response"
const apiInvalidResponseStageCodes = new Set([
  `${apiInvalidResponseCode}.realm-list`,
  `${apiInvalidResponseCode}.organization-list`,
  `${apiInvalidResponseCode}.password-policy-get`,
  `${apiInvalidResponseCode}.user-list`,
  `${apiInvalidResponseCode}.machine-user-list`,
  `${apiInvalidResponseCode}.user-create`,
  `${apiInvalidResponseCode}.user-email-verification-set`,
  `${apiInvalidResponseCode}.user-lifecycle-set`,
  `${apiInvalidResponseCode}.password-credential-replace`,
  `${apiInvalidResponseCode}.membership-create`,
  `${apiInvalidResponseCode}.membership-update`,
])
const apiInvalidResponseMembershipListFieldCodes = new Set([
  `${apiInvalidResponseCode}.membership-list.envelope`,
  `${apiInvalidResponseCode}.membership-list.items`,
  `${apiInvalidResponseCode}.membership-list.id`,
  `${apiInvalidResponseCode}.membership-list.realm-id`,
  `${apiInvalidResponseCode}.membership-list.organization-id`,
  `${apiInvalidResponseCode}.membership-list.user-id`,
  `${apiInvalidResponseCode}.membership-list.created-at`,
  `${apiInvalidResponseCode}.membership-list.updated-at`,
  `${apiInvalidResponseCode}.membership-list.roles`,
  `${apiInvalidResponseCode}.membership-list.next-page-token`,
  `${apiInvalidResponseCode}.membership-list.unknown`,
])
const apiRejectedCode = "passwords.contentoren-ssotest-ensure.api-rejected"
const apiFailedCode = "passwords.contentoren-ssotest-ensure.api-failed"
const internalFailedCode = "passwords.contentoren-ssotest-ensure.internal-failed"

const failureCodes = new Set([
  inputInvalidCode,
  authorizationUnavailableCode,
  realmNotFoundCode,
  realmAmbiguousCode,
  realmInactiveCode,
  organizationNotFoundCode,
  organizationAmbiguousCode,
  organizationInactiveCode,
  humanAmbiguousCode,
  humanConflictCode,
  humanDeletedCode,
  machineConflictCode,
  membershipElevatedCode,
  membershipAmbiguousCode,
  passwordPolicyRejectedCode,
  apiUnreachableCode,
  apiUnauthorizedCode,
  apiForbiddenCode,
  apiRateLimitedCode,
  apiInvalidResponseCode,
  ...apiInvalidResponseStageCodes,
  ...apiInvalidResponseMembershipListFieldCodes,
  apiRejectedCode,
  apiFailedCode,
  internalFailedCode,
])

export function passwordContentorenSsoTestProductionEnsureFailureOutputCreate(failure: ResultErr | string): string {
  const code = typeof failure === "string" ? failure : failureCodeGet(failure)
  return `${JSON.stringify({ error: { code: failureCodes.has(code) ? code : internalFailedCode } })}\n`
}

function failureCodeGet(result: ResultErr): string {
  if (result.code !== undefined && apiInvalidResponseStageCodes.has(result.code)) return result.code
  if (result.code !== undefined && apiInvalidResponseMembershipListFieldCodes.has(result.code)) return result.code
  switch (result.code) {
    case inputInvalidCode:
    case realmNotFoundCode:
    case realmAmbiguousCode:
    case realmInactiveCode:
    case organizationNotFoundCode:
    case organizationAmbiguousCode:
    case organizationInactiveCode:
    case humanAmbiguousCode:
    case humanConflictCode:
    case humanDeletedCode:
    case machineConflictCode:
    case membershipElevatedCode:
    case membershipAmbiguousCode:
    case passwordPolicyRejectedCode:
      return result.code
    case "platform.unreachable":
    case "platform.unavailable":
      return apiUnreachableCode
    case "platform.invalid-response":
      return apiInvalidResponseCode
    case "platform.unauthorized":
      return apiUnauthorizedCode
    case "platform.forbidden":
      return apiForbiddenCode
    case "platform.rate-limited":
      return apiRateLimitedCode
  }
  if (result.statusCode === 401) return apiUnauthorizedCode
  if (result.statusCode === 403) return apiForbiddenCode
  if (result.statusCode === 429) return apiRateLimitedCode
  if (result.statusCode !== undefined && result.statusCode >= 400 && result.statusCode < 500) return apiRejectedCode
  if (result.op === "passwordPolicyCheck") return passwordPolicyRejectedCode
  return apiFailedCode
}
