import { useLocation, useNavigate } from "@solidjs/router"
import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ConfirmState } from "../../../ui/confirm/confirmStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationBrandingTheme } from "../public/organizationBrandingThemeSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import { organizationAdminFormStateCreate } from "./organizationAdminFormStateCreate.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"

type PolicyKey = keyof Omit<OrganizationLoginPolicy, "providerIds">
type ThemeKey = "dark" | "light"
type ThemeColorKey = "backgroundColor" | "fontColor" | "primaryColor" | "warnColor"

/** Glues the adapter-driven page state to local form input, URL state, and route links. */
export function organizationAdminScreenStateCreate(options: {
  readonly basePath: string
  readonly confirmState: ConfirmState
  readonly page: ReturnType<typeof organizationAdminPageStateCreate>
}) {
  const form = organizationAdminFormStateCreate()
  const location = useLocation()
  const navigate = useNavigate()
  const policyDraftSignal = createSignalObject<OrganizationLoginPolicy | undefined>(undefined)

  const createOpen = () => new URLSearchParams(location.search).get("create") === "organization"
  const createOpenSet = (open: boolean) => {
    const params = new URLSearchParams(location.search)
    if (open) params.set("create", "organization")
    else params.delete("create")
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true })
    form.validationMessage.set(undefined)
  }
  const searchSet = (value: string) => {
    form.search.set(value)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (value) url.searchParams.set("q", value)
    else url.searchParams.delete("q")
    window.history.replaceState({}, "", url)
  }
  const branding = () => form.branding.get() ?? options.page.branding()
  const policyDraft = () => policyDraftSignal.get() ?? options.page.policy()
  const brandingUpdate = (next: OrganizationBranding) => form.branding.set(next)
  const themeUpdate = (theme: ThemeKey, patch: Partial<OrganizationBrandingTheme>) =>
    brandingUpdate({ ...branding(), [theme]: { ...branding()[theme], ...patch } })

  createEffect(on(options.page.organization, (organization) => form.detailName.set(organization?.name ?? "")))
  createEffect(
    on(options.page.branding, (loaded) => {
      if (options.page.status() === "ready") form.branding.set(loaded)
    }),
  )
  createEffect(
    on(options.page.policy, (loaded) => {
      if (options.page.status() === "ready") policyDraftSignal.set(loaded)
    }),
  )

  return {
    branding,
    brandingLegalUrlSet: (key: "privacyUrl" | "termsUrl", value: string) =>
      brandingUpdate({
        ...branding(),
        legal: { ...branding().legal, [key]: value.length === 0 ? undefined : value },
      }),
    brandingSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      void options.page.brandingSave(branding())
    },
    brandingThemeAssetSet: (theme: ThemeKey, key: "iconUrl" | "logoUrl", value: string) =>
      themeUpdate(theme, { [key]: value.length === 0 ? undefined : value }),
    brandingThemeColorSet: (theme: ThemeKey, key: ThemeColorKey, value: string) => themeUpdate(theme, { [key]: value }),
    brandingThemeModeSet: (value: "dark" | "light" | "system") => brandingUpdate({ ...branding(), themeMode: value }),
    brandingWatermarkToggle: () => brandingUpdate({ ...branding(), disableWatermark: !branding().disableWatermark }),
    confirmState: options.confirmState,
    createOpen,
    createOpenSet,
    detailHrefBuild: (organizationId: string) => `${options.basePath}/organizations/${organizationId}`,
    domainClaimSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (!form.validateDomainClaim()) return
      void options.page.domainClaim(form.claimDomain.get(), form.claimPrimary.get())
      form.claimDomain.set("")
      form.claimPrimary.set(false)
    },
    domainDiscoverySubmit: (event: SubmitEvent) => {
      event.preventDefault()
      form.discoveryMessage.set(undefined)
      void (async () => {
        const domain = form.discoveryDomain.get()
        const result = await options.page.domainDiscover(domain)
        if (result === undefined) return
        form.discoveryMessage.set(
          result.found
            ? messageTranslate("admin.organizations.domains.discoveryFound", {
                domain,
                organization: result.organization.name,
              })
            : messageTranslate("admin.organizations.domains.discoveryMissing", { domain }),
        )
      })()
    },
    filteredOrganizations: () => {
      const value = form.search.get().toLowerCase()
      if (!value) return options.page.organizations()
      return options.page
        .organizations()
        .filter((organization) => `${organization.name} ${organization.id}`.toLowerCase().includes(value))
    },
    form,
    invitationCreateSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (!form.validateInvitation()) return
      void options.page.invitationCreate(form.invitationEmail.get(), form.invitationRoles.get())
      form.invitationEmail.set("")
    },
    listHref: () => `${options.basePath}/organizations`,
    membershipAddSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (!form.validateMembership()) return
      void options.page.membershipAdd(form.membershipUserId.get(), form.membershipRoles.get())
      form.membershipUserId.set("")
    },
    membershipRoleToggle: (membership: OrganizationMembership, role: OrganizationRoleId) => {
      const next = membership.roles.includes(role)
        ? membership.roles.filter((item) => item !== role)
        : [...membership.roles, role]
      if (next.length === 0) return
      void options.page.membershipRolesSet(membership.id, next)
    },
    membershipsHref: () => `${options.basePath}/memberships`,
    page: options.page,
    policySubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const draft = policyDraft()
      void options.page.policySave({
        allowDomainDiscovery: draft.allowDomainDiscovery,
        allowEmailOtp: draft.allowEmailOtp,
        allowExternalIdentity: draft.allowExternalIdentity,
        allowPasskey: draft.allowPasskey,
        allowPassword: draft.allowPassword,
        allowPasswordRecovery: draft.allowPasswordRecovery,
        allowRegistration: draft.allowRegistration,
      })
    },
    policyDraft,
    policyToggle: (key: PolicyKey) => policyDraftSignal.set({ ...policyDraft(), [key]: !policyDraft()[key] }),
    providerAccountCreationToggle: () =>
      form.providerCreate.set({
        ...form.providerCreate.get(),
        allowAccountCreation: !form.providerCreate.get().allowAccountCreation,
      }),
    providerCreateInput: (key: "clientId" | "clientSecret" | "displayName" | "redirectUri", value: string) =>
      form.providerCreate.set({ ...form.providerCreate.get(), [key]: value }),
    providerCreateSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (!form.validateProviderCreate()) return
      void options.page.providerCreate(form.providerCreate.get())
      form.providerCreate.set({ ...form.providerCreate.get(), clientSecret: "" })
    },
    providerCreateTypeSet: (value: ExternalIdentityProviderType) =>
      form.providerCreate.set({ ...form.providerCreate.get(), type: value }),
    providerEnabledToggle: (provider: ExternalIdentityProvider) =>
      void options.page.providerUpdate(provider.id, {
        displayName: provider.displayName,
        enabled: !provider.enabled,
      }),
    providerSecretRotate: (providerId: string) => {
      const secret = form.providerSecrets.get()[providerId] ?? ""
      if (secret.length === 0) return
      void options.page.providerSecretRotate(providerId, secret)
      form.providerSecretSet(providerId, "")
    },
    organizationCreateSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const name = form.createName.get()
      if (!form.validateOrganizationName(name)) return
      void (async () => {
        const created = await options.page.organizationCreate(name)
        if (created === undefined) return
        form.createName.set("")
        createOpenSet(false)
      })()
    },
    organizationRenameSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const name = form.detailName.get()
      if (!form.validateOrganizationName(name)) return
      void options.page.organizationRename(name)
    },
    searchSet,
  }
}
