import { For, Show } from "solid-js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { sessionDeviceLabelGet } from "../../sessions/ui/sessionDeviceLabelGet.js"
import { sessionDeviceLocationGet } from "../../sessions/ui/sessionDeviceLocationGet.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

export function AdminSessionListView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <AuthenticatedSection title={messageTranslate("shell.nav.sessions")}>
      <Show
        when={props.state.status() === "ready"}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "permission-denied"
                ? messageTranslate("admin.common.permission")
                : props.state.error()
            }
            onRetry={props.state.status() === "error" ? props.state.reload : undefined}
            state={adminViewStatusPanelState(props.state.status())}
            title={props.state.status() === "empty" ? messageTranslate("account.sessions.empty") : undefined}
          />
        }
      >
        <ul class="divide-y divide-line-subtle">
          <For each={props.state.sessions()}>
            {(session) => {
              const deviceLocation = () => sessionDeviceLocationGet(session.device)
              return (
                <li class="grid gap-2 px-5 py-3.5" data-admin-session={session.id}>
                  <h3 class="text-sm font-medium">{sessionDeviceLabelGet(session.device)}</h3>
                  <p class="break-all font-mono text-xs text-muted-foreground">{session.id}</p>
                  <dl class="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground [&_dt]:font-medium [&_dd]:mt-1 [&_dd]:text-[0.8125rem]">
                    <div>
                      <dt>{messageTranslate("admin.signIn.subject")}</dt>
                      <dd class="break-all font-mono">{session.subjectId}</dd>
                    </div>
                    <div>
                      <dt>{messageTranslate("admin.signIn.subjectType")}</dt>
                      <dd>{session.subjectType}</dd>
                    </div>
                    <div>
                      <dt>{messageTranslate("admin.users.sessions.lastUsed")}</dt>
                      <dd>{localeDateFormat(session.lastUsedAt, { dateStyle: "medium", timeStyle: "short" })}</dd>
                    </div>
                    <div>
                      <dt>{messageTranslate("admin.users.sessions.expires")}</dt>
                      <dd>{localeDateFormat(session.expiresAt, { dateStyle: "medium", timeStyle: "short" })}</dd>
                    </div>
                    <Show when={session.device.ipAddress}>
                      {(ipAddress) => (
                        <div>
                          <dt>{messageTranslate("admin.users.sessions.ipAddress")}</dt>
                          <dd class="font-mono">{ipAddress()}</dd>
                        </div>
                      )}
                    </Show>
                    <Show when={deviceLocation()}>
                      {(location) => (
                        <div>
                          <dt>{messageTranslate("admin.users.sessions.location")}</dt>
                          <dd>{location()}</dd>
                        </div>
                      )}
                    </Show>
                  </dl>
                </li>
              )
            }}
          </For>
        </ul>
      </Show>
      <Show when={props.state.status() === "ready" || props.state.status() === "empty"}>
        <AuthenticatedPagination
          nextAvailable={props.state.hasNextPage()}
          onNext={props.state.pageNext}
          onPrevious={props.state.pagePrevious}
          previousAvailable={props.state.hasPreviousPage()}
        />
      </Show>
    </AuthenticatedSection>
  )
}
