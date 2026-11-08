import { mdiAutorenew } from "@adaptive-ds/mdi/mdiAutorenew.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedCopyableId } from "../../../ui/authenticated/AuthenticatedCopyableId.js"
import { AuthenticatedDetailHeader } from "../../../ui/authenticated/AuthenticatedDetailHeader.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OidcAdminClientFormFields } from "./OidcAdminClientFormFields.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminSecretPanel } from "./OidcAdminSecretPanel.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { oidcAdminClientDetailViewStateCreate } from "./oidcAdminClientDetailViewStateCreate.js"
import { oidcAdminClientStatusTone } from "./oidcAdminClientStatusTone.js"

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
              <AuthenticatedDetailHeader
                backHref="./"
                backLabel={messageTranslate("admin.oidc.clients.backToClients")}
                title={client().name}
                badges={
                  <>
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.oidc.clients.statusValue.${client().status}`)}
                      tone={oidcAdminClientStatusTone(client().status)}
                    />
                    <AuthenticatedStatus
                      label={
                        client().clientType === "public"
                          ? messageTranslate("admin.oidc.clients.typePublic")
                          : messageTranslate("admin.oidc.clients.typeConfidential")
                      }
                      tone="neutral"
                    />
                  </>
                }
                facts={[
                  {
                    label: messageTranslate("admin.oidc.clients.identifier"),
                    value: (
                      <AuthenticatedCopyableId
                        label={messageTranslate("admin.oidc.clients.identifier")}
                        value={client().id}
                      />
                    ),
                  },
                  {
                    label: `${messageTranslate("admin.oidc.clients.project")} / ${messageTranslate("admin.oidc.clients.application")}`,
                    value: `${state.projects().find((item) => item.id === client().projectId)?.name ?? client().projectId ?? "—"} / ${state.applications().find((item) => item.id === client().applicationId)?.name ?? client().applicationId ?? "—"}`,
                  },
                  {
                    label: messageTranslate("admin.oidc.created"),
                    value: <AuthenticatedRelativeTime value={client().createdAt} />,
                  },
                  {
                    label: messageTranslate("admin.oidc.updated"),
                    value: <AuthenticatedRelativeTime value={client().updatedAt} />,
                  },
                ]}
              />

              <div class="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                <AuthenticatedSection title={messageTranslate("admin.oidc.clients.settingsTitle")}>
                  <form class="grid gap-3 px-4 py-3 [&_label.text-sm]:text-[13px]" onSubmit={state.settingsSubmit}>
                    <OidcAdminClientFormFields
                      accessTokenLifetimeSeconds={state.accessTokenLifetimeSeconds}
                      accessTokenRoleAssertion={state.accessTokenRoleAssertion}
                      additionalOrigins={state.additionalOrigins}
                      applicationId={state.applicationId}
                      applications={state.applications}
                      applicationSelect={state.applicationSelect}
                      devMode={state.devMode}
                      grants={state.grants}
                      grantsSupported={state.grantsSupported}
                      grantToggle={state.grantToggle}
                      idPrefix="oidc-detail"
                      idTokenLifetimeSeconds={state.idTokenLifetimeSeconds}
                      idTokenRoleAssertion={state.idTokenRoleAssertion}
                      idTokenUserinfoAssertion={state.idTokenUserinfoAssertion}
                      name={state.name}
                      postLogoutRedirectUris={state.postLogoutRedirectUris}
                      projectId={state.projectId}
                      projects={state.projects}
                      projectSelect={state.projectSelect}
                      redirectUris={state.redirectUris}
                      refreshTokenAbsoluteLifetimeSeconds={state.refreshTokenAbsoluteLifetimeSeconds}
                      refreshTokenIdleLifetimeSeconds={state.refreshTokenIdleLifetimeSeconds}
                      requireConsent={state.requireConsent}
                      responseToggle={state.responseToggle}
                      responses={state.responses}
                      responsesSupported={state.responsesSupported}
                      scopeToggle={state.scopeToggle}
                      scopes={state.scopes}
                      scopesSupported={state.scopesSupported}
                      trusted={state.trusted}
                    />
                    <Show when={state.formError()}>
                      {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                    </Show>
                    <div class="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-line-subtle bg-surface py-2">
                      <AuthenticatedButton
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiContentSave}
                        type="submit"
                        variant="filledBlue"
                      >
                        {messageTranslate("common.save")}
                      </AuthenticatedButton>
                    </div>
                  </form>
                </AuthenticatedSection>

                <aside class="grid min-w-0 gap-3">
                  <AuthenticatedSection padded title={messageTranslate("admin.oidc.secret.credentialsLifecycle")}>
                    <h3 class="text-sm font-semibold">{messageTranslate("admin.oidc.secret.title")}</h3>
                    <Show
                      fallback={
                        <p class="text-xs text-muted-foreground">
                          {messageTranslate("admin.oidc.secret.publicClient")}
                        </p>
                      }
                      when={client().clientType === "confidential"}
                    >
                      <div class="grid gap-2">
                        <p class="text-xs text-muted-foreground">{messageTranslate("admin.oidc.secret.description")}</p>
                        <div class="flex min-w-0 flex-col gap-2">
                          {/* The stored secret is unreadable, so only its redacted placeholder is presented. */}
                          <p
                            class="min-w-0 flex-1 truncate rounded-control border border-line-subtle bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground"
                            data-secret-redacted
                          >
                            {messageTranslate("admin.oidc.secret.redacted")}
                          </p>
                          <div class="flex shrink-0 flex-wrap gap-2">
                            <AuthenticatedButton
                              disabled={state.page.pendingId() !== undefined}
                              icon={mdiAutorenew}
                              onClick={() => void state.page.clientSecretRotate(client().id)}
                              variant="filledBlue"
                            >
                              {messageTranslate("admin.oidc.secret.rotate")}
                            </AuthenticatedButton>
                            <AuthenticatedButton
                              disabled={state.page.pendingId() !== undefined}
                              icon={mdiCancel}
                              onClick={() => void state.page.clientSecretRevoke(client().id)}
                              variant="outlineRed"
                            >
                              {messageTranslate("admin.oidc.secret.revoke")}
                            </AuthenticatedButton>
                          </div>
                        </div>
                      </div>
                    </Show>
                    <div class="mt-3 flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                      <Show when={client().status === "active"}>
                        <AuthenticatedButton
                          disabled={state.page.pendingId() !== undefined}
                          icon={mdiCancel}
                          onClick={() => void state.page.clientLifecycleSet(client().id, "inactive")}
                          type="button"
                          variant="outline"
                        >
                          {messageTranslate("admin.oidc.lifecycle.deactivate")}
                        </AuthenticatedButton>
                      </Show>
                      <Show when={client().status === "inactive"}>
                        <AuthenticatedButton
                          disabled={state.page.pendingId() !== undefined}
                          icon={mdiCheckCircle}
                          onClick={() => void state.page.clientLifecycleSet(client().id, "active")}
                          type="button"
                          variant="outline"
                        >
                          {messageTranslate("admin.oidc.lifecycle.activate")}
                        </AuthenticatedButton>
                      </Show>
                      <AuthenticatedButton
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiDelete}
                        onClick={() => void state.clientRemove(client().id)}
                        type="button"
                        variant="outlineRed"
                      >
                        {messageTranslate("admin.oidc.lifecycle.remove")}
                      </AuthenticatedButton>
                    </div>
                  </AuthenticatedSection>
                </aside>
              </div>
            </div>
          )}
        </Show>
      </OidcAdminStateBoundary>
    </section>
  )
}
