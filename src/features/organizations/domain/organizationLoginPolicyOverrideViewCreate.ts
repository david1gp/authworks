import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { OrganizationLoginPolicyRow } from "../persistence/organizationLoginPolicyTable.js"
import type { RealmLoginPolicyRow } from "../persistence/realmLoginPolicyTable.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import { organizationLoginPolicyFactorListParse } from "./organizationLoginPolicyFactorListParse.js"
import { organizationLoginPolicyProviderIdsParse } from "./organizationLoginPolicyProviderIdsParse.js"

export function organizationLoginPolicyOverrideViewCreate(
  policy: RealmLoginPolicyRow | OrganizationLoginPolicyRow | null,
): Result<OrganizationLoginPolicyOverride> {
  if (policy === null) return resultCreate({})
  const providerIds = organizationLoginPolicyProviderIdsParse(policy.providerIds)
  const allowedFactors = organizationLoginPolicyFactorListParse(policy.allowedFactors)
  if (!allowedFactors.success) return allowedFactors
  const preferredFactorOrder = organizationLoginPolicyFactorListParse(policy.preferredFactorOrder)
  if (!preferredFactorOrder.success) return preferredFactorOrder
  return resultCreate({
    ...(policy.allowDomainDiscovery === null || policy.allowDomainDiscovery === undefined
      ? {}
      : { allowDomainDiscovery: policy.allowDomainDiscovery }),
    ...(policy.allowEmailOtp === null || policy.allowEmailOtp === undefined
      ? {}
      : { allowEmailOtp: policy.allowEmailOtp }),
    ...(policy.allowWhatsappOtp === null || policy.allowWhatsappOtp === undefined
      ? {}
      : { allowWhatsappOtp: policy.allowWhatsappOtp }),
    ...(policy.allowExternalIdentity === null || policy.allowExternalIdentity === undefined
      ? {}
      : { allowExternalIdentity: policy.allowExternalIdentity }),
    ...(policy.allowExternalIdentityAutoLinking === null || policy.allowExternalIdentityAutoLinking === undefined
      ? {}
      : { allowExternalIdentityAutoLinking: policy.allowExternalIdentityAutoLinking }),
    ...(policy.allowPassword === null || policy.allowPassword === undefined
      ? {}
      : { allowPassword: policy.allowPassword }),
    ...(policy.allowPasswordRecovery === null || policy.allowPasswordRecovery === undefined
      ? {}
      : { allowPasswordRecovery: policy.allowPasswordRecovery }),
    ...(policy.allowPasskey === null || policy.allowPasskey === undefined ? {} : { allowPasskey: policy.allowPasskey }),
    ...(policy.allowRegistration === null || policy.allowRegistration === undefined
      ? {}
      : { allowRegistration: policy.allowRegistration }),
    ...(providerIds === null ? {} : { providerIds }),
    ...(policy.sessionLifetimeSeconds === null || policy.sessionLifetimeSeconds === undefined
      ? {}
      : { sessionLifetimeSeconds: policy.sessionLifetimeSeconds }),
    ...(policy.requiredMfa === null || policy.requiredMfa === undefined ? {} : { requiredMfa: policy.requiredMfa }),
    ...(allowedFactors.data === null ? {} : { allowedFactors: allowedFactors.data }),
    ...(preferredFactorOrder.data === null ? {} : { preferredFactorOrder: preferredFactorOrder.data }),
    ...(policy.minimumStepUpAssurance === null || policy.minimumStepUpAssurance === undefined
      ? {}
      : {
          minimumStepUpAssurance:
            policy.minimumStepUpAssurance as OrganizationLoginPolicyOverride["minimumStepUpAssurance"],
        }),
  })
}
