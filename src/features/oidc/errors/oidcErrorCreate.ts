import type { ResultErr } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function oidcErrorCreate(op: string, message: string, errorData?: string, code?: string): ResultErr {
  const result = resultErrorCodedCreate(op, message, code ?? oidcErrorCodeResolve(op))
  if (errorData !== undefined) result.errorData = errorData
  return result
}

function oidcErrorCodeResolve(op: string): string {
  if (op === "oidcTokenInvalidClient" || op === "oidcTokenRevokeInvalidClient") return "oidc.invalid-client"
  if (op === "oidcTokenInvalidGrant") return "oidc.invalid-grant"
  if (op === "oidcTokenInvalidScope") return "oidc.invalid-scope"
  if (op === "oidcTokenInvalidRequest" || op === "oidcTokenRevoke") return "oidc.invalid-request"
  if (op === "oidcAuthorizationRequestAuthorize" || op === "oidcAuthorizationRequestConsent")
    return "oidc.invalid-request"
  if (op === "oidcAuthorizationCodeRedeem") return "oidc.invalid-grant"
  if (op === "oidcAuthorizationInsufficientAssurance") return "oidc.authorization-interaction-required"
  if (op === "oidcAuthorizationConsentRequired") return "oidc.authorization-consent-required"
  if (op === "oidcLogout") return "oidc.invalid-request"
  if (op === "oidcTokenIssue") return "oidc.internal"
  if (op === "oidcUserInfoInvalidToken" || op === "oidcUserInfoScopeParse") return "oidc.invalid-token"
  if (op === "oidcClientConfigurationValidate" || op === "oidcClientUpdateConfigurationValidate")
    return "oidc.configuration-invalid"
  if (op === "oidcConsentScopeParse" || op === "oidcStoredScopeParse" || op === "oidcScopeParse")
    return "oidc.consent-invalid"
  if (op === "oidcStringArrayParse") return "oidc.configuration-invalid"
  if (op === "oidcRedirectUriValidate" || op === "oidcRedirectUriMatches") return "oidc.redirect-uri-invalid"
  if (op === "oidcClientContextAuthorize") return "oidc.unauthorized"
  return "oidc.invalid"
}
