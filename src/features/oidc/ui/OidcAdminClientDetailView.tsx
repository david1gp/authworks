import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminSecretPanel } from "./OidcAdminSecretPanel.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { oidcAdminClientDetailViewStateCreate } from "./oidcAdminClientDetailViewStateCreate.js"
import { oidcClientStatusBadgeVariant } from "./oidcClientStatusBadgeVariant.js"

export function OidcAdminClientDetailView(props: {
  readonly state: ReturnType<typeof oidcAdminClientDetailViewStateCreate>
}) {
  const state = props.state
  return (
    <section class="grid min-w-0 gap-6">
      {/* The page heading stays outside the data boundary, so every fixture state has one h1. */}
      <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.oidc.clients.detailTitle")}</h1>
      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.clients.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <Show when={state.page.client()}>
          {(client) => (
            <section class="grid min-w-0 gap-6">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 class="break-words text-2xl font-semibold tracking-tight">{client().name}</h2>
                  <p class="mt-1 font-mono text-xs text-muted-foreground">{client().id}</p>
                </div>
                <Badge variant={oidcClientStatusBadgeVariant(client().status)}>{client().status}</Badge>
              </div>

              <OidcAdminNotice notice={state.page.notice()} />
              <Show when={state.page.issuedSecret()}>
                {(issued) => (
                  <OidcAdminSecretPanel
                    clientName={issued().clientName}
                    kind={issued().kind}
                    onAcknowledge={state.page.issuedSecretAcknowledge}
                    secret={issued().secret}
                  />
                )}
              </Show>

              <CardWrapper>
                <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailItem
                    label={messageTranslate("admin.oidc.clients.type")}
                    value={
                      client().clientType === "public"
                        ? messageTranslate("admin.oidc.clients.typePublic")
                        : messageTranslate("admin.oidc.clients.typeConfidential")
                    }
                  />
                  <DetailItem
                    label={messageTranslate("admin.oidc.created")}
                    value={localeDateFormat(client().createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                  <DetailItem
                    label={messageTranslate("admin.oidc.updated")}
                    value={localeDateFormat(client().updatedAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                  <DetailItem label={messageTranslate("admin.oidc.status")} value={client().status} />
                </dl>
              </CardWrapper>

              <CardWrapper>
                <h3 class="text-xl font-semibold">{messageTranslate("admin.oidc.clients.settingsTitle")}</h3>
                <p class="mt-1 text-sm text-muted-foreground">
                  {messageTranslate("admin.oidc.clients.settingsDescription")}
                </p>
                <form class="mt-5 grid max-w-2xl gap-4" onSubmit={state.settingsSubmit}>
                  <div class="grid gap-2">
                    <Label for="oidc-detail-name">{messageTranslate("admin.oidc.clients.name")}</Label>
                    <Input
                      id="oidc-detail-name"
                      onInput={(event) => state.name.set(event.currentTarget.value)}
                      value={state.name.get()}
                    />
                  </div>
                  <div class="grid gap-2">
                    <Label for="oidc-detail-redirects">{messageTranslate("admin.oidc.clients.redirectUris")}</Label>
                    <textarea
                      class="min-h-24 w-full break-all rounded-lg border border-line bg-surface p-2.5 font-mono text-sm"
                      id="oidc-detail-redirects"
                      onInput={(event) => state.redirectUris.set(event.currentTarget.value)}
                      value={state.redirectUris.get()}
                    />
                    <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.clients.exactMatchHint")}</p>
                  </div>
                  <div class="grid gap-2">
                    <Label for="oidc-detail-post-logout">{messageTranslate("admin.oidc.clients.postLogoutUris")}</Label>
                    <textarea
                      class="min-h-16 w-full break-all rounded-lg border border-line bg-surface p-2.5 font-mono text-sm"
                      id="oidc-detail-post-logout"
                      onInput={(event) => state.postLogoutRedirectUris.set(event.currentTarget.value)}
                      value={state.postLogoutRedirectUris.get()}
                    />
                  </div>
                  <fieldset class="grid gap-2">
                    <legend class="text-sm font-medium">{messageTranslate("admin.oidc.clients.scopes")}</legend>
                    <For each={state.scopesSupported}>
                      {(scope) => (
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            checked={state.scopes().includes(scope)}
                            onChange={() => state.scopeToggle(scope)}
                            type="checkbox"
                          />
                          <code class="min-w-0 break-all text-xs">{scope}</code>
                        </label>
                      )}
                    </For>
                  </fieldset>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      checked={state.requireConsent.get()}
                      onChange={(event) => state.requireConsent.set(event.currentTarget.checked)}
                      type="checkbox"
                    />
                    <span>{messageTranslate("admin.oidc.clients.requireConsent")}</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      checked={state.trusted.get()}
                      onChange={(event) => state.trusted.set(event.currentTarget.checked)}
                      type="checkbox"
                    />
                    <span>{messageTranslate("admin.oidc.clients.trusted")}</span>
                  </label>
                  <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.clients.trustedHint")}</p>
                  <Show when={state.formError()}>
                    {(message) => (
                      <p class="text-sm text-danger" role="alert">
                        {message()}
                      </p>
                    )}
                  </Show>
                  <div class="flex flex-wrap gap-2">
                    <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                      {messageTranslate("common.save")}
                    </Button>
                    <Show when={client().status === "active"}>
                      <Button
                        disabled={state.page.pendingId() !== undefined}
                        onClick={() => void state.page.clientLifecycleSet(client().id, "inactive")}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("admin.oidc.lifecycle.deactivate")}
                      </Button>
                    </Show>
                    <Show when={client().status === "inactive"}>
                      <Button
                        disabled={state.page.pendingId() !== undefined}
                        onClick={() => void state.page.clientLifecycleSet(client().id, "active")}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("admin.oidc.lifecycle.activate")}
                      </Button>
                    </Show>
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => void state.clientRemove(client().id)}
                      type="button"
                      variant="filledRed"
                    >
                      {messageTranslate("admin.oidc.lifecycle.remove")}
                    </Button>
                  </div>
                </form>
              </CardWrapper>

              <CardWrapper>
                <h3 class="text-xl font-semibold">{messageTranslate("admin.oidc.secret.title")}</h3>
                <Show
                  when={client().clientType === "confidential"}
                  fallback={
                    <p class="mt-2 text-sm text-muted-foreground">
                      {messageTranslate("admin.oidc.secret.publicClient")}
                    </p>
                  }
                >
                  <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {messageTranslate("admin.oidc.secret.description")}
                  </p>
                  <p
                    class="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-sm text-muted-foreground"
                    data-secret-redacted
                  >
                    {messageTranslate("admin.oidc.secret.redacted")}
                  </p>
                  <div class="mt-5 flex flex-wrap gap-2">
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => void state.page.clientSecretRotate(client().id)}
                      variant="filledBlue"
                    >
                      {messageTranslate("admin.oidc.secret.rotate")}
                    </Button>
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => void state.page.clientSecretRevoke(client().id)}
                      variant="filledRed"
                    >
                      {messageTranslate("admin.oidc.secret.revoke")}
                    </Button>
                  </div>
                </Show>
              </CardWrapper>
            </section>
          )}
        </Show>
      </OidcAdminStateBoundary>
    </section>
  )
}

function DetailItem(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all text-sm">{props.value}</dd>
    </div>
  )
}
