import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { For, Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { accountPasskeysSectionStateCreate } from "./accountPasskeysSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountPasskeysSection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountPasskeysSectionStateCreate(() => props.state.passkeys())
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiFingerprint}
      status={state.summaryStatus()}
      statusTone={state.summaryTone()}
      summary={messageTranslate("shell.nav.passkeys")}
      value={state.summaryValue()}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.passkeys.description")}</p>
        <ul aria-label={messageTranslate("shell.nav.passkeys")} class="divide-y divide-line-subtle">
          <Show when={state.count() === 0}>
            <li class="px-2 py-2.5 text-xs text-muted-foreground">{messageTranslate("account.passkeys.empty")}</li>
          </Show>
          <For each={props.state.passkeys()}>
            {(credential) => (
              <li class="min-w-0">
                <AuthenticatedDialog
                  class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                  onOpenChange={(open) => state.dialogOpenChange(credential.id, open)}
                  open={state.dialogOpen(credential.id)}
                  title={messageTranslate("account.passkeys.manage", {
                    kind: messageTranslate(
                      credential.backedUp ? "account.passkeys.synced" : "account.passkeys.deviceBound",
                    ),
                    id: credential.id,
                  })}
                  triggerLabel={
                    <span class="grid min-w-0 gap-1">
                      <span class="text-sm font-medium">
                        {messageTranslate(
                          credential.backedUp ? "account.passkeys.synced" : "account.passkeys.deviceBound",
                        )}
                      </span>
                      <AuthenticatedStatus
                        label={messageTranslate("account.passkeys.created", {
                          date: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                        })}
                        tone="neutral"
                      />
                    </span>
                  }
                  variant="ghost"
                >
                  <div class="grid gap-3">
                    <p class="text-xs text-muted-foreground">
                      {messageTranslate("account.passkeys.created", {
                        date: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                      })}
                    </p>
                    <AccountRoleList values={credential.transports} />
                    <Show when={props.state.error()}>
                      {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                    </Show>
                    <div>
                      <ButtonIcon
                        class={authenticatedDangerOutlineButtonClass}
                        disabled={props.state.pendingId() !== undefined}
                        icon={mdiDelete}
                        onClick={() => props.state.passkeyRevoke(credential.id)}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("account.passkeys.remove")}
                      </ButtonIcon>
                    </div>
                  </div>
                </AuthenticatedDialog>
              </li>
            )}
          </For>
          <li class="min-w-0">
            <AuthenticatedDialog
              class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
              description={messageTranslate("account.passkeys.description")}
              onOpenChange={state.addDialogOpenChange}
              open={state.addDialogOpen()}
              title={messageTranslate("account.passkeys.add")}
              triggerIcon={mdiFingerprint}
              triggerLabel={messageTranslate("account.passkeys.add")}
              variant="ghost"
            >
              <div class="grid gap-3">
                <ButtonIcon
                  disabled={props.state.pendingId() !== undefined}
                  icon={mdiFingerprint}
                  onClick={props.state.passkeyAdd}
                  type="button"
                >
                  {messageTranslate("account.passkeys.add")}
                </ButtonIcon>
                <Show when={props.state.error()}>
                  {(error) => <AuthenticatedNotice message={error()} tone="danger" />}
                </Show>
              </div>
            </AuthenticatedDialog>
          </li>
        </ul>
      </div>
    </AccountDisclosure>
  )
}
