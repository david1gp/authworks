import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedNavigationLinkClassGet } from "../../../ui/authenticated/authenticatedNavigationLinkClassGet.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
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
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <AuthenticatedSection
            description={messageTranslate("admin.organizations.policy.description")}
            title={messageTranslate("admin.organizations.policy.title")}
          >
            <form class="grid gap-2 px-3 py-3" onSubmit={props.onPolicySubmit}>
              <div class="grid gap-1.5 lg:grid-cols-2">
                <For each={policyFields}>
                  {(field) => (
                    <label
                      class="flex min-w-0 items-center justify-between gap-3 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
                      for={`policy-${field.key}`}
                    >
                      <span class="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span class="min-w-0 truncate">{messageTranslate(field.labelKey)}</span>
                        <Show when={props.overrides[field.key] === undefined || props.overrides[field.key] === null}>
                          <AuthenticatedStatus
                            label={messageTranslate("admin.organizations.policy.inherited")}
                            tone="neutral"
                          />
                        </Show>
                      </span>
                      <input
                        checked={props.policy[field.key]}
                        class="size-4 shrink-0 rounded border-line"
                        id={`policy-${field.key}`}
                        onChange={() => props.onPolicyToggle(field.key)}
                        type="checkbox"
                      />
                    </label>
                  )}
                </For>
              </div>
              <div>
                <Button disabled={props.pendingId === "policy"} size="sm" type="submit">
                  {messageTranslate("common.save")}
                </Button>
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
                    <li class="grid min-w-0 gap-2 px-3 py-2.5">
                      <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <div class="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 class="min-w-0 truncate text-sm font-medium">{provider.displayName}</h3>
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
                          <Button
                            disabled={props.pendingId === `provider:${provider.id}`}
                            onClick={() => props.onProviderEnabledToggle(provider)}
                            size="sm"
                            variant="outline"
                          >
                            {provider.enabled ? messageTranslate("common.disable") : messageTranslate("common.enable")}
                          </Button>
                          <Show when={provider.enabled}>
                            <Button
                              disabled={props.pendingId === `provider:${provider.id}`}
                              onClick={() => props.onProviderDisable(provider.id, provider.displayName)}
                              size="sm"
                              variant="filledRed"
                            >
                              {messageTranslate("admin.organizations.providers.disable")}
                            </Button>
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
                          <Input
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
                        <Button
                          disabled={
                            props.pendingId === `provider:${provider.id}` ||
                            (props.providerSecrets[provider.id] ?? "").length === 0
                          }
                          onClick={() => props.onProviderSecretRotate(provider.id)}
                          size="sm"
                          variant="outline"
                        >
                          {messageTranslate("admin.organizations.providers.rotateSecret")}
                        </Button>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </AuthenticatedSection>

          <AuthenticatedSection title={messageTranslate("admin.organizations.providers.create")}>
            <form class="grid gap-3 px-3 py-3" onSubmit={props.onProviderCreateSubmit}>
              <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-type">{messageTranslate("admin.organizations.providers.type")}</Label>
                  <select
                    class="h-9 w-full rounded-control border border-line bg-surface px-2 text-sm text-foreground"
                    id="provider-type"
                    onChange={(event) =>
                      props.onProviderCreateTypeInput(event.currentTarget.value as ExternalIdentityProviderType)
                    }
                    value={props.providerCreate.type}
                  >
                    <For each={providerTypes}>{(type) => <option value={type}>{type}</option>}</For>
                  </select>
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-display-name">
                    {messageTranslate("admin.organizations.providers.displayName")}
                  </Label>
                  <Input
                    id="provider-display-name"
                    onInput={(event) => props.onProviderCreateInput("displayName", event.currentTarget.value)}
                    value={props.providerCreate.displayName}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-client-id">{messageTranslate("admin.organizations.providers.clientId")}</Label>
                  <Input
                    id="provider-client-id"
                    onInput={(event) => props.onProviderCreateInput("clientId", event.currentTarget.value)}
                    value={props.providerCreate.clientId}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="provider-client-secret">
                    {messageTranslate("admin.organizations.providers.clientSecret")}
                  </Label>
                  <Input
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
                  <Input
                    id="provider-redirect-uri"
                    onInput={(event) => props.onProviderCreateInput("redirectUri", event.currentTarget.value)}
                    placeholder={messageTranslate("common.urlPlaceholder")}
                    value={props.providerCreate.redirectUri}
                  />
                </div>
              </div>
              <label class="flex items-center gap-2 text-xs font-medium" for="provider-account-creation">
                <input
                  checked={props.providerCreate.allowAccountCreation}
                  class="size-4 rounded border-line"
                  id="provider-account-creation"
                  onChange={props.onProviderAccountCreationToggle}
                  type="checkbox"
                />
                {messageTranslate("admin.organizations.providers.allowAccountCreation")}
              </label>
              <Show when={props.validationMessage}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <div>
                <Button disabled={props.pendingId === "provider:create"} size="sm" type="submit">
                  {messageTranslate("admin.organizations.providers.create")}
                </Button>
              </div>
            </form>
          </AuthenticatedSection>
        </div>
      </OrganizationAdminState>
    </AuthenticatedPageBody>
  )
}
