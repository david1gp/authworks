import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationDomain } from "../public/organizationDomainSchema.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import type { OrganizationRole } from "../public/organizationRoleSchema.js"
import type { Organization } from "../public/organizationSchema.js"
import type { OrganizationStatus } from "../public/organizationStatusSchema.js"
import type { OrganizationAdminAdapter } from "./organizationAdminAdapter.js"
import { organizationAdminFailureStatusSelect } from "./organizationAdminFailureStatusSelect.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"
import { organizationBrandingDefaultCreate } from "../domain/organizationBrandingDefaultCreate.js"

const emptyPolicy: OrganizationLoginPolicy = {
  allowDomainDiscovery: true,
  allowEmailOtp: true,
  allowExternalIdentity: true,
  allowPasskey: true,
  allowPassword: true,
  allowPasswordRecovery: true,
  allowRegistration: true,
  providerIds: null,
}

/**
 * Shared, adapter-agnostic behaviour for every organization administration page: loading,
 * pagination, mutation, one-time invitation tokens, and destructive confirmation handling.
 */
export function organizationAdminPageStateCreate(options: {
  readonly adapter: OrganizationAdminAdapter
  readonly confirm?: (message: string) => boolean
  readonly organizationId: () => string
  readonly screen: () => OrganizationAdminScreen
}) {
  const confirm = options.confirm ?? ((message: string) => window.confirm(message))
  const status = createSignalObject<OrganizationAdminStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const organizations = createSignalObject<Organization[]>([])
  const organization = createSignalObject<Organization | undefined>(undefined)
  const memberships = createSignalObject<OrganizationMembership[]>([])
  const invitations = createSignalObject<OrganizationInvitation[]>([])
  const domains = createSignalObject<OrganizationDomain[]>([])
  const providers = createSignalObject<ExternalIdentityProvider[]>([])
  const roles = createSignalObject<OrganizationRole[]>([])
  const branding = createSignalObject<OrganizationBranding>(organizationBrandingDefaultCreate())
  const policy = createSignalObject<OrganizationLoginPolicy>(emptyPolicy)
  const overrides = createSignalObject<OrganizationLoginPolicyOverride>({})
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<string[]>([])
  const invitationToken = createSignalObject<string | undefined>(undefined)

  const fail = (failure: { code?: string; errorMessage: string; statusCode?: number }) => {
    error.set(failure.errorMessage)
    status.set(organizationAdminFailureStatusSelect(failure))
  }
  const collectionStatus = (length: number) => status.set(length === 0 ? "empty" : "ready")
  const pageToken = () => pageTokens.get().at(-1)

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    const screen = options.screen()
    const organizationId = options.organizationId()

    if (screen === "organizations") {
      const result = await options.adapter.organizationList({ pageToken: pageToken() })
      if (!result.success) return fail(result)
      organizations.set([...result.data.items])
      nextPageToken.set(result.data.nextPageToken)
      return collectionStatus(result.data.items.length)
    }
    if (screen === "organization-detail") {
      const [detail, membershipList] = await Promise.all([
        options.adapter.organizationGet(organizationId),
        options.adapter.membershipList(organizationId),
      ])
      if (!detail.success) return fail(detail)
      if (!membershipList.success) return fail(membershipList)
      organization.set(detail.data.organization)
      memberships.set([...membershipList.data.items])
      return status.set("ready")
    }
    if (screen === "memberships") {
      const [membershipList, roleList] = await Promise.all([
        options.adapter.membershipList(organizationId, { pageToken: pageToken() }),
        options.adapter.roleList(),
      ])
      if (!membershipList.success) return fail(membershipList)
      if (!roleList.success) return fail(roleList)
      memberships.set([...membershipList.data.items])
      roles.set([...roleList.data.items])
      nextPageToken.set(membershipList.data.nextPageToken)
      return collectionStatus(membershipList.data.items.length)
    }
    if (screen === "invitations") {
      const [invitationList, roleList] = await Promise.all([
        options.adapter.invitationList(organizationId, { pageToken: pageToken() }),
        options.adapter.roleList(),
      ])
      if (!invitationList.success) return fail(invitationList)
      if (!roleList.success) return fail(roleList)
      invitations.set([...invitationList.data.items])
      roles.set([...roleList.data.items])
      nextPageToken.set(invitationList.data.nextPageToken)
      return collectionStatus(invitationList.data.items.length)
    }
    if (screen === "domains") {
      const result = await options.adapter.domainList(organizationId, { pageToken: pageToken() })
      if (!result.success) return fail(result)
      domains.set([...result.data.items])
      nextPageToken.set(result.data.nextPageToken)
      return collectionStatus(result.data.items.length)
    }
    if (screen === "branding") {
      const result = await options.adapter.brandingGet(organizationId)
      if (!result.success) return fail(result)
      branding.set(result.data.branding)
      return status.set("ready")
    }
    const [policyResult, providerList] = await Promise.all([
      options.adapter.loginPolicyGet(organizationId),
      options.adapter.providerList(organizationId.length === 0 ? undefined : organizationId),
    ])
    if (!policyResult.success) return fail(policyResult)
    if (!providerList.success) return fail(providerList)
    policy.set(policyResult.data.policy)
    overrides.set(policyResult.data.overrides)
    providers.set([...providerList.data.items])
    status.set("ready")
  }

  const mutate = async <T>(id: string, operation: () => Promise<Result<T>>) => {
    pendingId.set(id)
    error.set(undefined)
    notice.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (!result.success) {
      fail(result)
      return undefined
    }
    return result.data
  }

  createEffect(
    on(
      () => `${options.screen()}:${options.organizationId()}:${pageToken() ?? ""}`,
      () => {
        invitationToken.set(undefined)
        void load()
      },
    ),
  )

  return {
    branding: branding.get,
    brandingSave: async (next: OrganizationBranding) => {
      const saved = await mutate("branding", () => options.adapter.brandingSet(options.organizationId(), next))
      if (saved === undefined) return
      branding.set(saved.branding)
      notice.set("branding-saved")
      status.set("ready")
    },
    domainDiscover: (domain: string) => mutate("domain:discover", () => options.adapter.domainDiscover(domain)),
    domainClaim: async (domain: string, isPrimary: boolean) => {
      const claimed = await mutate("domain:claim", () =>
        options.adapter.domainClaim(options.organizationId(), { domain, isPrimary }),
      )
      if (claimed === undefined) return
      notice.set("domain-claimed")
      await load()
    },
    domainRemove: async (domain: string) => {
      if (!confirm(`Remove the domain ${domain}? Organization discovery for it stops immediately.`)) return
      const removed = await mutate(`domain:${domain}`, () =>
        options.adapter.domainRemove(options.organizationId(), domain),
      )
      if (removed === undefined) return
      domains.set(domains.get().filter((item) => item.domain !== domain))
      notice.set("domain-removed")
      collectionStatus(domains.get().length)
    },
    domains: domains.get,
    domainVerify: async (domain: string) => {
      const verified = await mutate(`domain:${domain}`, () =>
        options.adapter.domainVerify(options.organizationId(), domain),
      )
      if (verified === undefined) return
      notice.set("domain-verified")
      await load()
    },
    error: error.get,
    invitationCreate: async (email: string, invitationRoles: readonly OrganizationRoleId[]) => {
      const created = await mutate("invitation:create", () =>
        options.adapter.invitationCreate(options.organizationId(), { email, roles: [...invitationRoles] }),
      )
      if (created === undefined) return
      invitationToken.set(created.token)
      notice.set("invitation-created")
      await load()
    },
    invitationRevoke: async (invitationId: string, email: string) => {
      if (!confirm(`Revoke the invitation for ${email}? The invitation link stops working immediately.`)) return
      const revoked = await mutate(`invitation:${invitationId}`, () =>
        options.adapter.invitationRevoke(options.organizationId(), invitationId),
      )
      if (revoked === undefined) return
      notice.set("invitation-revoked")
      await load()
    },
    invitations: invitations.get,
    invitationToken: invitationToken.get,
    invitationTokenDismiss: () => invitationToken.set(undefined),
    memberships: memberships.get,
    membershipAdd: async (userId: string, membershipRoles: readonly OrganizationRoleId[]) => {
      const created = await mutate("membership:create", () =>
        options.adapter.membershipCreate(options.organizationId(), { roles: [...membershipRoles], userId }),
      )
      if (created === undefined) return
      notice.set("membership-added")
      await load()
    },
    membershipRemove: async (membershipId: string, userId: string) => {
      if (!confirm(`Remove ${userId} from this organization? Their organization access ends immediately.`)) return
      const removed = await mutate(`membership:${membershipId}`, () =>
        options.adapter.membershipRemove(options.organizationId(), membershipId),
      )
      if (removed === undefined) return
      memberships.set(memberships.get().filter((item) => item.id !== membershipId))
      notice.set("membership-removed")
      collectionStatus(memberships.get().length)
    },
    membershipRolesSet: async (membershipId: string, membershipRoles: readonly OrganizationRoleId[]) => {
      const updated = await mutate(`membership:${membershipId}`, () =>
        options.adapter.membershipUpdate(options.organizationId(), membershipId, { roles: [...membershipRoles] }),
      )
      if (updated === undefined) return
      memberships.set(memberships.get().map((item) => (item.id === membershipId ? updated.membership : item)))
      notice.set("membership-updated")
    },
    nextPageAvailable: () => nextPageToken.get() !== undefined,
    nextPageOpen: () => {
      const token = nextPageToken.get()
      if (token === undefined) return
      pageTokens.set([...pageTokens.get(), token])
    },
    notice: notice.get,
    organization: organization.get,
    organizationCreate: async (name: string) => {
      const created = await mutate("organization:create", () => options.adapter.organizationCreate({ name }))
      if (created === undefined) return undefined
      notice.set("organization-created")
      await load()
      return created.organization
    },
    organizationLifecycleSet: async (nextStatus: OrganizationStatus) => {
      const label = nextStatus === "removed" ? "Remove" : nextStatus === "inactive" ? "Deactivate" : "Reactivate"
      if (!confirm(`${label} this organization? Members lose access while it is not active.`)) return
      const updated = await mutate("organization:lifecycle", () =>
        options.adapter.organizationLifecycleSet(options.organizationId(), { status: nextStatus }),
      )
      if (updated === undefined) return
      organization.set(updated.organization)
      notice.set("organization-lifecycle")
    },
    organizationRename: async (name: string) => {
      const updated = await mutate("organization:rename", () =>
        options.adapter.organizationUpdate(options.organizationId(), { name }),
      )
      if (updated === undefined) return
      organization.set(updated.organization)
      notice.set("organization-renamed")
    },
    organizations: organizations.get,
    overrides: overrides.get,
    pageIndex: () => pageTokens.get().length,
    pendingId: pendingId.get,
    policy: policy.get,
    policySave: async (next: OrganizationLoginPolicyOverride) => {
      const saved = await mutate("policy", () => options.adapter.loginPolicySet(options.organizationId(), next))
      if (saved === undefined) return
      policy.set(saved.policy)
      overrides.set(saved.overrides)
      notice.set("policy-saved")
    },
    previousPageAvailable: () => pageTokens.get().length > 0,
    previousPageOpen: () => pageTokens.set(pageTokens.get().slice(0, -1)),
    providerCreate: async (input: {
      readonly allowAccountCreation: boolean
      readonly clientId: string
      readonly clientSecret: string
      readonly displayName: string
      readonly redirectUri: string
      readonly type: ExternalIdentityProviderType
    }) => {
      const organizationId = options.organizationId()
      const created = await mutate("provider:create", () =>
        options.adapter.providerCreate({
          allowAccountCreation: input.allowAccountCreation,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          displayName: input.displayName,
          redirectUri: input.redirectUri,
          type: input.type,
          ...(organizationId.length === 0 ? {} : { organizationId }),
        }),
      )
      if (created === undefined) return
      notice.set("provider-created")
      await load()
    },
    providerDisable: async (providerId: string, displayName: string) => {
      if (!confirm(`Disable ${displayName}? People can no longer sign in with this provider.`)) return
      const disabled = await mutate(`provider:${providerId}`, () => options.adapter.providerDisable(providerId))
      if (disabled === undefined) return
      providers.set(providers.get().map((item) => (item.id === providerId ? disabled.provider : item)))
      notice.set("provider-disabled")
    },
    providers: providers.get,
    providerSecretRotate: async (providerId: string, clientSecret: string) => {
      const rotated = await mutate(`provider:${providerId}`, () =>
        options.adapter.providerUpdate(providerId, { clientSecret }),
      )
      if (rotated === undefined) return
      providers.set(providers.get().map((item) => (item.id === providerId ? rotated.provider : item)))
      notice.set("provider-secret-rotated")
    },
    providerUpdate: async (providerId: string, input: { readonly displayName: string; readonly enabled: boolean }) => {
      const updated = await mutate(`provider:${providerId}`, () => options.adapter.providerUpdate(providerId, input))
      if (updated === undefined) return
      providers.set(providers.get().map((item) => (item.id === providerId ? updated.provider : item)))
      notice.set("provider-updated")
    },
    reload: () => void load(),
    roles: roles.get,
    screen: options.screen,
    status: status.get,
  }
}
