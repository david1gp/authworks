import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

type SessionGeoConfiguration = {
  readonly baseUrl: string
}

/**
 * Parses the session geo lookup configuration. Unset defaults to the public
 * ip-api.com endpoint (free, no account) so active sessions resolve a
 * location without extra setup; an explicitly empty value disables
 * enrichment. Note the free tier serves plain HTTP only.
 */
export function sessionGeoConfigurationParse(
  input: Readonly<Record<string, string | undefined>>,
): Result<SessionGeoConfiguration | undefined> {
  const op = "sessionGeoConfigurationParse"
  const configured = input.AUTHWORKS_GEO_LOOKUP_URL
  if (configured !== undefined && configured.trim().length === 0) return resultCreate(undefined)
  const baseUrl = configured?.trim() || "http://ip-api.com/json/"
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch (_error) {
    return resultErrorCreate(op, "The session geo lookup URL is invalid.")
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    return resultErrorCreate(op, "The session geo lookup URL is invalid.")
  const normalized = parsed.toString()
  return resultCreate({ baseUrl: normalized.endsWith("/") ? normalized : `${normalized}/` })
}
