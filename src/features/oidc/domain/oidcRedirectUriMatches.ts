import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"

export function oidcRedirectUriMatches(requested: string, configured: readonly string[]): Result<string> {
  const op = "oidcRedirectUriMatches"
  if (!configured.includes(requested))
    return resultErrorCreate(op, "The redirect URI is not registered.", "oidc.redirect-uri-not-registered")
  return resultCreate(requested)
}
