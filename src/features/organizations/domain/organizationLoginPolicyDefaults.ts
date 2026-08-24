import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"

export const organizationLoginPolicyDefaults: OrganizationLoginPolicy = {
  allowDomainDiscovery: true,
  allowEmailOtp: true,
  allowWhatsappOtp: true,
  allowExternalIdentity: true,
  allowPassword: true,
  allowPasswordRecovery: true,
  allowPasskey: true,
  allowRegistration: true,
  providerIds: null,
}
