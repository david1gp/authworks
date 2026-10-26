import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
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
  const textareaClass = `${authenticatedControlClasses.textarea} break-all font-mono text-[0.8125rem] leading-5`
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
      <div class="grid items-start gap-4 sm:grid-cols-2 [&_label]:text-[0.8125rem] [&_label]:font-medium">
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-name`}>{messageTranslate("admin.oidc.clients.name")}</Label>
          <AuthenticatedInput
            id={`${props.idPrefix}-name`}
            onInput={(event) => props.name.set(event.currentTarget.value)}
            value={props.name.get()}
          />
        </div>
        <Show when={props.clientType}>
          {(clientType) => (
            <div class="grid min-w-0 gap-1.5">
              <Label for={`${props.idPrefix}-type`}>{messageTranslate("admin.oidc.clients.type")}</Label>
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
              <p class="text-xs leading-5 text-muted-foreground">{messageTranslate("admin.oidc.clients.typeHint")}</p>
            </div>
          )}
        </Show>
      </div>

      <div class="grid items-start gap-4 border-t border-line-subtle pt-4 sm:grid-cols-2 [&_label]:text-[0.8125rem] [&_label]:font-medium">
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-project`}>{messageTranslate("admin.oidc.clients.project")}</Label>
          <AuthenticatedSelect
            getOptions={() => ["", ...props.projects().map((project) => project.id)]}
            id={`${props.idPrefix}-project`}
            valueSignal={{ get: props.projectId.get, set: (next: string) => props.projectSelect(next) }}
            valueText={projectName}
          />
        </div>
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-application`}>{messageTranslate("admin.oidc.clients.application")}</Label>
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
        </div>
      </div>

      {/* Exact URIs get the full form width, with monospace and wrapping preserved. */}
      <div class="grid gap-4 border-t border-line-subtle pt-4 [&_label]:text-[0.8125rem] [&_label]:font-medium">
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-redirects`}>{messageTranslate("admin.oidc.clients.redirectUris")}</Label>
          <textarea
            class={textareaClass}
            id={`${props.idPrefix}-redirects`}
            onInput={(event) => props.redirectUris.set(event.currentTarget.value)}
            rows={4}
            value={props.redirectUris.get()}
          />
          <p class="text-xs leading-5 text-muted-foreground">{messageTranslate("admin.oidc.clients.exactMatchHint")}</p>
        </div>
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-post-logout`}>{messageTranslate("admin.oidc.clients.postLogoutUris")}</Label>
          <textarea
            class={textareaClass}
            id={`${props.idPrefix}-post-logout`}
            onInput={(event) => props.postLogoutRedirectUris.set(event.currentTarget.value)}
            rows={4}
            value={props.postLogoutRedirectUris.get()}
          />
        </div>
      </div>

      <fieldset class="grid min-w-0 gap-4 border-t border-line-subtle pt-4">
        <legend class="text-xs font-medium text-muted-foreground">
          {messageTranslate("admin.oidc.clients.compatibility")}
        </legend>
        <div class="grid gap-1.5 sm:grid-cols-2">
          <div class="grid min-w-0 gap-1.5">
            <label
              class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
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
            <p class="text-xs leading-5 text-muted-foreground">
              {messageTranslate("admin.oidc.clients.idTokenUserinfoAssertionHint")}
            </p>
          </div>
          <div class="grid min-w-0 gap-1.5">
            <label
              class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
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
            <p class="text-xs leading-5 text-muted-foreground">
              {messageTranslate("admin.oidc.clients.accessTokenRoleAssertionHint")}
            </p>
          </div>
          <div class="grid min-w-0 gap-1.5">
            <label
              class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
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
            <p class="text-xs leading-5 text-muted-foreground">
              {messageTranslate("admin.oidc.clients.idTokenRoleAssertionHint")}
            </p>
          </div>
        </div>
        <div class="grid min-w-0 gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for={`${props.idPrefix}-additional-origins`}>
            {messageTranslate("admin.oidc.clients.additionalOrigins")}
          </Label>
          <textarea
            class={textareaClass}
            id={`${props.idPrefix}-additional-origins`}
            onInput={(event) => props.additionalOrigins.set(event.currentTarget.value)}
            rows={3}
            value={props.additionalOrigins.get()}
          />
          <p class="text-xs leading-5 text-muted-foreground">
            {messageTranslate("admin.oidc.clients.additionalOriginsHint")}
          </p>
        </div>
      </fieldset>

      <div class="grid items-start gap-4 border-t border-line-subtle pt-4 sm:grid-cols-2 [&_label]:text-[0.8125rem] [&_label]:font-medium">
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-access-lifetime`}>
            {messageTranslate("admin.oidc.clients.accessTokenLifetime")}
          </Label>
          <AuthenticatedInput
            id={`${props.idPrefix}-access-lifetime`}
            inputMode="numeric"
            onInput={(event) => props.accessTokenLifetimeSeconds.set(event.currentTarget.value)}
            value={props.accessTokenLifetimeSeconds.get()}
          />
        </div>
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-id-token-lifetime`}>
            {messageTranslate("admin.oidc.clients.idTokenLifetime")}
          </Label>
          <AuthenticatedInput
            id={`${props.idPrefix}-id-token-lifetime`}
            inputMode="numeric"
            onInput={(event) => props.idTokenLifetimeSeconds.set(event.currentTarget.value)}
            value={props.idTokenLifetimeSeconds.get()}
          />
        </div>
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-refresh-idle-lifetime`}>
            {messageTranslate("admin.oidc.clients.refreshTokenIdleLifetime")}
          </Label>
          <AuthenticatedInput
            id={`${props.idPrefix}-refresh-idle-lifetime`}
            inputMode="numeric"
            onInput={(event) => props.refreshTokenIdleLifetimeSeconds.set(event.currentTarget.value)}
            value={props.refreshTokenIdleLifetimeSeconds.get()}
          />
        </div>
        <div class="grid min-w-0 gap-1.5">
          <Label for={`${props.idPrefix}-refresh-absolute-lifetime`}>
            {messageTranslate("admin.oidc.clients.refreshTokenAbsoluteLifetime")}
          </Label>
          <AuthenticatedInput
            id={`${props.idPrefix}-refresh-absolute-lifetime`}
            inputMode="numeric"
            onInput={(event) => props.refreshTokenAbsoluteLifetimeSeconds.set(event.currentTarget.value)}
            value={props.refreshTokenAbsoluteLifetimeSeconds.get()}
          />
        </div>
        <p class="text-xs leading-5 text-muted-foreground sm:col-span-2">
          {messageTranslate("admin.oidc.clients.lifetimeHint")}
        </p>
      </div>

      <fieldset class="grid min-w-0 gap-3 border-t border-line-subtle pt-4">
        <legend class="text-xs font-medium text-muted-foreground">
          {messageTranslate("admin.oidc.clients.grantTypes")}
        </legend>
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
      </fieldset>

      <fieldset class="grid min-w-0 gap-3 border-t border-line-subtle pt-4">
        <legend class="text-xs font-medium text-muted-foreground">
          {messageTranslate("admin.oidc.clients.responseTypes")}
        </legend>
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
      </fieldset>

      <fieldset class="grid min-w-0 gap-3 border-t border-line-subtle pt-4">
        <legend class="text-xs font-medium text-muted-foreground">
          {messageTranslate("admin.oidc.clients.scopes")}
        </legend>
        {/* Scopes are short tokens, so they wrap as compact chips instead of one row each. */}
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
      </fieldset>

      <div class="grid items-start gap-3 border-t border-line-subtle pt-4 sm:grid-cols-2">
        <label
          class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
          for={`${props.idPrefix}-require-consent`}
        >
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
          <label
            class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
            for={`${props.idPrefix}-trusted`}
          >
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
          <p class="text-xs leading-5 text-muted-foreground" id={`${props.idPrefix}-trusted-hint`}>
            {messageTranslate("admin.oidc.clients.trustedHint")}
          </p>
        </div>
        <div class="grid min-w-0 gap-1.5">
          <label
            class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
            for={`${props.idPrefix}-dev-mode`}
          >
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
          <p class="text-xs leading-5 text-muted-foreground" id={`${props.idPrefix}-dev-mode-hint`}>
            {messageTranslate("admin.oidc.clients.devModeHint")}
          </p>
        </div>
      </div>
    </>
  )
}
