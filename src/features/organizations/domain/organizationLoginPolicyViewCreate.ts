import type { InstanceLoginPolicyRow } from "../persistence/instanceLoginPolicyTable.js"
import type { OrganizationLoginPolicyRow } from "../persistence/organizationLoginPolicyTable.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { organizationLoginPolicyDefaults } from "./organizationLoginPolicyDefaults.js"
import { organizationLoginPolicyProviderIdsParse } from "./organizationLoginPolicyProviderIdsParse.js"

export function organizationLoginPolicyViewCreate(
  instance: InstanceLoginPolicyRow | null,
  organization: OrganizationLoginPolicyRow | null,
): OrganizationLoginPolicy {
  const instanceProviderIds = organizationLoginPolicyProviderIdsParse(instance?.providerIds)
  const organizationProviderIds = organizationLoginPolicyProviderIdsParse(organization?.providerIds)
  return {
    allowDomainDiscovery:
      organization?.allowDomainDiscovery ??
      instance?.allowDomainDiscovery ??
      organizationLoginPolicyDefaults.allowDomainDiscovery,
    allowEmailOtp:
      organization?.allowEmailOtp ?? instance?.allowEmailOtp ?? organizationLoginPolicyDefaults.allowEmailOtp,
    allowExternalIdentity:
      organization?.allowExternalIdentity ??
      instance?.allowExternalIdentity ??
      organizationLoginPolicyDefaults.allowExternalIdentity,
    allowPassword:
      organization?.allowPassword ?? instance?.allowPassword ?? organizationLoginPolicyDefaults.allowPassword,
    allowPasswordRecovery:
      organization?.allowPasswordRecovery ??
      instance?.allowPasswordRecovery ??
      organizationLoginPolicyDefaults.allowPasswordRecovery,
    allowPasskey: organization?.allowPasskey ?? instance?.allowPasskey ?? organizationLoginPolicyDefaults.allowPasskey,
    allowRegistration:
      organization?.allowRegistration ??
      instance?.allowRegistration ??
      organizationLoginPolicyDefaults.allowRegistration,
    providerIds: organizationProviderIds ?? instanceProviderIds,
  }
}
