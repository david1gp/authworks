import type { OrganizationLoginPolicyRow } from "../persistence/organizationLoginPolicyTable.js"
import type { RealmLoginPolicyRow } from "../persistence/realmLoginPolicyTable.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import { organizationLoginPolicyProviderIdsParse } from "./organizationLoginPolicyProviderIdsParse.js"

export function organizationLoginPolicyOverrideViewCreate(
  policy: RealmLoginPolicyRow | OrganizationLoginPolicyRow | null,
): OrganizationLoginPolicyOverride {
  if (policy === null) return {}
  const providerIds = organizationLoginPolicyProviderIdsParse(policy.providerIds)
  return {
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
  }
}
