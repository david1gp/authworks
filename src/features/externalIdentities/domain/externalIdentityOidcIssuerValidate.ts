import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

export function externalIdentityOidcIssuerValidate(input: unknown): Result<string> {
  const op = "externalIdentityOidcIssuerValidate"
  if (typeof input !== "string" || input.length === 0 || input.length > 2048)
    return resultErrorCreate(op, "The OIDC issuer is invalid.", "external-identities.invalid")
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch (_error) {
    return resultErrorCreate(op, "The OIDC issuer is invalid.", "external-identities.invalid")
  }
  if (parsed.username.length > 0 || parsed.password.length > 0 || parsed.hash.length > 0 || parsed.search.length > 0)
    return resultErrorCreate(op, "The OIDC issuer is invalid.", "external-identities.invalid")
  const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]"
  if (parsed.protocol !== "https:" && !(isLoopback && parsed.protocol === "http:"))
    return resultErrorCreate(op, "The OIDC issuer must use HTTPS.", "external-identities.invalid")
  const path = parsed.pathname.replace(/\/+$/, "")
  return resultCreate(`${parsed.origin}${path}`)
}
