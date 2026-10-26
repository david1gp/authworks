import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"

const oidcPromptValueNone = "none"
const oidcPromptValueLogin = "login"
const oidcPromptValueConsent = "consent"
const oidcPromptValueSelectAccount = "select_account"

const oidcPromptValues = [
  oidcPromptValueNone,
  oidcPromptValueLogin,
  oidcPromptValueConsent,
  oidcPromptValueSelectAccount,
] as const

type OidcAuthorizationPromptValidated = {
  readonly maxAge: number | undefined
  readonly prompts: readonly (typeof oidcPromptValues)[number][]
}

/**
 * Validate the OIDC `prompt` (space-separated `none login consent
 * select_account` combination; `none` must stand alone) and `max_age`
 * (non-negative integer seconds) request parameters.
 */
export function oidcAuthorizationPromptValidate(input: {
  readonly max_age?: string
  readonly prompt?: string
}): Result<OidcAuthorizationPromptValidated> {
  const op = "oidcAuthorizationPromptValidate"
  let prompts: OidcAuthorizationPromptValidated["prompts"] = []
  if (input.prompt !== undefined) {
    const values = input.prompt.split(" ")
    if (
      values.some((value) => value.length === 0) ||
      values.some((value) => !(oidcPromptValues as readonly string[]).includes(value)) ||
      new Set(values).size !== values.length ||
      (values.includes(oidcPromptValueNone) && values.length > 1)
    )
      return resultErrorCreate(op, "The OIDC prompt is invalid.")
    prompts = values as OidcAuthorizationPromptValidated["prompts"]
  }
  let maxAge: number | undefined
  if (input.max_age !== undefined) {
    if (!/^\d{1,10}$/.test(input.max_age)) return resultErrorCreate(op, "The OIDC max_age is invalid.")
    maxAge = Number(input.max_age)
    if (!Number.isSafeInteger(maxAge * 1_000)) return resultErrorCreate(op, "The OIDC max_age is invalid.")
  }
  return resultCreate({ maxAge, prompts })
}
