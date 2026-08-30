import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountSplitColumns } from "./AccountSplitColumns.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountPasskeysSection(props: { readonly state: AccountSecurityViewState }) {
  return (
    <AccountSplitColumns
      secondary={
        <AuthenticatedSection padded title={messageTranslate("account.passkeys.add")}>
          <div class="grid min-w-0 gap-2.5">
            <p class="text-sm text-muted-foreground">{messageTranslate("account.passkeys.description")}</p>
            <div>
              <Button disabled={props.state.pendingId() === "passkey:add"} onClick={props.state.passkeyAdd} size="sm">
                {messageTranslate("account.passkeys.add")}
              </Button>
            </div>
          </div>
        </AuthenticatedSection>
      }
      primary={
        <AuthenticatedSection title={messageTranslate("shell.nav.passkeys")}>
          <Show
            when={props.state.passkeys().length > 0}
            fallback={<ProductionStatePanel compact state="empty" title={messageTranslate("account.passkeys.empty")} />}
          >
            <ul class="divide-y divide-line-subtle">
              <For each={props.state.passkeys()}>
                {(credential) => (
                  <li class="grid min-w-0 gap-2 px-3 py-2.5">
                    <div class="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <span class="min-w-0 truncate text-sm font-medium">
                          {credential.backedUp
                            ? messageTranslate("account.passkeys.synced")
                            : messageTranslate("account.passkeys.deviceBound")}
                        </span>
                        <AuthenticatedStatus
                          label={messageTranslate("account.passkeys.created", {
                            date: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                          })}
                          tone="neutral"
                        />
                      </div>
                      <Button
                        disabled={props.state.pendingId() === `passkey:${credential.id}`}
                        onClick={() => props.state.passkeyRevoke(credential.id)}
                        size="sm"
                        variant="filledRed"
                      >
                        {messageTranslate("account.passkeys.remove")}
                      </Button>
                    </div>
                    <AccountRoleList values={credential.transports} />
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </AuthenticatedSection>
      }
    />
  )
}
