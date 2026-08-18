import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

type PasskeyConfiguration = {
  readonly origins: readonly string[]
  readonly rpId: string
  readonly rpName: string
}

export function passkeyConfigurationValidate(
  rpId: string,
  origins: readonly string[],
  rpName: string,
): Result<PasskeyConfiguration> {
  const op = "passkeyConfigurationValidate"
  const normalizedRpId = rpId.trim().toLowerCase()
  if (
    normalizedRpId.length === 0 ||
    normalizedRpId.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalizedRpId) ||
    normalizedRpId.includes("..")
  )
    return resultErrorCreate(op, "The passkey RP ID is invalid.", "passkeys.invalid")
  if (rpName.trim().length === 0 || rpName.length > 128)
    return resultErrorCreate(op, "The passkey RP name is invalid.", "passkeys.invalid")
  if (origins.length === 0 || origins.length > 16)
    return resultErrorCreate(op, "The passkey origins are invalid.", "passkeys.invalid")
  const normalizedOrigins: string[] = []
  for (const origin of origins) {
    let url: URL
    try {
      url = new URL(origin)
    } catch (_error) {
      return resultErrorCreate(op, "The passkey origin is invalid.", "passkeys.invalid")
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== ""
    )
      return resultErrorCreate(op, "The passkey origin is invalid.", "passkeys.invalid")
    if (url.hostname !== normalizedRpId && !url.hostname.endsWith(`.${normalizedRpId}`))
      return resultErrorCreate(op, "The passkey RP ID is not valid for the configured origin.", "passkeys.invalid")
    const normalized = url.origin
    if (!normalizedOrigins.includes(normalized)) normalizedOrigins.push(normalized)
  }
  return resultCreate({ origins: normalizedOrigins, rpId: normalizedRpId, rpName: rpName.trim() })
}
