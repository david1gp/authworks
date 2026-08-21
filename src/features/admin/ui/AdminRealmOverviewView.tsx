import { For, Show } from "solid-js"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"

/** Read-only overview of the current realm identity, domains, lifecycle, and admin session. */
export function AdminRealmOverviewView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.overview.title")} class="grid gap-5">
      <p class="max-w-2xl text-sm leading-6 text-muted-foreground">{messageTranslate("admin.overview.description")}</p>

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
            state={
              props.state.status() === "loading"
                ? "loading"
                : props.state.status() === "permission-denied" || props.state.status() === "expired"
                  ? "inaccessible"
                  : "error"
            }
            title={props.state.status() === "expired" ? messageTranslate("admin.session.expired") : undefined}
          />
        }
      >
        {(realm) => (
          <>
            <header class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 class="text-2xl font-semibold tracking-tight">{realm().name}</h2>
                  <p class="mt-1 font-mono text-xs break-all text-muted-foreground">{realm().id}</p>
                </div>
                <Badge variant={realm().status === "active" ? "filledGreen" : "filledRed"}>
                  {realm().status === "active"
                    ? messageTranslate("admin.realm.statusActive")
                    : messageTranslate("admin.realm.statusDisabled")}
                </Badge>
              </div>
              <dl class="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {messageTranslate("admin.realm.primaryDomain")}
                  </dt>
                  <dd class="mt-1 break-all font-medium">{realm().domain}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {messageTranslate("admin.realm.created")}
                  </dt>
                  <dd class="mt-1 font-medium">{localeDateFormat(realm().createdAt, { dateStyle: "medium" })}</dd>
                </div>
              </dl>
            </header>

            <section class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <h3 class="font-semibold">{messageTranslate("admin.realm.domains")}</h3>
              <ul class="mt-4 grid gap-2">
                <For each={realm().domains}>
                  {(domain) => <li class="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{domain}</li>}
                </For>
              </ul>
            </section>

            <Show when={props.state.session()}>
              {(session) => (
                <section class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                  <h3 class="font-semibold">{messageTranslate("admin.overview.sessionTitle")}</h3>
                  <p class="mt-2 text-sm text-muted-foreground">
                    {messageTranslate("admin.signIn.expiresAt", {
                      date: localeDateFormat(session().expiresAt, { dateStyle: "medium", timeStyle: "short" }),
                    })}
                  </p>
                  <p class="mt-1 break-all text-sm text-muted-foreground">
                    {messageTranslate("admin.signIn.subject")}: {session().subjectId}
                  </p>
                </section>
              )}
            </Show>
          </>
        )}
      </Show>
    </section>
  )
}
