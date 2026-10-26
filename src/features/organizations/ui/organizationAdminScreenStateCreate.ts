import { useLocation, useNavigate } from "@solidjs/router"
import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedUrlSearchParamWrite } from "../../../ui/authenticated/authenticatedUrlSearchParamWrite.js"
import type { ConfirmState } from "../../../ui/confirm/confirmStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationBrandingTheme } from "../public/organizationBrandingThemeSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import { organizationAdminFormStateCreate } from "./organizationAdminFormStateCreate.js"
import { organizationAdminListSearchSelect } from "./organizationAdminListSearchSelect.js"
import { organizationAdminListStatusSelect } from "./organizationAdminListStatusSelect.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import { organizationAdminPasswordPolicyValidate } from "./organizationAdminPasswordPolicyValidate.js"
import { organizationAdminPolicyLifetimeValidate } from "./organizationAdminPolicyLifetimeValidate.js"
import { organizationAdminSecurityPolicyDraftCreate } from "./organizationAdminSecurityPolicyDraftCreate.js"

type PolicyKey = keyof Omit<
  OrganizationLoginPolicy,
  | "allowedFactors"
  | "minimumStepUpAssurance"
  | "mfaInitSkipLifetimeSeconds"
  | "multiFactorCheckLifetimeSeconds"
  | "preferredFactorOrder"
  | "providerIds"
  | "requiredMfa"
  | "secondFactorCheckLifetimeSeconds"
  | "sessionLifetimeSeconds"
>

type PolicyMfaLifetimeKey =
  | "mfaInitSkipLifetimeSeconds"
  | "secondFactorCheckLifetimeSeconds"
  | "multiFactorCheckLifetimeSeconds"

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
  const policyValidationMessage = createSignalObject<string | undefined>(undefined)
  const passwordPolicyDraftSignal = createSignalObject<PasswordPolicy | undefined>(undefined)
  const passwordPolicyValidationMessage = createSignalObject<string | undefined>(undefined)

  const createOpen = () => new URLSearchParams(location.search).get("create") === "organization"
  const createOpenSet = (open: boolean) => {
    const params = new URLSearchParams(location.search)
    if (open) params.set("create", "organization")
    else params.delete("create")
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true })
    form.validationMessage.set(undefined)
  }
  // Search and status live in the URL so the server-filtered directory survives reloads
  // and deep links. Writes are debounced, so every keystroke never becomes a request.
  const search = () => organizationAdminListSearchSelect(location.search)
  const searchSet = (value: string) => authenticatedUrlSearchParamWrite("q", value)
  const statusFilter = () => organizationAdminListStatusSelect(location.search)
  const statusFilterSet = (value: string) => authenticatedUrlSearchParamWrite("status", value)
  const branding = () => form.branding.get() ?? options.page.branding()
  const policyDraft = () => policyDraftSignal.get() ?? options.page.policy()
  const passwordPolicyDraft = () => passwordPolicyDraftSignal.get() ?? options.page.passwordPolicy()
  const passwordPolicyLockoutMinutes = () => Math.round(passwordPolicyDraft().lockoutDurationMs / 60_000)
  const brandingUpdate = (next: OrganizationBranding) => {
    form.branding.set(next)
    form.brandingLocalWrite(options.page.organizationId(), next)
  }
  const themeUpdate = (theme: ThemeKey, patch: Partial<OrganizationBrandingTheme>) =>
    brandingUpdate({ ...branding(), [theme]: { ...branding()[theme], ...patch } })
  const policyScope = () => (options.page.policyScope() === "realm" ? "realm" : "organization")
  const securityPolicy = organizationAdminSecurityPolicyDraftCreate({
    effectivePolicy: options.page.policy,
    overrides: options.page.overrides,
    realmPolicy: options.page.realmPolicy,
    scope: policyScope,
  })

  createEffect(on(options.page.organization, (organization) => form.detailName.set(organization?.name ?? "")))
  createEffect(
    on(options.page.branding, (loaded) => {
      if (options.page.status() !== "ready") return
      const stored = form.brandingLocalGet(options.page.organizationId())
      form.branding.set(stored ?? loaded)
    }),
  )
  createEffect(
    on(options.page.policy, (loaded) => {
      if (options.page.status() === "ready") policyDraftSignal.set(loaded)
    }),
  )
  createEffect(
    on(options.page.passwordPolicy, (loaded) => {
      if (options.page.status() === "ready") passwordPolicyDraftSignal.set(loaded)
    }),
  )

  return {
    basePath: () => options.basePath,
    branding,
    brandingLegalUrlSet: (key: "privacyUrl" | "termsUrl", value: string) =>
      brandingUpdate({
        ...branding(),
        legal: { ...branding().legal, [key]: value.length === 0 ? undefined : value },
      }),
    brandingSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      void (async () => {
        const saved = await options.page.brandingSave(branding())
        if (saved) form.brandingLocalClear(options.page.organizationId())
      })()
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
    machineCredentialsHref: () => `${options.basePath}/machine-credentials`,
    machinesHref: () => `${options.basePath}/machine-users`,
    page: options.page,
    policyLifetimeSet: (key: PolicyMfaLifetimeKey, rawValue: string) => {
      if (rawValue.trim().length === 0) {
        policyDraftSignal.set({ ...policyDraft(), [key]: null })
        return
      }
      policyDraftSignal.set({ ...policyDraft(), [key]: Math.trunc(Number(rawValue)) })
    },
    policyLifetimeValidate: () => organizationAdminPolicyLifetimeValidate(policyDraft()),
    policyProviderAllowlistReset: () => policyDraftSignal.set({ ...policyDraft(), providerIds: null }),
    policyProviderAllowlistToggle: (providerId: string) => {
      const draft = policyDraft()
      const configured = options.page.providers().map((provider) => provider.id)
      const selected = new Set(draft.providerIds ?? configured)
      if (selected.has(providerId)) selected.delete(providerId)
      else selected.add(providerId)
      const next = configured.filter((id) => selected.has(id))
      policyDraftSignal.set({
        ...draft,
        providerIds: next.length === configured.length ? null : next,
      })
    },
    policySessionLifetimeSet: (rawValue: string) => {
      if (rawValue.trim().length === 0) {
        policyDraftSignal.set({ ...policyDraft(), sessionLifetimeSeconds: undefined })
        return
      }
      policyDraftSignal.set({ ...policyDraft(), sessionLifetimeSeconds: Math.trunc(Number(rawValue)) })
    },
    policySubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const lifetimeKey = organizationAdminPolicyLifetimeValidate(policyDraft())
      policyValidationMessage.set(lifetimeKey === undefined ? undefined : messageTranslate(lifetimeKey))
      if (lifetimeKey !== undefined) return
      const validationKey = securityPolicy.validationKey()
      policyValidationMessage.set(validationKey === undefined ? undefined : messageTranslate(validationKey))
      if (validationKey !== undefined) return
      const draft = policyDraft()
      void (async () => {
        const saved = await options.page.policySave({
          allowDomainDiscovery: draft.allowDomainDiscovery,
          allowEmailOtp: draft.allowEmailOtp,
          allowExternalIdentity: draft.allowExternalIdentity,
          allowExternalIdentityAutoLinking: draft.allowExternalIdentityAutoLinking,
          allowPasskey: draft.allowPasskey,
          allowPassword: draft.allowPassword,
          allowPasswordRecovery: draft.allowPasswordRecovery,
          allowRegistration: draft.allowRegistration,
          allowWhatsappOtp: draft.allowWhatsappOtp,
          forceMfaLocalOnly: draft.forceMfaLocalOnly,
          mfaInitSkipLifetimeSeconds: draft.mfaInitSkipLifetimeSeconds,
          multiFactorCheckLifetimeSeconds: draft.multiFactorCheckLifetimeSeconds,
          providerIds: draft.providerIds,
          secondFactorCheckLifetimeSeconds: draft.secondFactorCheckLifetimeSeconds,
          sessionLifetimeSeconds: draft.sessionLifetimeSeconds,
          ...securityPolicy.draft(),
        })
        if (!saved) return
        securityPolicy.draftReset()
      })()
    },
    policyDraft,
    policyScope,
    policyToggle: (key: PolicyKey) => policyDraftSignal.set({ ...policyDraft(), [key]: !policyDraft()[key] }),
    policyValidationMessage: policyValidationMessage.get,
    passwordPolicyDraft,
    passwordPolicyLockoutMinutes,
    passwordPolicyLockoutMinutesSet: (minutes: number) =>
      passwordPolicyDraftSignal.set({
        ...passwordPolicyDraft(),
        lockoutDurationMs: Math.round(minutes * 60_000),
      }),
    passwordPolicyMaximumAttemptsSet: (value: number) =>
      passwordPolicyDraftSignal.set({ ...passwordPolicyDraft(), maximumAttempts: Math.trunc(value) }),
    passwordPolicyMinimumLengthSet: (value: number) =>
      passwordPolicyDraftSignal.set({ ...passwordPolicyDraft(), minimumLength: Math.trunc(value) }),
    passwordPolicySubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const validationKey = organizationAdminPasswordPolicyValidate(passwordPolicyDraft())
      passwordPolicyValidationMessage.set(validationKey === undefined ? undefined : messageTranslate(validationKey))
      if (validationKey !== undefined) return
      void options.page.passwordPolicySave({ ...passwordPolicyDraft() })
    },
    passwordPolicyToggle: (key: "requireLowercase" | "requireNumber" | "requireSymbol" | "requireUppercase") =>
      passwordPolicyDraftSignal.set({ ...passwordPolicyDraft(), [key]: !passwordPolicyDraft()[key] }),
    passwordPolicyValidationMessage: passwordPolicyValidationMessage.get,
    providerAccountCreationToggle: () =>
      form.providerCreate.set({
        ...form.providerCreate.get(),
        allowAccountCreation: !form.providerCreate.get().allowAccountCreation,
      }),
    providerCreateInput: (
      key: "clientId" | "clientSecret" | "displayName" | "issuer" | "redirectUri" | "scopesText",
      value: string,
    ) => form.providerCreate.set({ ...form.providerCreate.get(), [key]: value }),
    providerCreateSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (!form.validateProviderCreate()) return
      const request = form.providerCreateRequest()
      if (request === undefined) return
      void options.page.providerCreate(request)
      form.providerCreate.set({ ...form.providerCreate.get(), clientSecret: "" })
    },
    providerCreateTypeSet: (value: ExternalIdentityProviderType) =>
      form.providerCreate.set({ ...form.providerCreate.get(), type: value }),
    providerEnabledToggle: (provider: ExternalIdentityProvider) =>
      void options.page.providerUpdate(provider.id, {
        displayName: provider.displayName,
        enabled: !provider.enabled,
      }),
    providerEditBegin: (provider: ExternalIdentityProvider) => form.providerEditBegin(provider),
    providerEditInput: (
      provider: ExternalIdentityProvider,
      key: "clientId" | "displayName" | "issuer" | "redirectUri" | "scopesText",
      value: string,
    ) => form.providerEditInput(provider, key, value),
    providerEditReset: (providerId: string) => form.providerEditClear(providerId),
    providerEditSubmit: (provider: ExternalIdentityProvider) => {
      if (!form.validateProviderEdit(provider)) return
      const request = form.providerEditRequest(provider)
      if (request === undefined) return
      void (async () => {
        const saved = await options.page.providerUpdate(provider.id, request)
        if (!saved) return
        form.providerEditClear(provider.id)
      })()
    },
    metadataKeySet: (value: string) => form.metadataKey.set(value),
    metadataRemove: (key: string) => {
      void options.page.metadataRemove(key)
    },
    metadataSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (!form.validateMetadata()) return
      const key = form.metadataKey.get().trim()
      const value = form.metadataValue.get()
      void (async () => {
        const saved = await options.page.metadataSet(key, value)
        if (!saved) return
        form.metadataKey.set("")
        form.metadataValue.set("")
      })()
    },
    metadataValueSet: (value: string) => form.metadataValue.set(value),
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
    search,
    searchSet,
    securityPolicy,
    statusFilter,
    statusFilterSet,
  }
}
