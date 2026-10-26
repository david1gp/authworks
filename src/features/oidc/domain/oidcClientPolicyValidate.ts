import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

type OidcClientPolicyInput = {
  readonly accessTokenLifetimeSeconds?: number | null
  readonly grantTypes?: readonly string[]
  readonly idTokenLifetimeSeconds?: number | null
  readonly refreshTokenAbsoluteLifetimeSeconds?: number | null
  readonly refreshTokenIdleLifetimeSeconds?: number | null
  readonly responseTypes?: readonly string[]
}

const oidcSupportedGrantTypes = ["authorization_code", "refresh_token"] as const
const oidcSupportedResponseTypes = ["code"] as const

export function oidcClientPolicyValidate(input: OidcClientPolicyInput): Result<{
  readonly accessTokenLifetimeSeconds: number | null
  readonly grantTypes: string[]
  readonly idTokenLifetimeSeconds: number | null
  readonly refreshTokenAbsoluteLifetimeSeconds: number | null
  readonly refreshTokenIdleLifetimeSeconds: number | null
  readonly responseTypes: string[]
}> {
  const op = "oidcClientPolicyValidate"
  const grantTypes = [...(input.grantTypes ?? oidcSupportedGrantTypes)]
  const responseTypes = [...(input.responseTypes ?? oidcSupportedResponseTypes)]
  if (new Set(grantTypes).size !== grantTypes.length)
    return resultErrorCodedCreate(op, "OIDC grant types must be unique.", "oidc.conflict")
  if (new Set(responseTypes).size !== responseTypes.length)
    return resultErrorCodedCreate(op, "OIDC response types must be unique.", "oidc.conflict")
  if (grantTypes.some((grant) => !(oidcSupportedGrantTypes as readonly string[]).includes(grant)))
    return resultErrorCodedCreate(op, "The OIDC grant type is not supported.", "oidc.invalid")
  if (responseTypes.some((response) => !(oidcSupportedResponseTypes as readonly string[]).includes(response)))
    return resultErrorCodedCreate(op, "The OIDC response type is not supported.", "oidc.invalid")
  const idle = input.refreshTokenIdleLifetimeSeconds ?? null
  const absolute = input.refreshTokenAbsoluteLifetimeSeconds ?? null
  if (idle !== null && absolute !== null && idle > absolute)
    return resultErrorCodedCreate(
      op,
      "The refresh idle lifetime must not exceed the absolute lifetime.",
      "oidc.invalid",
    )
  return resultCreate({
    accessTokenLifetimeSeconds: input.accessTokenLifetimeSeconds ?? null,
    grantTypes,
    idTokenLifetimeSeconds: input.idTokenLifetimeSeconds ?? null,
    refreshTokenAbsoluteLifetimeSeconds: absolute,
    refreshTokenIdleLifetimeSeconds: idle,
    responseTypes,
  })
}
