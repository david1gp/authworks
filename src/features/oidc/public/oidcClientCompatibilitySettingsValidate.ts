import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { oidcOriginValidate } from "./oidcOriginValidate.js"

export function oidcClientCompatibilitySettingsValidate(input: {
  readonly accessTokenRoleAssertion: boolean
  readonly additionalOrigins: readonly string[]
  readonly idTokenUserinfoAssertion: boolean
}): Result<{
  readonly accessTokenRoleAssertion: boolean
  readonly additionalOrigins: string[]
  readonly idTokenUserinfoAssertion: boolean
}> {
  const op = "oidcClientCompatibilitySettingsValidate"
  if (input.additionalOrigins.length > 100)
    return resultErrorCodedCreate(
      op,
      "OIDC additional origins are limited to 100 values.",
      "oidc.configuration-invalid",
    )

  const additionalOrigins: string[] = []
  for (const origin of input.additionalOrigins) {
    const valid = oidcOriginValidate(origin)
    if (!valid.success) return valid
    additionalOrigins.push(valid.data)
  }
  if (new Set(additionalOrigins).size !== additionalOrigins.length)
    return resultErrorCodedCreate(op, "OIDC additional origins must be unique.", "oidc.conflict")

  return resultCreate({
    accessTokenRoleAssertion: input.accessTokenRoleAssertion,
    additionalOrigins,
    idTokenUserinfoAssertion: input.idTokenUserinfoAssertion,
  })
}
