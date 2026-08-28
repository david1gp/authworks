import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminClientFormFields } from "./OidcAdminClientFormFields.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminSecretPanel } from "./OidcAdminSecretPanel.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import { oidcAdminClientStatusTone } from "./oidcAdminClientStatusTone.js"
import type { oidcAdminClientDetailViewStateCreate } from "./oidcAdminClientDetailViewStateCreate.js"

export function OidcAdminClientDetailView(props: {
  readonly state: ReturnType<typeof oidcAdminClientDetailViewStateCreate>
}) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.oidc.clients.detailTitle")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
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

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.clients.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <Show when={state.page.client()}>
          {(client) => (
            <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
              <AuthenticatedSection
                actions={
                  <AuthenticatedStatus
                    label={messageTranslate(`admin.oidc.clients.statusValue.${client().status}`)}
                    tone={oidcAdminClientStatusTone(client().status)}
                  />
                }
                padded
                title={client().name}
              >
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    {
                      identifier: true,
                      label: messageTranslate("admin.oidc.clients.identifier"),
                      value: client().id,
                    },
                    {
                      label: messageTranslate("admin.oidc.clients.type"),
                      value:
                        client().clientType === "public"
                          ? messageTranslate("admin.oidc.clients.typePublic")
                          : messageTranslate("admin.oidc.clients.typeConfidential"),
                    },
                    {
                      label: messageTranslate("admin.oidc.created"),
                      value: localeDateFormat(client().createdAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                    {
                      label: messageTranslate("admin.oidc.updated"),
                      value: localeDateFormat(client().updatedAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                  ]}
                />
              </AuthenticatedSection>

              <AuthenticatedSection
                description={messageTranslate("admin.oidc.clients.settingsDescription")}
                title={messageTranslate("admin.oidc.clients.settingsTitle")}
              >
                <form class="grid gap-3 px-3 py-3" onSubmit={state.settingsSubmit}>
                  <OidcAdminClientFormFields
                    idPrefix="oidc-detail"
                    name={state.name}
                    postLogoutRedirectUris={state.postLogoutRedirectUris}
                    redirectUris={state.redirectUris}
                    requireConsent={state.requireConsent}
                    scopeToggle={state.scopeToggle}
                    scopes={state.scopes}
                    scopesSupported={state.scopesSupported}
                    trusted={state.trusted}
                  />
                  <Show when={state.formError()}>
                    {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                  </Show>
                  <div class="flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      size="sm"
                      type="submit"
                      variant="filledBlue"
                    >
                      {messageTranslate("common.save")}
                    </Button>
                    <Show when={client().status === "active"}>
                      <Button
                        disabled={state.page.pendingId() !== undefined}
                        onClick={() => void state.page.clientLifecycleSet(client().id, "inactive")}
                        size="sm"
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
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("admin.oidc.lifecycle.activate")}
                      </Button>
                    </Show>
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => void state.clientRemove(client().id)}
                      size="sm"
                      type="button"
                      variant="filledRed"
                    >
                      {messageTranslate("admin.oidc.lifecycle.remove")}
                    </Button>
                  </div>
                </form>
              </AuthenticatedSection>

              <AuthenticatedSection padded title={messageTranslate("admin.oidc.secret.title")}>
                <Show
                  fallback={
                    <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.secret.publicClient")}</p>
                  }
                  when={client().clientType === "confidential"}
                >
                  <div class="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div class="grid min-w-0 gap-1.5">
                      <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.secret.description")}</p>
                      {/* The stored secret is unreadable, so only its redacted placeholder is presented. */}
                      <p
                        class="min-w-0 truncate rounded-control border border-line-subtle bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground"
                        data-secret-redacted
                      >
                        {messageTranslate("admin.oidc.secret.redacted")}
                      </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <Button
                        disabled={state.page.pendingId() !== undefined}
                        onClick={() => void state.page.clientSecretRotate(client().id)}
                        size="sm"
                        variant="filledBlue"
                      >
                        {messageTranslate("admin.oidc.secret.rotate")}
                      </Button>
                      <Button
                        disabled={state.page.pendingId() !== undefined}
                        onClick={() => void state.page.clientSecretRevoke(client().id)}
                        size="sm"
                        variant="filledRed"
                      >
                        {messageTranslate("admin.oidc.secret.revoke")}
                      </Button>
                    </div>
                  </div>
                </Show>
              </AuthenticatedSection>
            </div>
          )}
        </Show>
      </OidcAdminStateBoundary>
    </section>
  )
}
