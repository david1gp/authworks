import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/**
 * The client fields shared by registration and settings. Registration also chooses a client type,
 * which is immutable afterwards, so that control is only rendered when a type signal is supplied.
 */
export function OidcAdminClientFormFields(props: {
  readonly clientType?: SignalObject<string>
  readonly idPrefix: string
  readonly name: SignalObject<string>
  readonly postLogoutRedirectUris: SignalObject<string>
  readonly redirectUris: SignalObject<string>
  readonly requireConsent: SignalObject<boolean>
  readonly scopeToggle: (scope: string) => void
  readonly scopes: () => readonly string[]
  readonly scopesSupported: readonly string[]
  readonly trusted: SignalObject<boolean>
}) {
  const textareaClass =
    "min-h-16 w-full break-all rounded-control border border-line bg-surface px-2 py-1.5 font-mono text-xs leading-5"
  return (
    <>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="grid min-w-0 gap-1">
          <Label for={`${props.idPrefix}-name`}>{messageTranslate("admin.oidc.clients.name")}</Label>
          <Input
            id={`${props.idPrefix}-name`}
            onInput={(event) => props.name.set(event.currentTarget.value)}
            value={props.name.get()}
          />
        </div>
        <Show when={props.clientType}>
          {(clientType) => (
            <div class="grid min-w-0 gap-1">
              <Label for={`${props.idPrefix}-type`}>{messageTranslate("admin.oidc.clients.type")}</Label>
              <SelectSingleNative
                getOptions={() => ["confidential", "public"]}
                id={`${props.idPrefix}-type`}
                valueSignal={clientType()}
                valueText={(type) =>
                  type === "public"
                    ? messageTranslate("admin.oidc.clients.typePublic")
                    : messageTranslate("admin.oidc.clients.typeConfidential")
                }
              />
              <p class="text-2xs leading-4 text-muted-foreground">{messageTranslate("admin.oidc.clients.typeHint")}</p>
            </div>
          )}
        </Show>
      </div>

      {/* Exact URIs are long, so both lists sit side by side in monospace with wrapping preserved. */}
      <div class="grid gap-3 lg:grid-cols-2">
        <div class="grid min-w-0 gap-1">
          <Label for={`${props.idPrefix}-redirects`}>{messageTranslate("admin.oidc.clients.redirectUris")}</Label>
          <textarea
            class={textareaClass}
            id={`${props.idPrefix}-redirects`}
            onInput={(event) => props.redirectUris.set(event.currentTarget.value)}
            rows={4}
            value={props.redirectUris.get()}
          />
          <p class="text-2xs leading-4 text-muted-foreground">
            {messageTranslate("admin.oidc.clients.exactMatchHint")}
          </p>
        </div>
        <div class="grid min-w-0 gap-1">
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

      <fieldset class="grid min-w-0 gap-1.5">
        <legend class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
          {messageTranslate("admin.oidc.clients.scopes")}
        </legend>
        {/* Scopes are short tokens, so they wrap as compact chips instead of one row each. */}
        <div class="flex flex-wrap gap-1.5">
          <For each={props.scopesSupported}>
            {(scope) => (
              <label class="flex items-center gap-1.5 rounded-control border border-line-subtle px-2 py-1 text-xs font-medium">
                <input
                  checked={props.scopes().includes(scope)}
                  class="size-3.5"
                  onChange={() => props.scopeToggle(scope)}
                  type="checkbox"
                />
                <code class="font-mono text-xs">{scope}</code>
              </label>
            )}
          </For>
        </div>
      </fieldset>

      <div class="grid gap-1.5 sm:grid-cols-2">
        <label
          class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
          for={`${props.idPrefix}-require-consent`}
        >
          <input
            checked={props.requireConsent.get()}
            class="mt-0.5 size-3.5 shrink-0"
            id={`${props.idPrefix}-require-consent`}
            onChange={(event) => props.requireConsent.set(event.currentTarget.checked)}
            type="checkbox"
          />
          <span class="min-w-0">{messageTranslate("admin.oidc.clients.requireConsent")}</span>
        </label>
        <label
          class="flex min-w-0 items-start gap-2 rounded-control border border-line-subtle px-2 py-1.5 text-xs font-medium"
          for={`${props.idPrefix}-trusted`}
        >
          <input
            checked={props.trusted.get()}
            class="mt-0.5 size-3.5 shrink-0"
            id={`${props.idPrefix}-trusted`}
            onChange={(event) => props.trusted.set(event.currentTarget.checked)}
            type="checkbox"
          />
          <span class="min-w-0">{messageTranslate("admin.oidc.clients.trusted")}</span>
        </label>
      </div>
      {/* The trust warning stays outside the label so the checkbox keeps its short accessible name. */}
      <p class="text-2xs leading-4 text-muted-foreground">{messageTranslate("admin.oidc.clients.trustedHint")}</p>
    </>
  )
}
