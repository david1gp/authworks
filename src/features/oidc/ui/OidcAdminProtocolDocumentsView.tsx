import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import { oidcAdminDocumentCopyStateCreate } from "./oidcAdminDocumentCopyStateCreate.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"

/**
 * Discovery and JWKS are protocol-owned documents. This page is explicitly read-only:
 * it offers viewing and copying only, and exposes no edit or delete control.
 */
export function OidcAdminProtocolDocumentsView(props: { readonly state: OidcAdminPageState }) {
  const state = props.state
  const copyState = oidcAdminDocumentCopyStateCreate({})
  const discoveryJson = () => JSON.stringify(state.discovery() ?? {}, null, 2)
  const jwksJson = () => JSON.stringify(state.jwks() ?? {}, null, 2)

  return (
    <section class="grid min-w-0 gap-6">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.oidc.documents.title")}</h2>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {messageTranslate("admin.oidc.documents.description")}
        </p>
      </div>

      <p class="rounded-lg border border-line bg-muted px-4 py-3 text-sm text-muted-foreground" data-read-only-notice>
        {messageTranslate("admin.oidc.documents.readOnly")}
      </p>

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.documents.empty")}
        error={state.error()}
        onRetry={state.reload}
        status={state.status()}
      >
        <div class="grid min-w-0 gap-6">
          <Show when={state.discovery()}>
            {(discovery) => (
              <CardWrapper class="min-w-0">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 class="text-xl font-semibold">{messageTranslate("admin.oidc.documents.discoveryTitle")}</h3>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {messageTranslate("admin.oidc.documents.discoveryDescription")}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Button onClick={() => copyState.copy("discovery", discoveryJson())} variant="outline">
                      {messageTranslate("admin.oidc.documents.copy")}
                    </Button>
                    <a
                      class="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-hover"
                      href={`${discovery().issuer}/.well-known/openid-configuration`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {messageTranslate("admin.oidc.documents.open")}
                    </a>
                    <Show when={copyState.copied("discovery")}>
                      <span class="text-sm font-medium text-green-800" role="status">
                        {messageTranslate("admin.oidc.documents.copied")}
                      </span>
                    </Show>
                  </div>
                </div>
                <dl class="mt-4 grid gap-3 sm:grid-cols-2">
                  <For
                    each={[
                      {
                        key: "issuer",
                        label: messageTranslate("admin.oidc.documents.issuer"),
                        value: discovery().issuer,
                      },
                      {
                        key: "authorization",
                        label: messageTranslate("admin.oidc.documents.authorizationEndpoint"),
                        value: discovery().authorization_endpoint,
                      },
                      {
                        key: "token",
                        label: messageTranslate("admin.oidc.documents.tokenEndpoint"),
                        value: discovery().token_endpoint,
                      },
                      {
                        key: "userinfo",
                        label: messageTranslate("admin.oidc.documents.userinfoEndpoint"),
                        value: discovery().userinfo_endpoint,
                      },
                      {
                        key: "jwks",
                        label: messageTranslate("admin.oidc.documents.jwksUri"),
                        value: discovery().jwks_uri,
                      },
                      {
                        key: "endSession",
                        label: messageTranslate("admin.oidc.documents.endSessionEndpoint"),
                        value: discovery().end_session_endpoint,
                      },
                    ]}
                  >
                    {(entry) => (
                      <div>
                        <dt class="text-sm text-muted-foreground">{entry.label}</dt>
                        <dd class="mt-1 break-all font-mono text-xs">{entry.value}</dd>
                      </div>
                    )}
                  </For>
                </dl>
                <details class="mt-4 min-w-0">
                  <summary class="cursor-pointer text-sm font-medium">
                    {messageTranslate("admin.oidc.documents.showRaw")}
                  </summary>
                  <pre class="mt-3 w-full overflow-x-auto whitespace-pre rounded-lg bg-muted p-3 text-xs">
                    {discoveryJson()}
                  </pre>
                </details>
              </CardWrapper>
            )}
          </Show>

          <Show when={state.jwks()}>
            {(jwks) => (
              <CardWrapper class="min-w-0">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 class="text-xl font-semibold">{messageTranslate("admin.oidc.documents.jwksTitle")}</h3>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {messageTranslate("admin.oidc.documents.jwksDescription")}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Button onClick={() => copyState.copy("jwks", jwksJson())} variant="outline">
                      {messageTranslate("admin.oidc.documents.copy")}
                    </Button>
                    <Show when={state.discovery()}>
                      {(discovery) => (
                        <a
                          class="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-hover"
                          href={discovery().jwks_uri}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {messageTranslate("admin.oidc.documents.open")}
                        </a>
                      )}
                    </Show>
                    <Show when={copyState.copied("jwks")}>
                      <span class="text-sm font-medium text-green-800" role="status">
                        {messageTranslate("admin.oidc.documents.copied")}
                      </span>
                    </Show>
                  </div>
                </div>
                <ul class="mt-4 grid gap-2">
                  <For each={jwks().keys}>
                    {(key) => (
                      <li class="rounded-lg border border-line px-3 py-2">
                        <span class="font-mono text-xs">{key.kid}</span>
                        <span class="ml-3 text-xs text-muted-foreground">{key.alg}</span>
                      </li>
                    )}
                  </For>
                </ul>
                <details class="mt-4 min-w-0">
                  <summary class="cursor-pointer text-sm font-medium">
                    {messageTranslate("admin.oidc.documents.showRaw")}
                  </summary>
                  <pre class="mt-3 w-full overflow-x-auto whitespace-pre rounded-lg bg-muted p-3 text-xs">
                    {jwksJson()}
                  </pre>
                </details>
              </CardWrapper>
            )}
          </Show>
        </div>
      </OidcAdminStateBoundary>
    </section>
  )
}
