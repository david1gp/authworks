import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { accountSecurityHistoryMessageKeyGet } from "./accountSecurityHistoryMessageKeyGet.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountSecurityHistorySection(props: { readonly state: AccountSecurityViewState }) {
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedSection title={messageTranslate("shell.nav.securityHistory")}>
        <Show
          when={props.state.securityHistory().length > 0}
          fallback={
            <p class="px-3 py-2.5 text-sm text-muted-foreground">{messageTranslate("account.securityHistory.empty")}</p>
          }
        >
          <ul class="divide-y divide-line-subtle" data-security-history-list>
            <For each={props.state.securityHistory()}>
              {(item) => (
                <li
                  class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                  data-security-history-item
                >
                  <AuthenticatedStatus
                    label={messageTranslate(accountSecurityHistoryMessageKeyGet(item).category)}
                    tone="neutral"
                  />
                  <span class="min-w-0 truncate text-sm font-medium">
                    {messageTranslate(accountSecurityHistoryMessageKeyGet(item).display)}
                  </span>
                  <time
                    class="col-span-2 text-xs tabular-nums text-muted-foreground sm:col-span-1 sm:text-right"
                    dateTime={new Date(item.occurredAt).toISOString()}
                  >
                    {localeDateFormat(item.occurredAt, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </li>
              )}
            </For>
          </ul>
          <Show when={props.state.securityHistoryNextPageToken()}>
            <div class="border-t border-line-subtle px-3 py-2">
              <Button
                class="h-7 text-xs"
                disabled={props.state.pendingId() === "security-history:next"}
                onClick={props.state.securityHistoryLoadMore}
                variant="outline"
              >
                {messageTranslate("account.securityHistory.loadMore")}
              </Button>
            </div>
          </Show>
        </Show>
      </AuthenticatedSection>
    </div>
  )
}
