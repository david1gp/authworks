import { mdiAutorenew } from "@adaptive-ds/mdi/mdiAutorenew.js"
import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { mdiToggleSwitch } from "@adaptive-ds/mdi/mdiToggleSwitch.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
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
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminPasswordPolicyView } from "./OrganizationAdminPasswordPolicyView.js"
import { OrganizationAdminSecurityPolicyView } from "./OrganizationAdminSecurityPolicyView.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
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
>

const policyFields: readonly { key: PolicyKey; labelKey: MessageKey }[] = [
  { key: "allowPassword", labelKey: "admin.organizations.policy.password" },
  { key: "allowPasswordRecovery", labelKey: "admin.organizations.policy.passwordRecovery" },
  { key: "allowPasskey", labelKey: "admin.organizations.policy.passkey" },
  { key: "allowEmailOtp", labelKey: "admin.organizations.policy.emailOtp" },
  { key: "allowExternalIdentity", labelKey: "admin.organizations.policy.externalIdentity" },
  { key: "allowRegistration", labelKey: "admin.organizations.policy.registration" },
  { key: "allowDomainDiscovery", labelKey: "admin.organizations.policy.domainDiscovery" },
]

const providerTypes: readonly ExternalIdentityProviderType[] = ["google", "github", "microsoft"]

export function OrganizationAdminLoginPolicyView(props: {
  readonly error?: string
  readonly notice?: string
  readonly onPasswordPolicyLockoutMinutesInput: (minutes: number) => void
  readonly onPasswordPolicyMaximumAttemptsInput: (value: number) => void
  readonly onPasswordPolicyMinimumLengthInput: (value: number) => void
  readonly onPasswordPolicySubmit: (event: SubmitEvent) => void
  readonly onPasswordPolicyToggle: (
    key: "requireLowercase" | "requireNumber" | "requireSymbol" | "requireUppercase",
  ) => void
  readonly onPolicySubmit: (event: SubmitEvent) => void
  readonly onPolicyToggle: (key: PolicyKey) => void
  readonly onProviderCreateInput: (
    key: "clientId" | "clientSecret" | "displayName" | "redirectUri",
    value: string,
  ) => void
  readonly onProviderCreateSubmit: (event: SubmitEvent) => void
  readonly onProviderCreateTypeInput: (value: ExternalIdentityProviderType) => void
  readonly onProviderAccountCreationToggle: () => void
  readonly onProviderDisable: (providerId: string, displayName: string) => void
  readonly onProviderEnabledToggle: (provider: ExternalIdentityProvider) => void
  readonly onProviderSecretInput: (providerId: string, value: string) => void
  readonly onProviderSecretRotate: (providerId: string) => void
  readonly onRetry: () => void
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
    readonly redirectUri: string
    readonly type: ExternalIdentityProviderType
  }
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
                        checked={props.policy[field.key]}
                        class={`${authenticatedControlClasses.checkbox} mt-0.5`}
                        id={`policy-${field.key}`}
                        onChange={() => props.onPolicyToggle(field.key)}
                        type="checkbox"
                      />
                      <span class="min-w-0">{messageTranslate(field.labelKey)}</span>
                      <Show when={props.overrides[field.key] === undefined || props.overrides[field.key] === null}>
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

                      <AuthenticatedFieldList
                        fields={[
                          {
                            identifier: true,
                            label: messageTranslate("admin.organizations.providers.clientId"),
                            value: provider.clientId,
                          },
                          {
                            identifier: true,
                            label: messageTranslate("admin.organizations.providers.redirectUri"),
                            value: provider.redirectUri,
                          },
                        ]}
                      />

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
