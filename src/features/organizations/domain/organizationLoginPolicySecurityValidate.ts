import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { organizationLoginPolicyDefaults } from "./organizationLoginPolicyDefaults.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { OrganizationLoginPolicySetRequest } from "../public/organizationLoginPolicySetRequestSchema.js"

type OrganizationLoginPolicySecurityValidateOptions = {
  readonly input: OrganizationLoginPolicySetRequest
  readonly organizationOverride?: OrganizationLoginPolicyOverride
  readonly realmPolicy: OrganizationLoginPolicy
  readonly scope: "realm" | "organization"
}

export function organizationLoginPolicySecurityValidate(
  options: OrganizationLoginPolicySecurityValidateOptions,
): Result<void> {
  const op = "organizationLoginPolicySecurityValidate"
  const organizationOverride = options.organizationOverride ?? {}
  const organizationFactors =
    options.scope === "organization"
      ? options.input.allowedFactors === undefined
        ? organizationOverride.allowedFactors
        : options.input.allowedFactors
      : undefined
  const allowedFactors =
    options.scope === "realm"
      ? options.input.allowedFactors === undefined
        ? options.realmPolicy.allowedFactors
        : (options.input.allowedFactors ?? organizationLoginPolicyDefaults.allowedFactors)
      : (organizationFactors ?? options.realmPolicy.allowedFactors)
  const requiredMfa =
    options.scope === "realm"
      ? options.input.requiredMfa === undefined
        ? options.realmPolicy.requiredMfa
        : (options.input.requiredMfa ?? organizationLoginPolicyDefaults.requiredMfa)
      : options.input.requiredMfa === undefined
        ? (organizationOverride.requiredMfa ?? options.realmPolicy.requiredMfa)
        : (options.input.requiredMfa ?? options.realmPolicy.requiredMfa)
  const assurance =
    options.scope === "realm"
      ? options.input.minimumStepUpAssurance === undefined
        ? options.realmPolicy.minimumStepUpAssurance
        : (options.input.minimumStepUpAssurance ?? organizationLoginPolicyDefaults.minimumStepUpAssurance)
      : options.input.minimumStepUpAssurance === undefined
        ? (organizationOverride.minimumStepUpAssurance ?? options.realmPolicy.minimumStepUpAssurance)
        : (options.input.minimumStepUpAssurance ?? options.realmPolicy.minimumStepUpAssurance)
  const preferredOrder =
    options.scope === "realm"
      ? options.input.preferredFactorOrder === undefined
        ? options.realmPolicy.preferredFactorOrder
        : (options.input.preferredFactorOrder ?? organizationLoginPolicyDefaults.preferredFactorOrder)
      : options.input.preferredFactorOrder === undefined
        ? organizationOverride.preferredFactorOrder
        : options.input.preferredFactorOrder
  const realmFactors = new Set(options.realmPolicy.allowedFactors)
  const configuredFactors = new Set(allowedFactors)

  if (organizationFactors !== undefined && organizationFactors !== null) {
    for (const factor of organizationFactors) {
      if (!realmFactors.has(factor))
        return resultErrorCodedCreate(
          op,
          "An organization may only narrow the realm factor allowlist.",
          "organizations.invalid",
        )
    }
  }
  if (preferredOrder !== undefined && preferredOrder !== null) {
    for (const factor of preferredOrder) {
      if (!configuredFactors.has(factor))
        return resultErrorCodedCreate(
          op,
          "The preferred factor order must use allowed factors.",
          "organizations.invalid",
        )
    }
  }
  if (requiredMfa && allowedFactors.length === 0)
    return resultErrorCodedCreate(op, "Required MFA needs at least one allowed factor.", "organizations.invalid")
  if (options.scope === "organization" && organizationRequiredMfaIsWeaker(requiredMfa, options.realmPolicy.requiredMfa))
    return resultErrorCodedCreate(
      op,
      "An organization cannot weaken the realm MFA requirement.",
      "organizations.invalid",
    )
  if (
    options.scope === "organization" &&
    organizationAssuranceIsWeaker(assurance, options.realmPolicy.minimumStepUpAssurance)
  )
    return resultErrorCodedCreate(
      op,
      "An organization cannot weaken the realm step-up assurance.",
      "organizations.invalid",
    )
  return resultCreate(undefined)
}

function organizationRequiredMfaIsWeaker(current: boolean, realm: boolean): boolean {
  return realm && !current
}

function organizationAssuranceIsWeaker(
  current: OrganizationLoginPolicy["minimumStepUpAssurance"],
  realm: OrganizationLoginPolicy["minimumStepUpAssurance"],
): boolean {
  return organizationAssuranceRankGet(current) < organizationAssuranceRankGet(realm)
}

function organizationAssuranceRankGet(assurance: OrganizationLoginPolicy["minimumStepUpAssurance"]): number {
  if (assurance === "multi_factor") return 2
  if (assurance === "authenticated") return 1
  return 0
}
