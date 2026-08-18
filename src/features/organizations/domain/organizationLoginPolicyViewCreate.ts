import type { RealmLoginPolicyRow } from "../persistence/realmLoginPolicyTable.js"
import type { OrganizationLoginPolicyRow } from "../persistence/organizationLoginPolicyTable.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { organizationLoginPolicyDefaults } from "./organizationLoginPolicyDefaults.js"
import { organizationLoginPolicyProviderIdsParse } from "./organizationLoginPolicyProviderIdsParse.js"

export function organizationLoginPolicyViewCreate(
  realm: RealmLoginPolicyRow | null,
  organization: OrganizationLoginPolicyRow | null,
): OrganizationLoginPolicy {
  const realmProviderIds = organizationLoginPolicyProviderIdsParse(realm?.providerIds)
  const organizationProviderIds = organizationLoginPolicyProviderIdsParse(organization?.providerIds)
  return {
    allowDomainDiscovery:
      organization?.allowDomainDiscovery ??
      realm?.allowDomainDiscovery ??
      organizationLoginPolicyDefaults.allowDomainDiscovery,
    allowEmailOtp: organization?.allowEmailOtp ?? realm?.allowEmailOtp ?? organizationLoginPolicyDefaults.allowEmailOtp,
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
  }
}
