import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"

export function passwordRegistrationRateLimitSecretValidate(
  secret: Secret | string | undefined,
): Result<Secret | string> {
  const op = "passwordRegistrationRateLimitSecretValidate"
  if (secret === undefined || (typeof secret === "string" ? secret.length === 0 : secret.valueGet().length === 0))
    return resultErrorCreate(
      op,
      "WhatsApp registration rate limiting requires AUTHWORKS_SYSTEM_SECRET.",
      "platform.configuration-invalid",
    )
  return resultCreate(secret)
}
