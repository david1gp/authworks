import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import { organizationBrandingDefaultCreate } from "../domain/organizationBrandingDefaultCreate.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationDomain } from "../public/organizationDomainSchema.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { OrganizationListQuery } from "../public/organizationListQuerySchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import type { OrganizationRole } from "../public/organizationRoleSchema.js"
import type { Organization } from "../public/organizationSchema.js"
import type { OrganizationStatus } from "../public/organizationStatusSchema.js"
import { passwordPolicyDefaults } from "../../passwords/domain/passwordPolicyDefaults.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"
import type { PasswordPolicySetRequest } from "../../passwords/public/passwordPolicySetRequestSchema.js"
import type { OrganizationAdminAdapter } from "./organizationAdminAdapter.js"
import { organizationAdminFailureStatusSelect } from "./organizationAdminFailureStatusSelect.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

const emptyPolicy: OrganizationLoginPolicy = {
  allowDomainDiscovery: true,
  allowEmailOtp: true,
  allowExternalIdentity: true,
  allowExternalIdentityAutoLinking: true,
  allowPasskey: true,
  allowPassword: true,
  allowPasswordRecovery: true,
  allowRegistration: true,
  providerIds: null,
  requiredMfa: false,
  allowedFactors: ["passkey", "totp", "email_otp"],
  preferredFactorOrder: ["passkey", "totp", "email_otp"],
  minimumStepUpAssurance: "authenticated",
}

/**
 * Shared, adapter-agnostic behaviour for every organization administration page: loading,
 * pagination, mutation, one-time invitation tokens, and destructive confirmation handling.
 */
export function organizationAdminPageStateCreate(options: {
  readonly adapter: OrganizationAdminAdapter
  readonly confirm?: (message: string) => boolean | Promise<boolean>
  readonly initialInvitationToken?: () => string | undefined
  readonly listSearch?: () => string
  readonly listStatus?: () => OrganizationListQuery["status"]
  readonly onInvitationTokenDismiss?: () => void
  readonly organizationId: () => string
  readonly reloadKey?: () => string
  readonly screen: () => OrganizationAdminScreen
}) {
  // Every destructive guard awaits the shared in-app prompt. Without a wired prompt the
  // guard declines, so an unwired screen can never destroy anything silently.
  const confirmed = async (message: string) => (await options.confirm?.(message)) === true
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
  const realmPolicy = createSignalObject<OrganizationLoginPolicy>(emptyPolicy)
  const overrides = createSignalObject<OrganizationLoginPolicyOverride>({})
  const passwordPolicy = createSignalObject<PasswordPolicy>({ ...passwordPolicyDefaults })
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<string[]>([])
  const invitationToken = createSignalObject<string | undefined>(options.initialInvitationToken?.())

  const fail = (failure: { code?: string; errorMessage: string; statusCode?: number }) => {
    error.set(failure.errorMessage)
    status.set(organizationAdminFailureStatusSelect(failure))
  }
  const configurationUnavailableNoticeSet = () => {
    if (notice.get() === undefined) notice.set("configuration-partial")
  }
  // Partial-failure helper for the configuration screen. Essential reads fail the page;
  // non-essential reads (realm default policy, provider list) degrade to empty data with a
  // section-level notice. The supplemental result runs outside the essential await chain so a
  // slow or failing optional read can never delay or break the page.
  const configurationSupplementalLoad = (configurationId: string) => {
    void Promise.all([options.adapter.loginPolicyGet(""), options.adapter.providerList(configurationId)]).then(
      ([realmPolicyResult, providerList]) => {
        if (!realmPolicyResult.success || !providerList.success) {
          providers.set(providerList.success ? [...providerList.data.items] : [])
          configurationUnavailableNoticeSet()
          return
        }
        realmPolicy.set(realmPolicyResult.data.policy)
        providers.set([...providerList.data.items])
      },
    )
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
      const search = options.listSearch?.().trim() ?? ""
      const token = pageToken()
      const result = await options.adapter.organizationList({
        ...(search.length === 0 ? {} : { search }),
        ...(options.listStatus?.() === undefined ? {} : { status: options.listStatus?.() }),
        ...(token === undefined ? {} : { pageToken: token }),
      })
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
    if (screen === "configuration") {
      const configurationId = options.organizationId()
      if (configurationId.length === 0) {
        error.set(messageTranslate("admin.common.permission"))
        return status.set("error")
      }
      const [detail, brandingResult, policyResult, domainList] = await Promise.all([
        options.adapter.organizationGet(configurationId),
        options.adapter.brandingGet(configurationId),
        options.adapter.loginPolicyGet(configurationId),
        options.adapter.domainList(configurationId),
      ])
      if (!detail.success) return fail(detail)
      if (!brandingResult.success) return fail(brandingResult)
      if (!policyResult.success) return fail(policyResult)
      if (!domainList.success) return fail(domainList)
      organization.set(detail.data.organization)
      branding.set(brandingResult.data.branding)
      policy.set(policyResult.data.policy)
      overrides.set(policyResult.data.overrides)
      domains.set([...domainList.data.items])
      nextPageToken.set(domainList.data.nextPageToken)
      configurationSupplementalLoad(configurationId)
      return status.set("ready")
    }
    if (screen === "login-policy") {
      const realmScope = organizationId.length === 0
      const [policyResult, realmPolicyResult, providerList, passwordPolicyResult] = await Promise.all([
        options.adapter.loginPolicyGet(organizationId),
        realmScope ? options.adapter.loginPolicyGet(organizationId) : options.adapter.loginPolicyGet(""),
        options.adapter.providerList(realmScope ? undefined : organizationId),
        realmScope ? options.adapter.passwordPolicyGet() : Promise.resolve(undefined),
      ])
      if (!policyResult.success) return fail(policyResult)
      if (!realmPolicyResult.success) return fail(realmPolicyResult)
      if (passwordPolicyResult !== undefined) {
        if (!passwordPolicyResult.success) return fail(passwordPolicyResult)
        passwordPolicy.set(passwordPolicyResult.data.policy)
      }
      if (!providerList.success) {
        policy.set(policyResult.data.policy)
        realmPolicy.set(realmPolicyResult.data.policy)
        overrides.set(policyResult.data.overrides)
        providers.set([])
        configurationUnavailableNoticeSet()
        return status.set("ready")
      }
      policy.set(policyResult.data.policy)
      realmPolicy.set(realmPolicyResult.data.policy)
      overrides.set(policyResult.data.overrides)
      providers.set([...providerList.data.items])
      return status.set("ready")
    }
    error.set(messageTranslate("admin.common.permission"))
    return status.set("error")
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

  // A new search or status filter always restarts from the first page; otherwise the
  // cursor of the previous filter would page through the new result set.
  const listSignature = () => `${options.listSearch?.() ?? ""}:${options.listStatus?.() ?? ""}`
  const appliedListSignature = createSignalObject("")
  createEffect(
    on(
      () =>
        `${options.screen()}:${options.organizationId()}:${pageToken() ?? ""}:${options.reloadKey?.() ?? ""}:${listSignature()}`,
      () => {
        if (options.screen() === "organizations" && appliedListSignature.get() !== listSignature()) {
          appliedListSignature.set(listSignature())
          if (pageTokens.get().length > 0) {
            pageTokens.set([])
            return
          }
        }
        invitationToken.set(options.initialInvitationToken?.())
        void load()
      },
    ),
  )

  return {
    branding: branding.get,
    brandingSave: async (next: OrganizationBranding) => {
      const saved = await mutate("branding", () => options.adapter.brandingSet(options.organizationId(), next))
      if (saved === undefined) return false
      branding.set(saved.branding)
      notice.set("branding-saved")
      status.set("ready")
      return true
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
      if (!(await confirmed(messageTranslate("admin.organizations.domains.removeConfirm", { domain })))) return
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
      await load()
      notice.set("invitation-created")
    },
    invitationRevoke: async (invitationId: string, email: string) => {
      if (!(await confirmed(messageTranslate("admin.organizations.invitations.revokeConfirm", { email })))) return
      const revoked = await mutate(`invitation:${invitationId}`, () =>
        options.adapter.invitationRevoke(options.organizationId(), invitationId),
      )
      if (revoked === undefined) return
      notice.set("invitation-revoked")
      await load()
    },
    invitations: invitations.get,
    invitationToken: invitationToken.get,
    invitationTokenDismiss: () => {
      options.onInvitationTokenDismiss?.()
      invitationToken.set(undefined)
    },
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
      if (!(await confirmed(messageTranslate("admin.organizations.memberships.removeConfirm", { userId })))) return
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
    organizationId: options.organizationId,
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
      const confirmKey =
        nextStatus === "removed"
          ? "admin.organizations.lifecycle.removeConfirm"
          : nextStatus === "inactive"
            ? "admin.organizations.lifecycle.deactivateConfirm"
            : "admin.organizations.lifecycle.activateConfirm"
      if (!(await confirmed(messageTranslate(confirmKey)))) return
      const updated = await mutate("organization:lifecycle", () =>
        options.adapter.organizationLifecycleSet(options.organizationId(), { status: nextStatus }),
      )
      if (updated === undefined) return
      organization.set({ ...updated.organization })
      notice.set("organization-lifecycle")
    },
    organizationRename: async (name: string) => {
      const updated = await mutate("organization:rename", () =>
        options.adapter.organizationUpdate(options.organizationId(), { name }),
      )
      if (updated === undefined) return
      organization.set({ ...updated.organization })
      notice.set("organization-renamed")
    },
    organizations: organizations.get,
    overrides: overrides.get,
    pageIndex: () => pageTokens.get().length,
    passwordPolicy: passwordPolicy.get,
    passwordPolicySave: async (input: PasswordPolicySetRequest) => {
      const saved = await mutate("password-policy", () => options.adapter.passwordPolicySet(input))
      if (saved === undefined) return false
      passwordPolicy.set(saved.policy)
      notice.set("password-policy-saved")
      return true
    },
    pendingId: pendingId.get,
    policy: policy.get,
    policyScope: () => (options.organizationId().length === 0 ? "realm" : "organization"),
    policySave: async (next: OrganizationLoginPolicyOverride) => {
      const saved = await mutate("policy", () => options.adapter.loginPolicySet(options.organizationId(), next))
      if (saved === undefined) return false
      policy.set(saved.policy)
      if (options.organizationId().length === 0) realmPolicy.set(saved.policy)
      overrides.set(saved.overrides)
      notice.set("policy-saved")
      return true
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
      if (!(await confirmed(messageTranslate("admin.organizations.providers.disableConfirm", { displayName })))) return
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
    realmPolicy: realmPolicy.get,
    roles: roles.get,
    screen: options.screen,
    status: status.get,
  }
}
