import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"
import { organizationLoginPolicyFactorListSchema } from "../public/organizationLoginPolicyFactorListSchema.js"

export function organizationLoginPolicyFactorListParse(
  value: string | null | undefined,
): Result<MfaPolicyFactor[] | null> {
  const op = "organizationLoginPolicyFactorListParse"
  if (value === null || value === undefined) return resultCreate(null)
  try {
    const parsed: unknown = JSON.parse(value)
    const result = v.safeParse(organizationLoginPolicyFactorListSchema, parsed)
    if (!result.success)
      return resultErrorCodedCreate(
        op,
        "The persisted login policy factor list is malformed.",
        "organizations.policy-malformed",
      )
    return resultCreate(result.output)
  } catch (_error) {
    return resultErrorCodedCreate(
      op,
      "The persisted login policy factor list is malformed.",
      "organizations.policy-malformed",
    )
  }
}
