import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function oidcRedirectUriMatches(requested: string, configured: readonly string[]): Result<string> {
  const op = "oidcRedirectUriMatches"
  if (!configured.includes(requested)) return resultErrorCreate(op, "The redirect URI is not registered.")
  return resultCreate(requested)
}
