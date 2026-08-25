import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"
import { externalIdentityProviderDefaults } from "./externalIdentityProviderDefaults.js"

const externalIdentityProviderScopesSchema = v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))

export function externalIdentityProviderScopesValidate(
  type: ExternalIdentityProviderType,
  input?: unknown,
): Result<string[]> {
  const op = "externalIdentityProviderScopesValidate"
  const defaults = externalIdentityProviderDefaults[type]
  let candidate = input
  if (candidate === undefined) candidate = defaults.scopes
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown
    } catch (_error) {
      return resultErrorCreate(op, "The external identity provider scopes are invalid.", "external-identities.invalid")
    }
  }
  const parsed = v.safeParse(externalIdentityProviderScopesSchema, candidate)
  if (!parsed.success)
    return resultErrorCreate(op, "The external identity provider scopes are invalid.", "external-identities.invalid")
  if (new Set(parsed.output).size !== parsed.output.length)
    return resultErrorCreate(op, "External identity provider scopes must be unique.", "external-identities.invalid")
  if (parsed.output.some((scope) => !defaults.allowedScopes.includes(scope)))
    return resultErrorCreate(
      op,
      "The external identity provider scope is not supported.",
      "external-identities.invalid",
    )
  if (defaults.requiredScopes.some((scope) => !parsed.output.includes(scope)))
    return resultErrorCreate(
      op,
      "The external identity provider is missing a required scope.",
      "external-identities.invalid",
    )
  return resultCreate(parsed.output)
}
