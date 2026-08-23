import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { externalIdentityProviderCreateRequestSchema } from "../../externalIdentities/public/externalIdentityProviderCreateRequestSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
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
  }
}
