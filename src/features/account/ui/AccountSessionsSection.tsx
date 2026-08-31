import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountSessionsSection(props: { readonly state: AccountSecurityViewState }) {
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      {/* The visible card title names this column so it reads as the requested "Sessions and devices" card. */}
      <AuthenticatedSection
        description={messageTranslate("account.sessions.description")}
        title={messageTranslate("shell.nav.sessionsDevices")}
      >
        <Show
          when={props.state.sessions().length > 0}
          fallback={
            <p class="px-3 py-2.5 text-sm text-muted-foreground">{messageTranslate("account.sessions.empty")}</p>
          }
        >
          <ul class="divide-y divide-line-subtle">
            <For each={props.state.sessions()}>
              {(session) => (
                <li class="grid min-w-0 gap-2 px-3 py-2.5">
                  <div class="grid min-w-0 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span class="min-w-0 truncate text-sm font-medium">
                        {session.device.description ?? messageTranslate("account.sessions.unknownDevice")}
                      </span>
                      <Show when={session.current}>
                        <AuthenticatedStatus label={messageTranslate("account.sessions.current")} tone="success" />
                      </Show>
                    </div>
                    <Show when={!session.current}>
                      <Button
                        disabled={props.state.pendingId() === `session:${session.id}`}
                        onClick={() => props.state.sessionRevoke(session.id)}
                        size="sm"
                        variant="filledRed"
                      >
                        {messageTranslate("account.sessions.revoke")}
                      </Button>
                    </Show>
                  </div>
                  <AuthenticatedFieldList
                    columns={3}
                    fields={[
                      {
                        label: messageTranslate("admin.users.sessions.method"),
                        value: `${session.authenticationMethod} · ${session.assurance}`,
                      },
                      {
                        label: messageTranslate("admin.users.sessions.lastUsed"),
                        value: localeDateFormat(session.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
                      },
                      {
                        identifier: true,
                        label: messageTranslate("admin.users.sessions.ipAddress"),
                        value: session.device.ipAddress ?? "",
                      },
                    ]}
                  />
                </li>
              )}
            </For>
          </ul>
        </Show>
      </AuthenticatedSection>
    </div>
  )
}
