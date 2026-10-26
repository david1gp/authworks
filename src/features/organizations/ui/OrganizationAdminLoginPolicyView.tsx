import { mdiAutorenew } from "@adaptive-ds/mdi/mdiAutorenew.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { mdiToggleSwitch } from "@adaptive-ds/mdi/mdiToggleSwitch.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import { authenticatedNavigationLinkClassGet } from "../../../ui/authenticated/authenticatedNavigationLinkClassGet.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminPasswordPolicyView } from "./OrganizationAdminPasswordPolicyView.js"
import { OrganizationAdminSecurityPolicyView } from "./OrganizationAdminSecurityPolicyView.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminProviderEditDraft } from "./organizationAdminProviderEditRequestBuild.js"
import type { organizationAdminSecurityPolicyDraftCreate } from "./organizationAdminSecurityPolicyDraftCreate.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

type PolicyKey = keyof Omit<
  OrganizationLoginPolicy,
  | "allowedFactors"
  | "minimumStepUpAssurance"
  | "preferredFactorOrder"
  | "providerIds"
  | "requiredMfa"
  | "sessionLifetimeSeconds"
  | "mfaInitSkipLifetimeSeconds"
  | "secondFactorCheckLifetimeSeconds"
  | "multiFactorCheckLifetimeSeconds"
>

type PolicyMfaLifetimeKey =
  | "mfaInitSkipLifetimeSeconds"
  | "secondFactorCheckLifetimeSeconds"
  | "multiFactorCheckLifetimeSeconds"

const policyFields: readonly { key: PolicyKey; labelKey: MessageKey }[] = [
  { key: "allowPassword", labelKey: "admin.organizations.policy.password" },
  { key: "allowPasswordRecovery", labelKey: "admin.organizations.policy.passwordRecovery" },
  { key: "allowPasskey", labelKey: "admin.organizations.policy.passkey" },
  { key: "allowEmailOtp", labelKey: "admin.organizations.policy.emailOtp" },
  { key: "allowWhatsappOtp", labelKey: "admin.organizations.policy.whatsappOtp" },
  { key: "allowExternalIdentity", labelKey: "admin.organizations.policy.externalIdentity" },
  { key: "allowExternalIdentityAutoLinking", labelKey: "admin.organizations.policy.autoLinking" },
  { key: "forceMfaLocalOnly", labelKey: "admin.organizations.policy.forceMfaLocalOnly" },
  { key: "allowRegistration", labelKey: "admin.organizations.policy.registration" },
  { key: "allowDomainDiscovery", labelKey: "admin.organizations.policy.domainDiscovery" },
]

const policyMfaLifetimeFields: readonly { key: PolicyMfaLifetimeKey; labelKey: MessageKey }[] = [
  { key: "mfaInitSkipLifetimeSeconds", labelKey: "admin.organizations.policy.mfaInitSkipLifetime" },
  { key: "secondFactorCheckLifetimeSeconds", labelKey: "admin.organizations.policy.secondFactorLifetime" },
  { key: "multiFactorCheckLifetimeSeconds", labelKey: "admin.organizations.policy.multiFactorLifetime" },
]

const providerTypes: readonly ExternalIdentityProviderType[] = ["google", "github", "microsoft", "oidc"]

function OrganizationAdminPolicyInheritedBadge(props: { readonly show: boolean }) {
  return (
    <Show when={props.show}>
      <span class="col-start-2">
        <AuthenticatedStatus label={messageTranslate("admin.organizations.policy.inherited")} tone="neutral" />
      </span>
    </Show>
  )
}

export function OrganizationAdminLoginPolicyView(props: {
  readonly error?: string
  readonly notice?: string
  readonly onMfaLifetimeInput: (key: PolicyMfaLifetimeKey, value: string) => void
  readonly onPasswordPolicyLockoutMinutesInput: (minutes: number) => void
  readonly onPasswordPolicyMaximumAttemptsInput: (value: number) => void
  readonly onPasswordPolicyMinimumLengthInput: (value: number) => void
  readonly onPasswordPolicySubmit: (event: SubmitEvent) => void
  readonly onPasswordPolicyToggle: (
    key: "requireLowercase" | "requireNumber" | "requireSymbol" | "requireUppercase",
  ) => void
  readonly onPolicySubmit: (event: SubmitEvent) => void
  readonly onPolicyToggle: (key: PolicyKey) => void
  readonly onProviderAllowlistReset: () => void
  readonly onProviderAllowlistToggle: (providerId: string) => void
  readonly onProviderCreateInput: (
    key: "clientId" | "clientSecret" | "displayName" | "issuer" | "redirectUri" | "scopesText",
    value: string,
  ) => void
  readonly onProviderCreateSubmit: (event: SubmitEvent) => void
  readonly onProviderCreateTypeInput: (value: ExternalIdentityProviderType) => void
  readonly onProviderAccountCreationToggle: () => void
  readonly onProviderDisable: (providerId: string, displayName: string) => void
  readonly onProviderEditInput: (
    provider: ExternalIdentityProvider,
    key: "clientId" | "displayName" | "issuer" | "redirectUri" | "scopesText",
    value: string,
  ) => void
  readonly onProviderEditReset: (providerId: string) => void
  readonly onProviderEditSubmit: (provider: ExternalIdentityProvider) => void
  readonly onProviderEnabledToggle: (provider: ExternalIdentityProvider) => void
  readonly onProviderSecretInput: (providerId: string, value: string) => void
  readonly onProviderSecretRotate: (providerId: string) => void
  readonly onRetry: () => void
  readonly onSessionLifetimeInput: (value: string) => void
  readonly overrides: OrganizationLoginPolicyOverride
  readonly passwordPolicy: PasswordPolicy
  readonly passwordPolicyLockoutMinutes: number
  readonly passwordPolicyValidationMessage?: string
  readonly pendingId?: string
  readonly policy: OrganizationLoginPolicy
  readonly policyScope: "organization" | "realm"
  readonly policyValidationMessage?: string
  readonly providerCreate: {
    readonly allowAccountCreation: boolean
    readonly clientId: string
    readonly clientSecret: string
    readonly displayName: string
    readonly issuer: string
    readonly redirectUri: string
    readonly scopesText: string
    readonly type: ExternalIdentityProviderType
  }
  readonly providerEdits: Readonly<Record<string, OrganizationAdminProviderEditDraft>>
  readonly providers: readonly ExternalIdentityProvider[]
  readonly providerSecrets: Readonly<Record<string, string>>
  readonly status: OrganizationAdminStatus
  readonly securityPolicy: ReturnType<typeof organizationAdminSecurityPolicyDraftCreate>
  readonly validationMessage?: string
}) {
  return (
    <AuthenticatedPageBody>
      <nav aria-label={messageTranslate("admin.organizations.policy.scopeLabel")} class="flex flex-wrap gap-1.5">
        <a
          aria-current={props.policyScope === "realm" ? "page" : undefined}
          class={`${authenticatedNavigationLinkClassGet(props.policyScope === "realm")} border border-line`}
          href="?scope=realm"
        >
          {messageTranslate("admin.organizations.policy.realmDefaults")}
        </a>
        <a
          aria-current={props.policyScope === "organization" ? "page" : undefined}
          class={`${authenticatedNavigationLinkClassGet(props.policyScope === "organization")} border border-line`}
          href="?scope=organization"
        >
          {messageTranslate("admin.organizations.policy.organizationOverrides")}
        </a>
      </nav>

      <OrganizationAdminNotice notice={props.notice} />

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.providers.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <div class="grid min-w-0 max-w-3xl gap-5 [&>*]:min-w-0 [&_label]:text-[0.8125rem]">
          <AuthenticatedSection
            description={messageTranslate("admin.organizations.policy.description")}
            title={messageTranslate("admin.organizations.policy.title")}
          >
            <form class="grid max-w-3xl gap-4 px-5 py-4" onSubmit={props.onPolicySubmit}>
              <div class="grid items-start gap-2 sm:grid-cols-2">
                <For each={policyFields}>
                  {(field) => (
                    <label
                      class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 rounded-control border border-line-subtle px-3 py-3 text-[0.8125rem] font-medium"
                      for={`policy-${field.key}`}
                    >
                      <input
                        checked={props.policy[field.key] ?? false}
                        class={`${authenticatedControlClasses.checkbox} mt-0.5`}
                        id={`policy-${field.key}`}
                        onChange={() => props.onPolicyToggle(field.key)}
                        type="checkbox"
                      />
                      <span class="min-w-0">{messageTranslate(field.labelKey)}</span>
                      <Show
                        when={
                          props.policyScope === "organization" &&
                          (props.overrides[field.key] === undefined || props.overrides[field.key] === null)
                        }
                      >
                        <span class="col-start-2">
                          <AuthenticatedStatus
                            label={messageTranslate("admin.organizations.policy.inherited")}
                            tone="neutral"
                          />
                        </span>
                      </Show>
                    </label>
                  )}
                </For>
              </div>
              <div class="grid min-w-0 gap-1.5">
                <Label class="text-[0.8125rem] font-medium" for="policy-session-lifetime">
                  {messageTranslate("admin.organizations.policy.sessionLifetime")}
                </Label>
                <AuthenticatedInput
                  id="policy-session-lifetime"
                  inputMode="numeric"
                  max={31536000}
                  min={1}
                  onInput={(event) => props.onSessionLifetimeInput(event.currentTarget.value)}
                  type="number"
                  value={props.policy.sessionLifetimeSeconds ?? ""}
                />
                <p class="text-xs text-muted-foreground">
                  {messageTranslate("admin.organizations.policy.sessionLifetimeHint")}
                </p>
                <OrganizationAdminPolicyInheritedBadge
                  show={props.policyScope === "organization" && props.overrides.sessionLifetimeSeconds == null}
                />
              </div>
              <div class="grid gap-4 sm:grid-cols-3">
                <For each={policyMfaLifetimeFields}>
                  {(field) => (
                    <div class="grid min-w-0 content-start gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for={`policy-${field.key}`}>
                        {messageTranslate(field.labelKey)}
                      </Label>
                      <AuthenticatedInput
                        id={`policy-${field.key}`}
                        inputMode="numeric"
                        max={31536000}
                        min={1}
                        onInput={(event) => props.onMfaLifetimeInput(field.key, event.currentTarget.value)}
                        type="number"
                        value={props.policy[field.key] ?? ""}
                      />
                      <OrganizationAdminPolicyInheritedBadge
                        show={props.policyScope === "organization" && props.overrides[field.key] == null}
                      />
                    </div>
                  )}
                </For>
              </div>
              <p class="text-xs text-muted-foreground">
                {messageTranslate("admin.organizations.policy.lifetimeUnsetHint")}
              </p>
              <div class="grid min-w-0 gap-2">
                <p class="text-[0.8125rem] font-medium">
                  {messageTranslate("admin.organizations.policy.providerAllowlist")}
                </p>
                <p class="text-xs text-muted-foreground">
                  {messageTranslate("admin.organizations.policy.providerAllowlistDescription")}
                </p>
                <div class="grid items-start gap-2 sm:grid-cols-2">
                  <For each={props.providers}>
                    {(provider) => (
                      <label
                        class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 rounded-control border border-line-subtle px-3 py-3 text-[0.8125rem] font-medium"
                        for={`policy-provider-${provider.id}`}
                      >
                        <input
                          checked={
                            props.policy.providerIds === null || props.policy.providerIds === undefined
                              ? true
                              : props.policy.providerIds.includes(provider.id)
                          }
                          class={`${authenticatedControlClasses.checkbox} mt-0.5`}
                          id={`policy-provider-${provider.id}`}
                          onChange={() => props.onProviderAllowlistToggle(provider.id)}
                          type="checkbox"
                        />
                        <span class="min-w-0 truncate" title={provider.displayName}>
                          {provider.displayName}
                        </span>
                        <OrganizationAdminPolicyInheritedBadge
                          show={props.policyScope === "organization" && props.overrides.providerIds == null}
                        />
                      </label>
                    )}
                  </For>
                </div>
                <Show
                  when={(props.policy.providerIds ?? []).some(
                    (id) => !props.providers.some((provider) => provider.id === id),
                  )}
                >
                  <div class="flex flex-wrap gap-1.5">
                    <For
                      each={(props.policy.providerIds ?? []).filter(
                        (id) => !props.providers.some((provider) => provider.id === id),
                      )}
                    >
                      {(id) => (
                        <span class="inline-flex min-w-0 items-center gap-1.5 rounded-control border border-line-subtle px-2 py-1 text-xs">
                          <span class="min-w-0 truncate" title={id}>
                            {id}
                          </span>
                          <button
                            aria-label={messageTranslate("common.remove")}
                            class="text-muted-foreground hover:text-foreground"
                            onClick={() => props.onProviderAllowlistToggle(id)}
                            type="button"
                          >
                            <Icon path={mdiCancel} class="size-3.5" />
                          </button>
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={props.policy.providerIds != null}>
                  <div>
                    <AuthenticatedButton
                      onClick={props.onProviderAllowlistReset}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {messageTranslate("admin.organizations.policy.providerAllowlistReset")}
                    </AuthenticatedButton>
                  </div>
                </Show>
              </div>
              <div class="flex justify-end">
                <AuthenticatedButton
                  disabled={props.pendingId === "policy"}
                  icon={mdiContentSave}
                  type="submit"
                  variant="filledBlue"
                >
                  {messageTranslate("common.save")}
                </AuthenticatedButton>
              </div>
            </form>
          </AuthenticatedSection>

          <OrganizationAdminSecurityPolicyView
            allowedFactors={props.securityPolicy.effectiveAllowedFactors()}
            assurance={props.securityPolicy.effectiveMinimumStepUpAssurance()}
            fieldInherited={props.securityPolicy.fieldInherited}
            onAllowedFactorToggle={props.securityPolicy.allowedFactorToggle}
            onAssuranceInput={props.securityPolicy.minimumStepUpAssuranceSet}
            onFieldOverrideSet={props.securityPolicy.fieldOverrideSet}
            onPreferredFactorMove={props.securityPolicy.preferredFactorMove}
            onRequiredMfaInput={props.securityPolicy.requiredMfaSet}
            order={props.securityPolicy.effectivePreferredFactorOrder()}
            requiredMfa={props.securityPolicy.effectiveRequiredMfa()}
            scope={props.policyScope}
            validationMessage={props.policyValidationMessage}
          />

          <Show when={props.policyScope === "realm"}>
            <OrganizationAdminPasswordPolicyView
              lockoutMinutes={props.passwordPolicyLockoutMinutes}
              onLockoutMinutesInput={props.onPasswordPolicyLockoutMinutesInput}
              onMaximumAttemptsInput={props.onPasswordPolicyMaximumAttemptsInput}
              onMinimumLengthInput={props.onPasswordPolicyMinimumLengthInput}
              onSubmit={props.onPasswordPolicySubmit}
              onToggle={props.onPasswordPolicyToggle}
              pending={props.pendingId === "password-policy"}
              policy={props.passwordPolicy}
              validationMessage={props.passwordPolicyValidationMessage}
            />
          </Show>

          <AuthenticatedSection
            description={messageTranslate("admin.organizations.providers.description")}
            title={messageTranslate("admin.organizations.providers.title")}
          >
            <Show
              when={props.providers.length > 0}
              fallback={
                <ProductionStatePanel
                  compact
                  detail={messageTranslate("admin.organizations.providers.empty")}
                  state="empty"
                />
              }
            >
              <ul
                aria-label={messageTranslate("admin.organizations.providers.title")}
                class="divide-y divide-line-subtle"
              >
                <For each={props.providers}>
                  {(provider) => (
                    <li class="grid min-w-0 gap-4 px-5 py-4">
                      <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <div class="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 class="min-w-0 truncate text-sm font-medium" title={provider.displayName}>
                            {provider.displayName}
                          </h3>
                          <AuthenticatedStatus label={provider.type} tone="neutral" />
                          <AuthenticatedStatus
                            label={
                              provider.enabled
                                ? messageTranslate("common.enabled")
                                : messageTranslate("common.disabled")
                            }
                            tone={provider.enabled ? "success" : "warning"}
                          />
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5">
                          <AuthenticatedButton
                            size="sm"
                            disabled={props.pendingId === `provider:${provider.id}`}
                            icon={mdiToggleSwitch}
                            onClick={() => props.onProviderEnabledToggle(provider)}
                            variant="outline"
                          >
                            {provider.enabled ? messageTranslate("common.disable") : messageTranslate("common.enable")}
                          </AuthenticatedButton>
                          <Show when={provider.enabled}>
                            <AuthenticatedButton
                              size="sm"
                              disabled={props.pendingId === `provider:${provider.id}`}
                              icon={mdiCancel}
                              onClick={() => props.onProviderDisable(provider.id, provider.displayName)}
                              variant="outlineRed"
                            >
                              {messageTranslate("admin.organizations.providers.disable")}
                            </AuthenticatedButton>
                          </Show>
                        </div>
                      </div>

                      <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid min-w-0 gap-1">
                          <Label for={`provider-${provider.id}-display-name`}>
                            {messageTranslate("admin.organizations.providers.displayName")}
                          </Label>
                          <AuthenticatedInput
                            id={`provider-${provider.id}-display-name`}
                            onInput={(event) =>
                              props.onProviderEditInput(provider, "displayName", event.currentTarget.value)
                            }
                            value={props.providerEdits[provider.id]?.displayName ?? provider.displayName}
                          />
                        </div>
                        <div class="grid min-w-0 gap-1">
                          <Label for={`provider-${provider.id}-client-id`}>
                            {messageTranslate("admin.organizations.providers.clientId")}
                          </Label>
                          <AuthenticatedInput
                            id={`provider-${provider.id}-client-id`}
                            onInput={(event) =>
                              props.onProviderEditInput(provider, "clientId", event.currentTarget.value)
                            }
                            value={props.providerEdits[provider.id]?.clientId ?? provider.clientId}
                          />
                        </div>
                        <div class="grid min-w-0 gap-1 sm:col-span-2">
                          <Label for={`provider-${provider.id}-redirect-uri`}>
                            {messageTranslate("admin.organizations.providers.redirectUri")}
                          </Label>
                          <AuthenticatedInput
                            id={`provider-${provider.id}-redirect-uri`}
                            onInput={(event) =>
                              props.onProviderEditInput(provider, "redirectUri", event.currentTarget.value)
                            }
                            placeholder={messageTranslate("common.urlPlaceholder")}
                            value={props.providerEdits[provider.id]?.redirectUri ?? provider.redirectUri}
                          />
                        </div>
                        <Show when={provider.type === "oidc"}>
                          <div class="grid min-w-0 gap-1 sm:col-span-2">
                            <Label for={`provider-${provider.id}-issuer`}>
                              {messageTranslate("admin.organizations.providers.issuer")}
                            </Label>
                            <AuthenticatedInput
                              id={`provider-${provider.id}-issuer`}
                              onInput={(event) =>
                                props.onProviderEditInput(provider, "issuer", event.currentTarget.value)
                              }
                              placeholder={messageTranslate("common.urlPlaceholder")}
                              value={props.providerEdits[provider.id]?.issuer ?? provider.issuer ?? ""}
                            />
                            <p class="text-xs text-muted-foreground">
                              {messageTranslate("admin.organizations.providers.issuerHint")}
                            </p>
                          </div>
                        </Show>
                        <div class="grid min-w-0 gap-1 sm:col-span-2">
                          <Label for={`provider-${provider.id}-scopes`}>
                            {messageTranslate("admin.organizations.providers.scopes")}
                          </Label>
                          <AuthenticatedInput
                            id={`provider-${provider.id}-scopes`}
                            onInput={(event) =>
                              props.onProviderEditInput(provider, "scopesText", event.currentTarget.value)
                            }
                            value={props.providerEdits[provider.id]?.scopesText ?? provider.scopes.join(", ")}
                          />
                          <p class="text-xs text-muted-foreground">
                            {messageTranslate("admin.organizations.providers.scopesHint")}
                          </p>
                        </div>
                      </div>
                      <Show when={props.providerEdits[provider.id] !== undefined}>
                        <div class="flex flex-wrap justify-end gap-2">
                          <AuthenticatedButton
                            size="sm"
                            onClick={() => props.onProviderEditReset(provider.id)}
                            variant="outline"
                          >
                            {messageTranslate("common.cancel")}
                          </AuthenticatedButton>
                          <AuthenticatedButton
                            size="sm"
                            disabled={props.pendingId === `provider:${provider.id}`}
                            icon={mdiContentSave}
                            onClick={() => props.onProviderEditSubmit(provider)}
                            variant="filledBlue"
                          >
                            {messageTranslate("admin.organizations.providers.save")}
                          </AuthenticatedButton>
                        </div>
                      </Show>

                      <div class="grid items-end gap-2 border-t border-line-subtle pt-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div class="grid min-w-0 gap-1">
                          <Label for={`provider-secret-${provider.id}`}>
                            {messageTranslate("admin.organizations.providers.clientSecret")}
                          </Label>
                          <AuthenticatedInput
                            autocomplete="off"
                            id={`provider-secret-${provider.id}`}
                            onInput={(event) => props.onProviderSecretInput(provider.id, event.currentTarget.value)}
                            type="password"
                            value={props.providerSecrets[provider.id] ?? ""}
                          />
                          <p class="text-xs text-muted-foreground">
                            {messageTranslate("admin.organizations.providers.secretWriteOnly")}
                          </p>
                        </div>
                        <AuthenticatedButton
                          size="sm"
                          disabled={
                            props.pendingId === `provider:${provider.id}` ||
                            (props.providerSecrets[provider.id] ?? "").length === 0
                          }
                          icon={mdiAutorenew}
                          onClick={() => props.onProviderSecretRotate(provider.id)}
                          variant="outline"
                        >
                          {messageTranslate("admin.organizations.providers.rotateSecret")}
                        </AuthenticatedButton>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </AuthenticatedSection>

          <AuthenticatedSection title={messageTranslate("admin.organizations.providers.create")}>
            <form class="grid max-w-3xl gap-4 px-5 py-4" onSubmit={props.onProviderCreateSubmit}>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-type">{messageTranslate("admin.organizations.providers.type")}</Label>
                  <div class="relative w-full min-w-0">
                    <select
                      class={`${authenticatedControlClasses.select} appearance-none pe-9`}
                      id="provider-type"
                      onChange={(event) =>
                        props.onProviderCreateTypeInput(event.currentTarget.value as ExternalIdentityProviderType)
                      }
                      value={props.providerCreate.type}
                    >
                      <For each={providerTypes}>{(type) => <option value={type}>{type}</option>}</For>
                    </select>
                    <Icon
                      path={mdiChevronDown}
                      class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-display-name">
                    {messageTranslate("admin.organizations.providers.displayName")}
                  </Label>
                  <AuthenticatedInput
                    id="provider-display-name"
                    onInput={(event) => props.onProviderCreateInput("displayName", event.currentTarget.value)}
                    value={props.providerCreate.displayName}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-client-id">{messageTranslate("admin.organizations.providers.clientId")}</Label>
                  <AuthenticatedInput
                    id="provider-client-id"
                    onInput={(event) => props.onProviderCreateInput("clientId", event.currentTarget.value)}
                    value={props.providerCreate.clientId}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-client-secret">
                    {messageTranslate("admin.organizations.providers.clientSecret")}
                  </Label>
                  <AuthenticatedInput
                    autocomplete="off"
                    id="provider-client-secret"
                    onInput={(event) => props.onProviderCreateInput("clientSecret", event.currentTarget.value)}
                    type="password"
                    value={props.providerCreate.clientSecret}
                  />
                </div>
                <div class="grid min-w-0 gap-1 sm:col-span-2">
                  <Label for="provider-redirect-uri">
                    {messageTranslate("admin.organizations.providers.redirectUri")}
                  </Label>
                  <AuthenticatedInput
                    id="provider-redirect-uri"
                    onInput={(event) => props.onProviderCreateInput("redirectUri", event.currentTarget.value)}
                    placeholder={messageTranslate("common.urlPlaceholder")}
                    value={props.providerCreate.redirectUri}
                  />
                </div>
                <Show when={props.providerCreate.type === "oidc"}>
                  <div class="grid min-w-0 gap-1 sm:col-span-2">
                    <Label for="provider-issuer">{messageTranslate("admin.organizations.providers.issuer")}</Label>
                    <AuthenticatedInput
                      id="provider-issuer"
                      onInput={(event) => props.onProviderCreateInput("issuer", event.currentTarget.value)}
                      placeholder={messageTranslate("common.urlPlaceholder")}
                      value={props.providerCreate.issuer}
                    />
                    <p class="text-xs text-muted-foreground">
                      {messageTranslate("admin.organizations.providers.issuerHint")}
                    </p>
                  </div>
                </Show>
                <div class="grid min-w-0 gap-1 sm:col-span-2">
                  <Label for="provider-scopes">{messageTranslate("admin.organizations.providers.scopes")}</Label>
                  <AuthenticatedInput
                    id="provider-scopes"
                    onInput={(event) => props.onProviderCreateInput("scopesText", event.currentTarget.value)}
                    value={props.providerCreate.scopesText}
                  />
                  <p class="text-xs text-muted-foreground">
                    {messageTranslate("admin.organizations.providers.scopesHint")}
                  </p>
                </div>
              </div>
              <label
                class="flex min-h-10 items-center gap-3 rounded-control border border-line-subtle px-3 py-2 text-[0.8125rem] font-medium"
                for="provider-account-creation"
              >
                <input
                  checked={props.providerCreate.allowAccountCreation}
                  class={authenticatedControlClasses.checkbox}
                  id="provider-account-creation"
                  onChange={props.onProviderAccountCreationToggle}
                  type="checkbox"
                />
                {messageTranslate("admin.organizations.providers.allowAccountCreation")}
              </label>
              <Show when={props.validationMessage}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <div class="flex justify-end">
                <AuthenticatedButton
                  disabled={props.pendingId === "provider:create"}
                  icon={mdiPlus}
                  type="submit"
                  variant="filledBlue"
                >
                  {messageTranslate("admin.organizations.providers.create")}
                </AuthenticatedButton>
              </div>
            </form>
          </AuthenticatedSection>
        </div>
      </OrganizationAdminState>
    </AuthenticatedPageBody>
  )
}
