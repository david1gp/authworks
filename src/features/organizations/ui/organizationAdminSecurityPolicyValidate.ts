import * as v from "valibot"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { organizationLoginPolicyFactorListSchema } from "../public/organizationLoginPolicyFactorListSchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"

export function organizationAdminSecurityPolicyValidate(options: {
  readonly draft: OrganizationLoginPolicyOverride
  readonly realmPolicy: OrganizationLoginPolicy
  readonly scope: "organization" | "realm"
}): MessageKey | undefined {
  const factorListValidationKey = (factors: unknown): MessageKey | undefined => {
    const result = v.safeParse(organizationLoginPolicyFactorListSchema, factors)
    if (result.success) return undefined
    return "admin.organizations.policy.validation.order"
  }
  if (options.draft.allowedFactors != null) {
    const validationKey = factorListValidationKey(options.draft.allowedFactors)
    if (validationKey !== undefined) return validationKey
  }
  if (options.draft.preferredFactorOrder != null) {
    const validationKey = factorListValidationKey(options.draft.preferredFactorOrder)
    if (validationKey !== undefined) return validationKey
  }
  const allowedFactors = options.draft.allowedFactors ?? options.realmPolicy.allowedFactors
  const requiredMfa = options.draft.requiredMfa ?? options.realmPolicy.requiredMfa
  const preferredFactorOrder =
    options.scope === "organization"
      ? options.draft.preferredFactorOrder
      : (options.draft.preferredFactorOrder ?? options.realmPolicy.preferredFactorOrder)
  const minimumAssurance = options.draft.minimumStepUpAssurance ?? options.realmPolicy.minimumStepUpAssurance

  if (options.scope === "organization") {
    if (options.draft.allowedFactors?.some((factor) => !options.realmPolicy.allowedFactors.includes(factor)))
      return "admin.organizations.policy.validation.factorNarrowing"
    if (options.realmPolicy.requiredMfa && options.draft.requiredMfa === false)
      return "admin.organizations.policy.validation.requiredMfaWeaker"
    if (options.realmPolicy.minimumStepUpAssurance === "multi_factor" && minimumAssurance !== "multi_factor")
      return "admin.organizations.policy.validation.assuranceWeaker"
  }
  if (requiredMfa && allowedFactors.length === 0) return "admin.organizations.policy.validation.requiredFactors"
  if (preferredFactorOrder?.some((factor) => !allowedFactors.includes(factor)))
    return "admin.organizations.policy.validation.order"
  return undefined
}
