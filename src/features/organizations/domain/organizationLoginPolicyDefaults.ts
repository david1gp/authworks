import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { organizationLoginPolicyCanonicalFactorOrder } from "./organizationLoginPolicyCanonicalFactorOrder.js"

export const organizationLoginPolicyDefaults: OrganizationLoginPolicy = {
  allowDomainDiscovery: true,
  allowEmailOtp: true,
  allowWhatsappOtp: true,
  allowExternalIdentity: true,
  allowExternalIdentityAutoLinking: true,
  allowPassword: true,
  allowPasswordRecovery: true,
  allowPasskey: true,
  allowRegistration: true,
  providerIds: null,
  sessionLifetimeSeconds: 30 * 24 * 60 * 60,
  requiredMfa: false,
  allowedFactors: [...organizationLoginPolicyCanonicalFactorOrder],
  preferredFactorOrder: [...organizationLoginPolicyCanonicalFactorOrder],
  minimumStepUpAssurance: "authenticated",
}
