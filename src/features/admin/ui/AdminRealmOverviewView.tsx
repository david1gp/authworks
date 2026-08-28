import { For, Show } from "solid-js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

/** Read-only overview of the current realm identity, domains, lifecycle, and admin session. */
export function AdminRealmOverviewView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.overview.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <Show
        when={props.state.status() === "ready" && props.state.realm()}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "permission-denied"
                ? messageTranslate("admin.realm.permissionDenied")
                : props.state.error()
            }
            onRetry={props.state.status() === "error" ? props.state.reload : undefined}
            state={adminViewStatusPanelState(props.state.status())}
            title={props.state.status() === "expired" ? messageTranslate("admin.session.expired") : undefined}
          />
        }
      >
        {(realm) => (
          <>
            <AuthenticatedSection
              actions={
                <AuthenticatedStatus
                  label={
                    realm().status === "active"
                      ? messageTranslate("admin.realm.statusActive")
                      : messageTranslate("admin.realm.statusDisabled")
                  }
                  tone={realm().status === "active" ? "success" : "danger"}
                />
              }
              description={messageTranslate("admin.overview.description")}
              padded
              title={realm().name}
            >
              <AuthenticatedFieldList
                columns={3}
                fields={[
                  { identifier: true, label: messageTranslate("admin.realm.identifier"), value: realm().id },
                  { label: messageTranslate("admin.realm.primaryDomain"), value: realm().domain },
                  {
                    label: messageTranslate("admin.realm.created"),
                    value: localeDateFormat(realm().createdAt, { dateStyle: "medium" }),
                  },
                ]}
              />
            </AuthenticatedSection>

            <div class="grid min-w-0 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              <AuthenticatedSection title={messageTranslate("admin.realm.domains")}>
                <ul class="divide-y divide-line-subtle">
                  <For each={realm().domains}>
                    {(domain) => (
                      <li class="truncate px-3 py-1.5 font-mono text-xs text-muted-foreground" title={domain}>
                        {domain}
                      </li>
                    )}
                  </For>
                </ul>
              </AuthenticatedSection>

              <Show when={props.state.session()}>
                {(session) => (
                  <AuthenticatedSection padded title={messageTranslate("admin.overview.sessionTitle")}>
                    <AuthenticatedFieldList
                      fields={[
                        {
                          identifier: true,
                          label: messageTranslate("admin.signIn.subject"),
                          value: session().subjectId,
                        },
                        {
                          label: messageTranslate("admin.signIn.subjectType"),
                          value: session().subjectType,
                        },
                        {
                          label: messageTranslate("admin.users.sessions.expires"),
                          value: localeDateFormat(session().expiresAt, { dateStyle: "medium", timeStyle: "short" }),
                          wide: true,
                        },
                      ]}
                    />
                  </AuthenticatedSection>
                )}
              </Show>
            </div>
          </>
        )}
      </Show>
    </section>
  )
}
