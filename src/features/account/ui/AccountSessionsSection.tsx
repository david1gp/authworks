import { mdiDevices } from "@adaptive-ds/mdi/mdiDevices.js"
import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { For, Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"
import { accountSessionsSectionStateCreate } from "./accountSessionsSectionStateCreate.js"

export function AccountSessionsSection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountSessionsSectionStateCreate(() => props.state.sessions())
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiDevices}
      status={state.summaryStatus()}
      statusTone={state.summaryTone()}
      summary={messageTranslate("shell.nav.sessionsDevices")}
      value={state.summaryValue()}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.sessions.description")}</p>
        <Show
          when={props.state.sessions().length > 0}
          fallback={
            <p class="px-2 py-2.5 text-sm text-muted-foreground">{messageTranslate("account.sessions.empty")}</p>
          }
        >
          <ul aria-label={messageTranslate("shell.nav.sessionsDevices")} class="divide-y divide-line-subtle">
            <For each={props.state.sessions()}>
              {(session) => (
                <li class="min-w-0">
                  <AuthenticatedDialog
                    class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                    description={messageTranslate("account.sessions.description")}
                    disabled={props.state.pendingId() === `session:${session.id}`}
                    onOpenChange={(open) => state.dialogOpenChange(session.id, open)}
                    open={state.dialogOpen(session.id)}
                    title={messageTranslate("account.sessions.manage", {
                      device: session.device.description ?? messageTranslate("account.sessions.unknownDevice"),
                    })}
                    triggerLabel={
                      <span class="grid min-w-0 gap-0.5">
                        <span class="flex min-w-0 flex-wrap items-center gap-2">
                          <span class="min-w-0 break-words text-sm font-medium">
                            {session.device.description ?? messageTranslate("account.sessions.unknownDevice")}
                          </span>
                          <Show when={session.current}>
                            <AuthenticatedStatus label={messageTranslate("account.sessions.current")} tone="success" />
                          </Show>
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {messageTranslate("account.sessions.lastUsed", {
                            date: localeDateFormat(session.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
                          })}
                        </span>
                      </span>
                    }
                    variant="ghost"
                  >
                    <div class="grid gap-3">
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
                      <Show when={!session.current}>
                        <div>
                          <ButtonIcon
                            class={authenticatedDangerOutlineButtonClass}
                            disabled={props.state.pendingId() !== undefined || !state.dialogOpen(session.id)}
                            icon={mdiLogout}
                            onClick={() => state.sessionRevoke(session.id, props.state.sessionRevoke)}
                            type="button"
                            variant="outline"
                          >
                            {messageTranslate("account.sessions.revoke")}
                          </ButtonIcon>
                        </div>
                      </Show>
                    </div>
                  </AuthenticatedDialog>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </AccountDisclosure>
  )
}
