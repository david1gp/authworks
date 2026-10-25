import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

type SessionGeoConfiguration = {
  readonly baseUrl: string
}

/** Parses the optional session geo lookup configuration; unset disables enrichment. */
export function sessionGeoConfigurationParse(
  input: Readonly<Record<string, string | undefined>>,
): Result<SessionGeoConfiguration | undefined> {
  const op = "sessionGeoConfigurationParse"
  const baseUrl = input.AUTHWORKS_GEO_LOOKUP_URL?.trim()
  if (baseUrl === undefined || baseUrl.length === 0) return resultCreate(undefined)
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
