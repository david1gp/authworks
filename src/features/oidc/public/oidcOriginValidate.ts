import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcRedirectUriValidate } from "./oidcRedirectUriValidate.js"

export function oidcOriginValidate(origin: string): Result<string> {
  const op = "oidcOriginValidate"
  const redirectUri = oidcRedirectUriValidate(origin)
  if (!redirectUri.success) return resultErrorCreate(op, "The additional origin is invalid.", "oidc.origin-invalid")
  if (origin.includes("*") || origin.includes("?") || origin.includes("#"))
    return resultErrorCreate(op, "The additional origin is invalid.", "oidc.origin-invalid")

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch (_error) {
    return resultErrorCreate(op, "The additional origin is invalid.", "oidc.origin-invalid")
  }
  const authorityStart = origin.indexOf("://")
  if (
    parsed.pathname !== "/" ||
    authorityStart < 0 ||
    origin.indexOf("/", authorityStart + 3) >= 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    parsed.origin === "null"
  )
    return resultErrorCreate(op, "The additional origin is invalid.", "oidc.origin-invalid")
  return resultCreate(parsed.origin)
}
