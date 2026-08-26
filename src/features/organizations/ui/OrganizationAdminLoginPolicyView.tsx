import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentityProviderType } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import { OrganizationAdminSecurityPolicyView } from "./OrganizationAdminSecurityPolicyView.js"
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
    <section class="grid gap-5">
      <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.organizations.policy.title")}</h1>
      <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
        {messageTranslate("admin.organizations.policy.description")}
      </p>
      <nav aria-label={messageTranslate("admin.organizations.policy.scopeLabel")} class="flex flex-wrap gap-2">
        <a
          aria-current={props.policyScope === "realm" ? "page" : undefined}
          class="rounded-lg border border-line px-3 py-2 text-sm font-medium"
          href="?scope=realm"
        >
          {messageTranslate("admin.organizations.policy.realmDefaults")}
        </a>
        <a
          aria-current={props.policyScope === "organization" ? "page" : undefined}
          class="rounded-lg border border-line px-3 py-2 text-sm font-medium"
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
        <div class="grid gap-5">
          <CardWrapper>
            <h2 class="text-lg font-semibold">{messageTranslate("admin.organizations.policy.title")}</h2>
            <form class="mt-4 grid gap-4" onSubmit={props.onPolicySubmit}>
              <For each={policyFields}>
                {(field) => (
                  <label class="flex items-center justify-between gap-4 text-sm" for={`policy-${field.key}`}>
                    <span class="flex items-center gap-2">
                      {messageTranslate(field.labelKey)}
                      <Show when={props.overrides[field.key] === undefined || props.overrides[field.key] === null}>
                        <Badge variant="outline">{messageTranslate("admin.organizations.policy.inherited")}</Badge>
                      </Show>
                    </span>
                    <input
                      checked={props.policy[field.key]}
                      class="size-4 rounded border-line"
                      id={`policy-${field.key}`}
                      onChange={() => props.onPolicyToggle(field.key)}
                      type="checkbox"
                    />
                  </label>
                )}
              </For>
              <div>
                <Button disabled={props.pendingId === "policy"} type="submit">
                  {messageTranslate("common.save")}
                </Button>
              </div>
            </form>
          </CardWrapper>
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
          <CardWrapper>
            <h2 class="text-lg font-semibold">{messageTranslate("admin.organizations.providers.title")}</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {messageTranslate("admin.organizations.providers.description")}
            </p>
            <Show
              when={props.providers.length > 0}
              fallback={
                <p class="py-6 text-muted-foreground">{messageTranslate("admin.organizations.providers.empty")}</p>
              }
            >
              <div class="mt-4 grid gap-4">
                <For each={props.providers}>
                  {(provider) => (
                    <article class="rounded-xl border border-line p-5">
                      <div class="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div class="flex flex-wrap items-center gap-2">
                            <h3 class="font-semibold">{provider.displayName}</h3>
                            <Badge variant="outline">{provider.type}</Badge>
                            <Badge variant={provider.enabled ? "filledGreen" : "filledYellow"}>
                              {provider.enabled
                                ? messageTranslate("common.enabled")
                                : messageTranslate("common.disabled")}
                            </Badge>
                          </div>
                          <p class="mt-2 font-mono text-xs text-muted-foreground">{provider.clientId}</p>
                          <p class="mt-1 break-all font-mono text-xs text-muted-foreground">{provider.redirectUri}</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <Button
                            disabled={props.pendingId === `provider:${provider.id}`}
                            onClick={() => props.onProviderEnabledToggle(provider)}
                            variant="outline"
                          >
                            {provider.enabled ? messageTranslate("common.disable") : messageTranslate("common.enable")}
                          </Button>
                          <Show when={provider.enabled}>
                            <Button
                              disabled={props.pendingId === `provider:${provider.id}`}
                              onClick={() => props.onProviderDisable(provider.id, provider.displayName)}
                              variant="filledRed"
                            >
                              {messageTranslate("admin.organizations.providers.disable")}
                            </Button>
                          </Show>
                        </div>
                      </div>
                      <div class="mt-4 border-t border-line pt-4">
                        <p class="text-xs text-muted-foreground">
                          {messageTranslate("admin.organizations.providers.secretWriteOnly")}
                        </p>
                        <div class="mt-3 flex flex-wrap items-end gap-3">
                          <div class="grid flex-1 gap-2">
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
                          </div>
                          <Button
                            disabled={
                              props.pendingId === `provider:${provider.id}` ||
                              (props.providerSecrets[provider.id] ?? "").length === 0
                            }
                            onClick={() => props.onProviderSecretRotate(provider.id)}
                            variant="outline"
                          >
                            {messageTranslate("admin.organizations.providers.rotateSecret")}
                          </Button>
                        </div>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </CardWrapper>
          <CardWrapper>
            <h2 class="text-lg font-semibold">{messageTranslate("admin.organizations.providers.create")}</h2>
            <form class="mt-4 grid gap-4" onSubmit={props.onProviderCreateSubmit}>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-2">
                  <Label for="provider-type">{messageTranslate("admin.organizations.providers.type")}</Label>
                  <select
                    class="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
                    id="provider-type"
                    onChange={(event) =>
                      props.onProviderCreateTypeInput(event.currentTarget.value as ExternalIdentityProviderType)
                    }
                    value={props.providerCreate.type}
                  >
                    <For each={providerTypes}>{(type) => <option value={type}>{type}</option>}</For>
                  </select>
                </div>
                <div class="grid gap-2">
                  <Label for="provider-display-name">
                    {messageTranslate("admin.organizations.providers.displayName")}
                  </Label>
                  <Input
                    id="provider-display-name"
                    onInput={(event) => props.onProviderCreateInput("displayName", event.currentTarget.value)}
                    value={props.providerCreate.displayName}
                  />
                </div>
                <div class="grid gap-2">
                  <Label for="provider-client-id">{messageTranslate("admin.organizations.providers.clientId")}</Label>
                  <Input
                    id="provider-client-id"
                    onInput={(event) => props.onProviderCreateInput("clientId", event.currentTarget.value)}
                    value={props.providerCreate.clientId}
                  />
                </div>
                <div class="grid gap-2">
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
                <div class="grid gap-2 sm:col-span-2">
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
              <label class="flex items-center gap-2 text-sm" for="provider-account-creation">
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
                {(message) => (
                  <p class="text-sm text-danger" role="alert">
                    {message()}
                  </p>
                )}
              </Show>
              <div>
                <Button disabled={props.pendingId === "provider:create"} type="submit">
                  {messageTranslate("admin.organizations.providers.create")}
                </Button>
              </div>
            </form>
          </CardWrapper>
        </div>
      </OrganizationAdminState>
    </section>
  )
}
