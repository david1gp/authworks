import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { OrganizationLoginPolicyRow } from "../persistence/organizationLoginPolicyTable.js"
import type { RealmLoginPolicyRow } from "../persistence/realmLoginPolicyTable.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"
import { organizationLoginPolicyDefaults } from "./organizationLoginPolicyDefaults.js"
import { organizationLoginPolicyFactorListParse } from "./organizationLoginPolicyFactorListParse.js"
import { organizationLoginPolicyFactorOrderResolve } from "./organizationLoginPolicyFactorOrderResolve.js"
import { organizationLoginPolicyProviderIdsParse } from "./organizationLoginPolicyProviderIdsParse.js"

type OrganizationLoginPolicyViewCreateOptions = {
  readonly runtimeAvailableFactors?: readonly MfaPolicyFactor[]
}

export function organizationLoginPolicyViewCreate(
  realm: RealmLoginPolicyRow | null,
  organization: OrganizationLoginPolicyRow | null,
  options: OrganizationLoginPolicyViewCreateOptions = {},
): Result<OrganizationLoginPolicy> {
  const realmProviderIds = organizationLoginPolicyProviderIdsParse(realm?.providerIds)
  const organizationProviderIds = organizationLoginPolicyProviderIdsParse(organization?.providerIds)
  const realmAllowedFactorsResult = organizationLoginPolicyFactorListParse(realm?.allowedFactors)
  if (!realmAllowedFactorsResult.success) return realmAllowedFactorsResult
  const organizationAllowedFactorsResult = organizationLoginPolicyFactorListParse(organization?.allowedFactors)
  if (!organizationAllowedFactorsResult.success) return organizationAllowedFactorsResult
  const realmOrderResult = organizationLoginPolicyFactorListParse(realm?.preferredFactorOrder)
  if (!realmOrderResult.success) return realmOrderResult
  const organizationOrderResult = organizationLoginPolicyFactorListParse(organization?.preferredFactorOrder)
  if (!organizationOrderResult.success) return organizationOrderResult
  const realmAllowedFactors = realmAllowedFactorsResult.data ?? organizationLoginPolicyDefaults.allowedFactors
  const organizationAllowedFactors = organizationAllowedFactorsResult.data
  const allowedFactors =
    organizationAllowedFactors === null
      ? realmAllowedFactors
      : realmAllowedFactors.filter((factor) => organizationAllowedFactors.includes(factor))
  const requiredMfa =
    (organization?.requiredMfa ?? false) || (realm?.requiredMfa ?? organizationLoginPolicyDefaults.requiredMfa)
  const realmMinimumStepUpAssurance =
    (realm?.minimumStepUpAssurance as OrganizationLoginPolicy["minimumStepUpAssurance"] | null | undefined) ??
    organizationLoginPolicyDefaults.minimumStepUpAssurance
  const organizationMinimumStepUpAssurance = organization?.minimumStepUpAssurance as
    | OrganizationLoginPolicy["minimumStepUpAssurance"]
    | null
    | undefined
  const minimumStepUpAssurance =
    organizationMinimumStepUpAssurance === "multi_factor" ||
    (organizationMinimumStepUpAssurance === "authenticated" && realmMinimumStepUpAssurance === "none")
      ? organizationMinimumStepUpAssurance
      : realmMinimumStepUpAssurance
  return resultCreate({
    allowDomainDiscovery:
      organization?.allowDomainDiscovery ??
      realm?.allowDomainDiscovery ??
      organizationLoginPolicyDefaults.allowDomainDiscovery,
    allowEmailOtp: organization?.allowEmailOtp ?? realm?.allowEmailOtp ?? organizationLoginPolicyDefaults.allowEmailOtp,
    allowWhatsappOtp:
      organization?.allowWhatsappOtp ??
      realm?.allowWhatsappOtp ??
      organizationLoginPolicyDefaults.allowWhatsappOtp ??
      true,
    allowExternalIdentity:
      organization?.allowExternalIdentity ??
      realm?.allowExternalIdentity ??
      organizationLoginPolicyDefaults.allowExternalIdentity,
    allowPassword: organization?.allowPassword ?? realm?.allowPassword ?? organizationLoginPolicyDefaults.allowPassword,
    allowPasswordRecovery:
      organization?.allowPasswordRecovery ??
      realm?.allowPasswordRecovery ??
      organizationLoginPolicyDefaults.allowPasswordRecovery,
    allowPasskey: organization?.allowPasskey ?? realm?.allowPasskey ?? organizationLoginPolicyDefaults.allowPasskey,
    allowRegistration:
      organization?.allowRegistration ?? realm?.allowRegistration ?? organizationLoginPolicyDefaults.allowRegistration,
    providerIds: organizationProviderIds ?? realmProviderIds,
    sessionLifetimeSeconds:
      organization?.sessionLifetimeSeconds ??
      realm?.sessionLifetimeSeconds ??
      organizationLoginPolicyDefaults.sessionLifetimeSeconds,
    requiredMfa,
    allowedFactors,
    preferredFactorOrder: organizationLoginPolicyFactorOrderResolve({
      organizationOrder: organizationOrderResult.data,
      permittedFactors: allowedFactors,
      realmOrder: realmOrderResult.data,
      runtimeAvailableFactors: options.runtimeAvailableFactors,
    }),
    minimumStepUpAssurance,
  })
}
