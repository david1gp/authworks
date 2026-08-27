import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { demoAdminMemberships } from "../../demo/demoAdminMemberships.js"
import { demoAdminOrganizationDomains } from "../../demo/demoAdminOrganizationDomains.js"
import { demoAdminOrganizationInvitations } from "../../demo/demoAdminOrganizationInvitations.js"
import { demoAdminOrganizationProviders } from "../../demo/demoAdminOrganizationProviders.js"
import { demoAdminOrganizationRoles } from "../../demo/demoAdminOrganizationRoles.js"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import { organizationBrandingDefaultCreate } from "../domain/organizationBrandingDefaultCreate.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationDomain } from "../public/organizationDomainSchema.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { Organization } from "../public/organizationSchema.js"
import type { OrganizationAdminAdapter } from "./organizationAdminAdapter.js"

const demoRealmId = "01900000-0000-7000-8000-000000000001"
const demoOrganizationId = "01900000-0000-7000-8000-000000000011"
const now = 1_755_782_400_000

/**
 * Deterministic, network-free organization administration fixtures. The selected demo state drives
 * empty, loading, error, denied, and secret-redacted variants without any backend.
 */
export function organizationAdminDemoAdapterCreate(fixtureState: () => DemoFixtureState): OrganizationAdminAdapter {
  const organizations: Organization[] = demoAdminOrganizations.map((organization) => ({ ...organization }))
  const memberships: OrganizationMembership[] = demoAdminMemberships
    .filter((membership) => membership.organizationId === demoOrganizationId)
    .map((membership) => ({ ...membership }))
  const invitations: OrganizationInvitation[] = demoAdminOrganizationInvitations.map((item) => ({ ...item }))
  const domains: OrganizationDomain[] = demoAdminOrganizationDomains.map((item) => ({ ...item }))
  const providers: ExternalIdentityProvider[] = demoAdminOrganizationProviders.map((item) => ({ ...item }))
  let branding: OrganizationBranding = {
    ...organizationBrandingDefaultCreate(),
    light: { ...organizationBrandingDefaultCreate().light, primaryColor: "#2563eb" },
  }
  let realmPolicy: OrganizationLoginPolicy = {
    allowDomainDiscovery: true,
    allowEmailOtp: true,
    allowExternalIdentity: true,
    allowExternalIdentityAutoLinking: true,
    allowPasskey: true,
    allowPassword: true,
    allowPasswordRecovery: true,
    allowRegistration: false,
    providerIds: null,
    requiredMfa: true,
    allowedFactors: ["totp", "email_otp", "passkey"],
    preferredFactorOrder: ["totp", "email_otp", "passkey"],
    minimumStepUpAssurance: "multi_factor",
  }
  let organizationOverrides: OrganizationLoginPolicyOverride = {
    allowRegistration: false,
    allowedFactors: ["totp", "passkey"],
    preferredFactorOrder: ["passkey", "totp"],
  }
  const organizationPolicy = (): OrganizationLoginPolicy => {
    const values = Object.fromEntries(
      Object.entries(organizationOverrides).filter(([, value]) => value !== undefined && value !== null),
    ) as Partial<OrganizationLoginPolicy>
    return {
      ...realmPolicy,
      ...values,
      allowedFactors: [...(organizationOverrides.allowedFactors ?? realmPolicy.allowedFactors)],
      preferredFactorOrder: [...(organizationOverrides.preferredFactorOrder ?? realmPolicy.preferredFactorOrder)],
    }
  }

  const pending = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)
  const denied = <T>(op: string): Result<T> => {
    const failure = resultErrorCodedCreate(op, "You cannot manage this organization.", "organizations.forbidden")
    failure.statusCode = 403
    return failure
  }
  const failed = <T>(op: string): Result<T> =>
    resultErrorCodedCreate(op, "The deterministic organization fixture failed.", "organizations.invalid")
  const guard = <T>(op: string, value: () => T): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return pending<T>()
    if (state === "permission-denied") return Promise.resolve(denied<T>(op))
    if (state === "error") return Promise.resolve(failed<T>(op))
    return Promise.resolve(resultCreate(value()))
  }
  const empty = () => fixtureState() === "empty"
  const listOf = <T>(items: readonly T[]) => ({ items: empty() ? [] : [...items] })

  return {
    brandingGet: (organizationId) =>
      guard("organizationAdminDemoBrandingGet", () => ({
        branding,
        organizationId: organizationId.length === 0 ? demoOrganizationId : organizationId,
        updatedAt: now,
        version: 2,
      })),
    brandingSet: (organizationId, input) =>
      guard("organizationAdminDemoBrandingSet", () => {
        branding = input
        return {
          branding,
          organizationId: organizationId.length === 0 ? demoOrganizationId : organizationId,
          updatedAt: now,
          version: 3,
        }
      }),
    domainClaim: (organizationId, input) =>
      guard("organizationAdminDemoDomainClaim", () => {
        const domain: OrganizationDomain = {
          createdAt: now,
          domain: input.domain,
          isPrimary: input.isPrimary ?? false,
          organizationId: organizationId.length === 0 ? demoOrganizationId : organizationId,
          realmId: demoRealmId,
          updatedAt: now,
          verification: {
            recordName: `_authworks-challenge.${input.domain}`,
            recordType: "TXT",
            recordValue: "authworks-domain-verification=demo0000fixture00",
          },
          verified: false,
          version: 1,
        }
        domains.push(domain)
        return { domain }
      }),
    domainDiscover: (domain) =>
      guard("organizationAdminDemoDomainDiscover", () =>
        domain === "acme.example"
          ? {
              branding,
              domain,
              found: true as const,
              organization: { id: demoOrganizationId, name: "Acme Corporation", realmId: demoRealmId },
              policy: organizationPolicy(),
              providers: providers
                .filter((provider) => provider.enabled)
                .map((provider) => ({
                  displayName: provider.displayName,
                  id: provider.id,
                  type: provider.type,
                })),
            }
          : { found: false as const },
      ),
    domainList: () => guard("organizationAdminDemoDomainList", () => listOf(domains)),
    domainRemove: (_organizationId, domain) =>
      guard("organizationAdminDemoDomainRemove", () => {
        const index = domains.findIndex((item) => item.domain === domain)
        if (index >= 0) domains.splice(index, 1)
        return { removed: true }
      }),
    domainVerify: (_organizationId, domain) =>
      guard("organizationAdminDemoDomainVerify", () => {
        const found = domains.find((item) => item.domain === domain)
        if (found !== undefined) {
          found.verified = true
          found.verification = undefined
          found.version += 1
        }
        return { domain: { ...(found ?? domains[0]!) } }
      }),
    invitationCreate: (organizationId, input) =>
      guard("organizationAdminDemoInvitationCreate", () => {
        const invitation: OrganizationInvitation = {
          acceptedAt: null,
          createdAt: now,
          email: input.email,
          expiresAt: now + 604_800_000,
          id: demoResourceIdGenerate(),
          organizationId: organizationId.length === 0 ? demoOrganizationId : organizationId,
          realmId: demoRealmId,
          roles: input.roles,
          status: "pending",
          updatedAt: now,
        }
        invitations.push(invitation)
        return { invitation, token: "demo-invitation-token-0f9c31a7e5b24d68" }
      }),
    invitationList: () => guard("organizationAdminDemoInvitationList", () => listOf(invitations)),
    invitationRevoke: (_organizationId, invitationId) =>
      guard("organizationAdminDemoInvitationRevoke", () => {
        const index = invitations.findIndex((item) => item.id === invitationId)
        if (index >= 0) invitations.splice(index, 1)
        return { revoked: true }
      }),
    loginPolicyGet: (organizationId) =>
      guard("organizationAdminDemoLoginPolicyGet", () =>
        organizationId.length === 0
          ? { organizationId: null, overrides: realmPolicy, policy: realmPolicy, realmId: demoRealmId }
          : {
              organizationId,
              overrides: organizationOverrides,
              policy: organizationPolicy(),
              realmId: demoRealmId,
            },
      ),
    loginPolicySet: (organizationId, input) =>
      guard("organizationAdminDemoLoginPolicySet", () => {
        if (organizationId.length === 0) {
          realmPolicy = {
            ...realmPolicy,
            ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null)),
          }
        } else {
          organizationOverrides = { ...organizationOverrides, ...input }
        }
        return {
          organizationId: organizationId.length === 0 ? null : organizationId,
          overrides: organizationId.length === 0 ? input : organizationOverrides,
          policy: organizationId.length === 0 ? realmPolicy : organizationPolicy(),
          realmId: demoRealmId,
        }
      }),
    membershipCreate: (organizationId, input) =>
      guard("organizationAdminDemoMembershipCreate", () => {
        const membership: OrganizationMembership = {
          createdAt: now,
          id: demoResourceIdGenerate(),
          organizationId: organizationId.length === 0 ? demoOrganizationId : organizationId,
          realmId: demoRealmId,
          roles: input.roles,
          updatedAt: now,
          userId: input.userId,
        }
        memberships.push(membership)
        return { membership }
      }),
    membershipList: () => guard("organizationAdminDemoMembershipList", () => listOf(memberships)),
    membershipRemove: (_organizationId, membershipId) =>
      guard("organizationAdminDemoMembershipRemove", () => {
        const index = memberships.findIndex((item) => item.id === membershipId)
        if (index >= 0) memberships.splice(index, 1)
        return { removed: true }
      }),
    membershipUpdate: (_organizationId, membershipId, input) =>
      guard("organizationAdminDemoMembershipUpdate", () => {
        const found = memberships.find((item) => item.id === membershipId)
        if (found !== undefined) {
          found.roles = input.roles
          found.updatedAt = now
        }
        return { membership: { ...(found ?? memberships[0]!) } }
      }),
    organizationCreate: (input) =>
      guard("organizationAdminDemoOrganizationCreate", () => {
        const organization: Organization = {
          createdAt: now,
          id: demoResourceIdGenerate(),
          name: input.name,
          realmId: demoRealmId,
          status: "active",
          updatedAt: now,
        }
        organizations.push(organization)
        return { organization }
      }),
    organizationGet: (organizationId) =>
      guard("organizationAdminDemoOrganizationGet", () => ({
        organization: organizations.find((item) => item.id === organizationId) ?? organizations[0]!,
      })),
    organizationLifecycleSet: (organizationId, input) =>
      guard("organizationAdminDemoOrganizationLifecycleSet", () => {
        const found = organizations.find((item) => item.id === organizationId) ?? organizations[0]!
        found.status = input.status
        found.updatedAt = now
        return { organization: { ...found } }
      }),
    organizationList: () => guard("organizationAdminDemoOrganizationList", () => listOf(organizations)),
    organizationUpdate: (organizationId, input) =>
      guard("organizationAdminDemoOrganizationUpdate", () => {
        const found = organizations.find((item) => item.id === organizationId) ?? organizations[0]!
        found.name = input.name
        found.updatedAt = now
        return { organization: { ...found } }
      }),
    providerCreate: (input) =>
      guard("organizationAdminDemoProviderCreate", () => {
        // The submitted client secret is intentionally dropped; stored secrets are never readable.
        const provider: ExternalIdentityProvider = {
          allowAccountCreation: input.allowAccountCreation ?? false,
          clientId: input.clientId,
          createdAt: now,
          displayName: input.displayName,
          enabled: true,
          id: demoResourceIdGenerate(),
          organizationId: demoOrganizationId,
          realmId: demoRealmId,
          redirectUri: input.redirectUri,
          scopes: input.scopes ?? ["openid", "email", "profile"],
          type: input.type,
          updatedAt: now,
          version: 1,
        }
        providers.push(provider)
        return { provider }
      }),
    providerDisable: (providerId) =>
      guard("organizationAdminDemoProviderDisable", () => {
        const found = providers.find((item) => item.id === providerId) ?? providers[0]!
        found.enabled = false
        found.version += 1
        return { provider: { ...found } }
      }),
    providerList: () => guard("organizationAdminDemoProviderList", () => listOf(providers)),
    providerUpdate: (providerId, input) =>
      guard("organizationAdminDemoProviderUpdate", () => {
        const found = providers.find((item) => item.id === providerId) ?? providers[0]!
        if (input.displayName !== undefined) found.displayName = input.displayName
        if (input.enabled !== undefined) found.enabled = input.enabled
        found.version += 1
        return { provider: { ...found } }
      }),
    roleList: () => guard("organizationAdminDemoRoleList", () => ({ items: [...demoAdminOrganizationRoles] })),
  }
}
