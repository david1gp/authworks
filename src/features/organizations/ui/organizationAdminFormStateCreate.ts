import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { externalIdentityProviderCreateRequestSchema } from "../../externalIdentities/public/externalIdentityProviderCreateRequestSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import { type OrganizationBranding, organizationBrandingSchema } from "../public/organizationBrandingSchema.js"
import { organizationCreateRequestSchema } from "../public/organizationCreateRequestSchema.js"
import { organizationDomainClaimRequestSchema } from "../public/organizationDomainClaimRequestSchema.js"
import { organizationInvitationCreateRequestSchema } from "../public/organizationInvitationCreateRequestSchema.js"
import { organizationMembershipCreateRequestSchema } from "../public/organizationMembershipCreateRequestSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"

const emailSchema = v.pipe(v.string(), v.email())

/** Owns the local form input and client-side validation shared by both administration adapters. */
export function organizationAdminFormStateCreate() {
  const createName = createSignalObject("")
  const detailName = createSignalObject("")
  const search = createSignalObject("")
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const membershipUserId = createSignalObject("")
  const membershipRoles = createSignalObject<OrganizationRoleId[]>(["member"])
  const invitationEmail = createSignalObject("")
  const invitationRoles = createSignalObject<OrganizationRoleId[]>(["member"])
  const claimDomain = createSignalObject("")
  const claimPrimary = createSignalObject(false)
  const discoveryDomain = createSignalObject("")
  const discoveryMessage = createSignalObject<string | undefined>(undefined)
  const branding = createSignalObject<OrganizationBranding | undefined>(undefined)
  const providerSecrets = createSignalObject<Record<string, string>>({})
  const providerCreate = createSignalObject({
    allowAccountCreation: false,
    clientId: "",
    clientSecret: "",
    displayName: "",
    redirectUri: "",
    type: "google" as ExternalIdentityProviderType,
  })

  const rolesToggle = (
    signal: { get: () => OrganizationRoleId[]; set: (value: OrganizationRoleId[]) => void },
    role: OrganizationRoleId,
  ) => {
    const current = signal.get()
    signal.set(current.includes(role) ? current.filter((item) => item !== role) : [...current, role])
  }
  const invalid = (key: MessageKey) => {
    validationMessage.set(messageTranslate(key))
    return false
  }
  const valid = () => {
    validationMessage.set(undefined)
    return true
  }

  const brandingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const brandingIdleWrite = (organizationId: string, value: OrganizationBranding) => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return
    try {
      window.localStorage.setItem(`authworks.admin.branding.${organizationId}`, JSON.stringify(value))
    } catch {
      // Browsers may block storage; the form simply stays memory-only.
    }
  }
  const brandingLocalWrite = (organizationId: string, value: OrganizationBranding) => {
    const pending = brandingTimers.get(organizationId)
    if (pending !== undefined) clearTimeout(pending)
    brandingTimers.set(
      organizationId,
      setTimeout(() => {
        brandingTimers.delete(organizationId)
        if (typeof window === "undefined") return
        const idle = (
          window as unknown as {
            requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => void
          }
        ).requestIdleCallback
        if (typeof idle === "function") idle(() => brandingIdleWrite(organizationId, value), { timeout: 400 })
        else brandingIdleWrite(organizationId, value)
      }, 250),
    )
  }
  const brandingLocalGet = (organizationId: string): OrganizationBranding | undefined => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return undefined
    try {
      const raw = window.localStorage.getItem(`authworks.admin.branding.${organizationId}`)
      if (raw === null) return undefined
      const parsed = v.safeParse(organizationBrandingSchema, JSON.parse(raw))
      return parsed.success ? parsed.output : undefined
    } catch {
      return undefined
    }
  }
  const brandingLocalFlush = () => {
    for (const [pendingId, timer] of brandingTimers) {
      clearTimeout(timer)
      brandingTimers.delete(pendingId)
      const current = branding.get()
      if (current !== undefined) brandingIdleWrite(pendingId, current)
    }
  }
  const brandingLocalClear = (organizationId: string) => {
    const pending = brandingTimers.get(organizationId)
    if (pending !== undefined) {
      clearTimeout(pending)
      brandingTimers.delete(organizationId)
    }
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return
    try {
      window.localStorage.removeItem(`authworks.admin.branding.${organizationId}`)
    } catch {
      // Browsers may block storage; the draft simply stays until overwritten.
    }
  }

  return {
    branding,
    claimDomain,
    claimPrimary,
    createName,
    detailName,
    discoveryDomain,
    discoveryMessage,
    invitationEmail,
    invitationRoles,
    invitationRolesToggle: (role: OrganizationRoleId) => rolesToggle(invitationRoles, role),
    membershipRoles,
    membershipRolesToggle: (role: OrganizationRoleId) => rolesToggle(membershipRoles, role),
    membershipUserId,
    providerCreate,
    providerSecrets,
    providerSecretSet: (providerId: string, value: string) =>
      providerSecrets.set({ ...providerSecrets.get(), [providerId]: value }),
    search,
    validateDomainClaim: () =>
      v.safeParse(organizationDomainClaimRequestSchema, {
        domain: claimDomain.get(),
        isPrimary: claimPrimary.get(),
      }).success
        ? valid()
        : invalid("admin.organizations.domains.invalid"),
    validateInvitation: () =>
      !v.safeParse(emailSchema, invitationEmail.get()).success
        ? invalid("admin.organizations.invitations.emailInvalid")
        : v.safeParse(organizationInvitationCreateRequestSchema, {
              email: invitationEmail.get(),
              roles: invitationRoles.get(),
            }).success
          ? valid()
          : invalid("admin.organizations.invitations.rolesInvalid"),
    validateMembership: () =>
      v.safeParse(organizationMembershipCreateRequestSchema, {
        roles: membershipRoles.get(),
        userId: membershipUserId.get(),
      }).success
        ? valid()
        : invalid("admin.organizations.memberships.invalid"),
    validateOrganizationName: (name: string) =>
      v.safeParse(organizationCreateRequestSchema, { name }).success
        ? valid()
        : invalid("admin.organizations.list.nameRequired"),
    validateProviderCreate: () =>
      v.safeParse(externalIdentityProviderCreateRequestSchema, providerCreate.get()).success
        ? valid()
        : invalid("admin.organizations.providers.invalid"),
    validationMessage,
    brandingLocalClear,
    brandingLocalFlush,
    brandingLocalGet,
    brandingLocalWrite,
  }
}
