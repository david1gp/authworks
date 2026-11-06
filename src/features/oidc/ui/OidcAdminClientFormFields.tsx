import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedSettingsList } from "../../../ui/authenticated/AuthenticatedSettingsList.js"
import { AuthenticatedSettingsRow } from "../../../ui/authenticated/AuthenticatedSettingsRow.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectApplication } from "../../projects/public/projectApplicationSchema.js"
import type { ProjectListItem } from "../../projects/public/projectListItemSchema.js"

/**
 * The client fields shared by registration and settings. Registration also chooses a client type,
 * which is immutable afterwards, so that control is only rendered when a type signal is supplied.
 * Project and application are clearable: the empty option submits null on edit and is omitted on create.
 */
export function OidcAdminClientFormFields(props: {
  readonly accessTokenLifetimeSeconds: SignalObject<string>
  readonly accessTokenRoleAssertion: SignalObject<boolean>
  readonly additionalOrigins: SignalObject<string>
  readonly applicationId: SignalObject<string>
  readonly applications: () => readonly ProjectApplication[]
  readonly clientType?: SignalObject<string>
  readonly devMode: SignalObject<boolean>
  readonly grants: () => readonly string[]
  readonly grantsSupported: readonly string[]
  readonly grantToggle: (grant: string) => void
  readonly idPrefix: string
  readonly idTokenLifetimeSeconds: SignalObject<string>
  readonly idTokenRoleAssertion: SignalObject<boolean>
  readonly idTokenUserinfoAssertion: SignalObject<boolean>
  readonly name: SignalObject<string>
  readonly postLogoutRedirectUris: SignalObject<string>
  readonly projectId: SignalObject<string>
  readonly projects: () => readonly ProjectListItem[]
  readonly projectSelect: (projectId: string) => void
  readonly applicationSelect: (applicationId: string) => void
  readonly redirectUris: SignalObject<string>
  readonly refreshTokenAbsoluteLifetimeSeconds: SignalObject<string>
  readonly refreshTokenIdleLifetimeSeconds: SignalObject<string>
  readonly requireConsent: SignalObject<boolean>
  readonly responseToggle: (response: string) => void
  readonly responses: () => readonly string[]
  readonly responsesSupported: readonly string[]
  readonly scopeToggle: (scope: string) => void
  readonly scopes: () => readonly string[]
  readonly scopesSupported: readonly string[]
  readonly trusted: SignalObject<boolean>
}) {
  const textareaClass = `${authenticatedControlClasses.textarea} min-h-[4rem] [field-sizing:content] break-all font-mono text-[0.8125rem] leading-5`
  const projectName = (projectId: string) =>
    projectId === ""
      ? messageTranslate("admin.oidc.clients.projectNone")
      : (props.projects().find((project) => project.id === projectId)?.name ?? projectId)
  const applicationName = (applicationId: string) =>
    applicationId === ""
      ? messageTranslate("admin.oidc.clients.applicationNone")
      : (props.applications().find((application) => application.id === applicationId)?.name ?? applicationId)
  return (
    <>
      <h3 class="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {messageTranslate("admin.configuration.generalTitle")}
      </h3>
      <AuthenticatedSettingsList>
        <AuthenticatedSettingsRow
          label={messageTranslate("admin.oidc.clients.name")}
          htmlFor={`${props.idPrefix}-name`}
        >
          <AuthenticatedInput
            id={`${props.idPrefix}-name`}
            onInput={(event) => props.name.set(event.currentTarget.value)}
            value={props.name.get()}
          />
        </AuthenticatedSettingsRow>
        <Show when={props.clientType}>
          {(clientType) => (
            <AuthenticatedSettingsRow
              label={messageTranslate("admin.oidc.clients.type")}
              htmlFor={`${props.idPrefix}-type`}
              description={messageTranslate("admin.oidc.clients.typeHint")}
            >
              <AuthenticatedSelect
                getOptions={() => ["confidential", "public"]}
                id={`${props.idPrefix}-type`}
                valueSignal={clientType()}
                valueText={(type) =>
                  type === "public"
                    ? messageTranslate("admin.oidc.clients.typePublic")
                    : messageTranslate("admin.oidc.clients.typeConfidential")
                }
              />
            </AuthenticatedSettingsRow>
          )}
        </Show>
        <AuthenticatedSettingsRow
          label={messageTranslate("admin.oidc.clients.project")}
          htmlFor={`${props.idPrefix}-project`}
        >
          <AuthenticatedSelect
            getOptions={() => ["", ...props.projects().map((project) => project.id)]}
            id={`${props.idPrefix}-project`}
            valueSignal={{ get: props.projectId.get, set: (next: string) => props.projectSelect(next) }}
            valueText={projectName}
          />
        </AuthenticatedSettingsRow>
        <AuthenticatedSettingsRow
          label={messageTranslate("admin.oidc.clients.application")}
          htmlFor={`${props.idPrefix}-application`}
        >
          <AuthenticatedSelect
            disabled={props.projectId.get() === ""}
            getOptions={() => ["", ...props.applications().map((application) => application.id)]}
            id={`${props.idPrefix}-application`}
            valueSignal={{
              get: props.applicationId.get,
              set: (next: string) => props.applicationSelect(next),
            }}
            valueText={applicationName}
          />
        </AuthenticatedSettingsRow>
      </AuthenticatedSettingsList>
      <h3 class="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {messageTranslate("admin.redesign.redirectsOrigins")}
      </h3>
      <AuthenticatedSettingsList>
        <AuthenticatedSettingsRow
          label={messageTranslate("admin.oidc.clients.redirectUris")}
          htmlFor={`${props.idPrefix}-redirects`}
          description={messageTranslate("admin.oidc.clients.exactMatchHint")}
        >
          <textarea
            class={textareaClass}
            id={`${props.idPrefix}-redirects`}
            onInput={(event) => props.redirectUris.set(event.currentTarget.value)}
            rows={2}
            value={props.redirectUris.get()}
          />
        </AuthenticatedSettingsRow>
        <AuthenticatedSettingsRow
          label={messageTranslate("admin.oidc.clients.postLogoutUris")}
          htmlFor={`${props.idPrefix}-post-logout`}
        >
          <textarea
            class={textareaClass}
            id={`${props.idPrefix}-post-logout`}
            onInput={(event) => props.postLogoutRedirectUris.set(event.currentTarget.value)}
            rows={2}
            value={props.postLogoutRedirectUris.get()}
          />
        </AuthenticatedSettingsRow>
        <AuthenticatedSettingsRow
          label={messageTranslate("admin.oidc.clients.additionalOrigins")}
          htmlFor={`${props.idPrefix}-additional-origins`}
          description={messageTranslate("admin.oidc.clients.additionalOriginsHint")}
        >
          <textarea
            class={textareaClass}
            id={`${props.idPrefix}-additional-origins`}
            onInput={(event) => props.additionalOrigins.set(event.currentTarget.value)}
            rows={2}
            value={props.additionalOrigins.get()}
          />
        </AuthenticatedSettingsRow>
      </AuthenticatedSettingsList>
      <h3 class="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {messageTranslate("admin.redesign.tokens")}
      </h3>
      <AuthenticatedSettingsList>
        <AuthenticatedSettingsRow
          label={messageTranslate("admin.oidc.clients.tokenLifetimes")}
          description={messageTranslate("admin.oidc.clients.lifetimeHint")}
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="grid min-w-0 gap-1">
              <Label for={`${props.idPrefix}-access-lifetime`} class="whitespace-normal text-xs">
                {messageTranslate("admin.oidc.clients.accessTokenLifetime")}
              </Label>
              <div class="relative min-w-0">
                <AuthenticatedInput
                  class="pr-6"
                  id={`${props.idPrefix}-access-lifetime`}
                  inputMode="numeric"
                  placeholder={messageTranslate("admin.oidc.clients.serverDefault")}
                  onInput={(event) => props.accessTokenLifetimeSeconds.set(event.currentTarget.value)}
                  value={props.accessTokenLifetimeSeconds.get()}
                />
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {messageTranslate("admin.redesign.s")}
                </span>
              </div>
            </div>
            <div class="grid min-w-0 gap-1">
              <Label for={`${props.idPrefix}-id-token-lifetime`} class="whitespace-normal text-xs">
                {messageTranslate("admin.oidc.clients.idTokenLifetime")}
              </Label>
              <div class="relative min-w-0">
                <AuthenticatedInput
                  class="pr-6"
                  id={`${props.idPrefix}-id-token-lifetime`}
                  inputMode="numeric"
                  placeholder={messageTranslate("admin.oidc.clients.serverDefault")}
                  onInput={(event) => props.idTokenLifetimeSeconds.set(event.currentTarget.value)}
                  value={props.idTokenLifetimeSeconds.get()}
                />
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {messageTranslate("admin.redesign.s")}
                </span>
              </div>
            </div>
            <div class="grid min-w-0 gap-1">
              <Label for={`${props.idPrefix}-refresh-idle-lifetime`} class="whitespace-normal text-xs">
                {messageTranslate("admin.oidc.clients.refreshTokenIdleLifetime")}
              </Label>
              <div class="relative min-w-0">
                <AuthenticatedInput
                  class="pr-6"
                  id={`${props.idPrefix}-refresh-idle-lifetime`}
                  inputMode="numeric"
                  placeholder={messageTranslate("admin.oidc.clients.serverDefault")}
                  onInput={(event) => props.refreshTokenIdleLifetimeSeconds.set(event.currentTarget.value)}
                  value={props.refreshTokenIdleLifetimeSeconds.get()}
                />
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {messageTranslate("admin.redesign.s")}
                </span>
              </div>
            </div>
            <div class="grid min-w-0 gap-1">
              <Label for={`${props.idPrefix}-refresh-absolute-lifetime`} class="whitespace-normal text-xs">
                {messageTranslate("admin.oidc.clients.refreshTokenAbsoluteLifetime")}
              </Label>
              <div class="relative min-w-0">
                <AuthenticatedInput
                  class="pr-6"
                  id={`${props.idPrefix}-refresh-absolute-lifetime`}
                  inputMode="numeric"
                  placeholder={messageTranslate("admin.oidc.clients.serverDefault")}
                  onInput={(event) => props.refreshTokenAbsoluteLifetimeSeconds.set(event.currentTarget.value)}
                  value={props.refreshTokenAbsoluteLifetimeSeconds.get()}
                />
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {messageTranslate("admin.redesign.s")}
                </span>
              </div>
            </div>
          </div>
        </AuthenticatedSettingsRow>
        <AuthenticatedSettingsRow label={messageTranslate("admin.oidc.clients.compatibility")}>
          <div class="grid gap-2">
            <div class="grid min-w-0 gap-1.5">
              <label
                class="flex min-w-0 items-start gap-2 text-xs font-medium"
                for={`${props.idPrefix}-id-token-userinfo-assertion`}
              >
                <input
                  checked={props.idTokenUserinfoAssertion.get()}
                  class={`${authenticatedControlClasses.checkbox} mt-0.5 shrink-0`}
                  id={`${props.idPrefix}-id-token-userinfo-assertion`}
                  onChange={(event) => props.idTokenUserinfoAssertion.set(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span class="min-w-0">{messageTranslate("admin.oidc.clients.idTokenUserinfoAssertion")}</span>
              </label>
              <p class="pl-6 text-xs leading-5 text-muted-foreground">
                {messageTranslate("admin.oidc.clients.idTokenUserinfoAssertionHint")}
              </p>
            </div>
            <div class="grid min-w-0 gap-1.5">
              <label
                class="flex min-w-0 items-start gap-2 text-xs font-medium"
                for={`${props.idPrefix}-access-token-role-assertion`}
              >
                <input
                  checked={props.accessTokenRoleAssertion.get()}
                  class={`${authenticatedControlClasses.checkbox} mt-0.5 shrink-0`}
                  id={`${props.idPrefix}-access-token-role-assertion`}
                  onChange={(event) => props.accessTokenRoleAssertion.set(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span class="min-w-0">{messageTranslate("admin.oidc.clients.accessTokenRoleAssertion")}</span>
              </label>
              <p class="pl-6 text-xs leading-5 text-muted-foreground">
                {messageTranslate("admin.oidc.clients.accessTokenRoleAssertionHint")}
              </p>
            </div>
            <div class="grid min-w-0 gap-1.5">
              <label
                class="flex min-w-0 items-start gap-2 text-xs font-medium"
                for={`${props.idPrefix}-id-token-role-assertion`}
              >
                <input
                  checked={props.idTokenRoleAssertion.get()}
                  class={`${authenticatedControlClasses.checkbox} mt-0.5 shrink-0`}
                  id={`${props.idPrefix}-id-token-role-assertion`}
                  onChange={(event) => props.idTokenRoleAssertion.set(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span class="min-w-0">{messageTranslate("admin.oidc.clients.idTokenRoleAssertion")}</span>
              </label>
              <p class="pl-6 text-xs leading-5 text-muted-foreground">
                {messageTranslate("admin.oidc.clients.idTokenRoleAssertionHint")}
              </p>
            </div>
          </div>
        </AuthenticatedSettingsRow>
      </AuthenticatedSettingsList>
      <h3 class="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {messageTranslate("admin.redesign.grantsScopes")}
      </h3>
      <AuthenticatedSettingsList>
        <AuthenticatedSettingsRow label={messageTranslate("admin.oidc.clients.grantTypes")}>
          <div class="flex flex-wrap gap-1.5">
            <For each={props.grantsSupported}>
              {(grant) => (
                <label class="flex items-center gap-1.5 rounded-control border border-line-subtle px-2 py-1 text-xs font-medium">
                  <input
                    checked={props.grants().includes(grant)}
                    class={authenticatedControlClasses.checkbox}
                    onChange={() => props.grantToggle(grant)}
                    type="checkbox"
                  />
                  <code class="font-mono text-xs">{grant}</code>
                </label>
              )}
            </For>
          </div>
        </AuthenticatedSettingsRow>
        <AuthenticatedSettingsRow label={messageTranslate("admin.oidc.clients.responseTypes")}>
          <div class="flex flex-wrap gap-1.5">
            <For each={props.responsesSupported}>
              {(response) => (
                <label class="flex items-center gap-1.5 rounded-control border border-line-subtle px-2 py-1 text-xs font-medium">
                  <input
                    checked={props.responses().includes(response)}
                    class={authenticatedControlClasses.checkbox}
                    onChange={() => props.responseToggle(response)}
                    type="checkbox"
                  />
                  <code class="font-mono text-xs">{response}</code>
                </label>
              )}
            </For>
          </div>
        </AuthenticatedSettingsRow>
        <AuthenticatedSettingsRow label={messageTranslate("admin.oidc.clients.scopes")}>
          <div class="flex flex-wrap gap-1.5">
            <For each={props.scopesSupported}>
              {(scope) => (
                <label class="flex items-center gap-1.5 rounded-control border border-line-subtle px-2 py-1 text-xs font-medium">
                  <input
                    checked={props.scopes().includes(scope)}
                    class={authenticatedControlClasses.checkbox}
                    onChange={() => props.scopeToggle(scope)}
                    type="checkbox"
                  />
                  <code class="font-mono text-xs">{scope}</code>
                </label>
              )}
            </For>
          </div>
        </AuthenticatedSettingsRow>
      </AuthenticatedSettingsList>
      <h3 class="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {messageTranslate("admin.redesign.consentTrust")}
      </h3>
      <AuthenticatedSettingsList>
        <AuthenticatedSettingsRow label={messageTranslate("admin.oidc.clients.consentOptions")}>
          <div class="grid gap-2">
            <label class="flex min-w-0 items-start gap-2 text-xs font-medium" for={`${props.idPrefix}-require-consent`}>
              <input
                checked={props.requireConsent.get()}
                class={`${authenticatedControlClasses.checkbox} mt-0.5 shrink-0`}
                id={`${props.idPrefix}-require-consent`}
                onChange={(event) => props.requireConsent.set(event.currentTarget.checked)}
                type="checkbox"
              />
              <span class="min-w-0">{messageTranslate("admin.oidc.clients.requireConsent")}</span>
            </label>
            <div class="grid min-w-0 gap-1.5">
              <label class="flex min-w-0 items-start gap-2 text-xs font-medium" for={`${props.idPrefix}-trusted`}>
                <input
                  aria-describedby={`${props.idPrefix}-trusted-hint`}
                  checked={props.trusted.get()}
                  class={`${authenticatedControlClasses.checkbox} mt-0.5 shrink-0`}
                  id={`${props.idPrefix}-trusted`}
                  onChange={(event) => props.trusted.set(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span class="min-w-0">{messageTranslate("admin.oidc.clients.trusted")}</span>
              </label>
              <p class="pl-6 text-xs leading-5 text-muted-foreground" id={`${props.idPrefix}-trusted-hint`}>
                {messageTranslate("admin.oidc.clients.trustedHint")}
              </p>
            </div>
            <div class="grid min-w-0 gap-1.5">
              <label class="flex min-w-0 items-start gap-2 text-xs font-medium" for={`${props.idPrefix}-dev-mode`}>
                <input
                  aria-describedby={`${props.idPrefix}-dev-mode-hint`}
                  checked={props.devMode.get()}
                  class={`${authenticatedControlClasses.checkbox} mt-0.5 shrink-0`}
                  id={`${props.idPrefix}-dev-mode`}
                  onChange={(event) => props.devMode.set(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span class="min-w-0">{messageTranslate("admin.oidc.clients.devMode")}</span>
              </label>
              <p class="pl-6 text-xs leading-5 text-muted-foreground" id={`${props.idPrefix}-dev-mode-hint`}>
                {messageTranslate("admin.oidc.clients.devModeHint")}
              </p>
            </div>
          </div>
        </AuthenticatedSettingsRow>
      </AuthenticatedSettingsList>
    </>
  )
}
