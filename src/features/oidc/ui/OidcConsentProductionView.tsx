import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { For, Match, Show, Switch } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginNoticePanel } from "../../login/ui/LoginNoticePanel.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import type { OidcConsentProductionState } from "./oidcConsentProductionStateCreate.js"

/** Renders the production application-consent request inside either the login frame or the focus shell. */
export function OidcConsentProductionView(props: { readonly state: OidcConsentProductionState }) {
  const state = props.state
  return (
    <Switch>
      <Match when={state.status() === "loading"}>
        <div class="grid justify-items-center gap-4 py-10" role="status">
          <LoaderShuffle4Dots />
          <p class="text-base font-medium">{messageTranslate("common.loading")}</p>
        </div>
      </Match>
      <Match when={state.status() === "missing"}>
        <LoginNoticePanel
          actionLabel={messageTranslate("common.signIn")}
          description={messageTranslate("oidc.consent.missingDescription")}
          kind="error"
          onAction={state.signIn}
          title={messageTranslate("oidc.consent.missingTitle")}
        />
      </Match>
      <Match when={state.status() === "unauthenticated"}>
        <LoginNoticePanel
          actionLabel={messageTranslate("common.signIn")}
          description={messageTranslate("oidc.consent.signInDescription")}
          kind="error"
          onAction={state.signIn}
          title={messageTranslate("oidc.consent.signInTitle")}
        />
      </Match>
      <Match when={state.status() === "invalid"}>
        <LoginNoticePanel
          actionLabel={messageTranslate("common.signIn")}
          description={messageTranslate("oidc.consent.expiredDescription")}
          kind="error"
          onAction={state.signIn}
          title={messageTranslate("oidc.consent.expiredTitle")}
        />
      </Match>
      <Match when={state.status() === "ready"}>
        <Show when={state.details()}>
          {(loaded) => (
            <section aria-labelledby="consent-title">
              <LoginPanelHeader
                description={messageTranslate("oidc.consent.description", { client: loaded().client_name })}
                headingId="consent-title"
                title={loaded().client_name}
              />
              <div class="mt-6 grid gap-5">
                <div class="grid gap-2">
                  <h2 class="text-sm font-semibold">{messageTranslate("oidc.consent.scopeTitle")}</h2>
                  <ul aria-label={messageTranslate("oidc.consent.scopeTitle")} class="flex flex-wrap gap-1.5">
                    <For each={state.scopes()}>
                      {(scope) => <li class="rounded-control bg-muted px-2 py-1 font-mono text-xs">{scope.label}</li>}
                    </For>
                  </ul>
                </div>
                <dl class="grid gap-2 text-xs">
                  <div>
                    <dt class="font-semibold text-muted-foreground">{messageTranslate("oidc.consent.clientId")}</dt>
                    <dd class="font-mono">{loaded().client_id}</dd>
                  </div>
                  <div>
                    <dt class="font-semibold text-muted-foreground">{messageTranslate("oidc.consent.redirectUri")}</dt>
                    <dd class="break-all font-mono">{loaded().redirect_uri}</dd>
                  </div>
                </dl>
                <p class="text-xs text-muted-foreground">
                  {messageTranslate("oidc.consent.redirectDescription", { redirectUri: loaded().redirect_uri })}
                </p>
                <div class="grid gap-2">
                  <LoginSubmitButton
                    disabled={state.deciding() !== undefined}
                    icon={mdiCheckCircle}
                    label={messageTranslate("oidc.consent.approve")}
                    onClick={() => void state.approve()}
                    pending={state.deciding() === "approve"}
                    pendingLabel={messageTranslate("oidc.consent.approving")}
                    type="button"
                  />
                  <Button
                    class="w-full"
                    disabled={state.deciding() !== undefined}
                    onClick={() => void state.deny()}
                    type="button"
                    variant="outline"
                  >
                    {state.deciding() === "deny"
                      ? messageTranslate("oidc.consent.denying")
                      : messageTranslate("oidc.consent.deny")}
                  </Button>
                </div>
              </div>
            </section>
          )}
        </Show>
      </Match>
    </Switch>
  )
}
