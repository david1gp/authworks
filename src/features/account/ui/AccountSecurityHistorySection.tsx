import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiHistory } from "@adaptive-ds/mdi/mdiHistory.js"
import { For, Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { accountSecurityHistoryMessageKeyGet } from "./accountSecurityHistoryMessageKeyGet.js"
import { accountSecurityHistorySectionStateCreate } from "./accountSecurityHistorySectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountSecurityHistorySection(props: { readonly state: AccountSecurityViewState }) {
  const state = accountSecurityHistorySectionStateCreate(() => props.state.securityHistory())
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiHistory}
      status={state.summaryStatus()}
      statusTone="neutral"
      summary={messageTranslate("shell.nav.securityHistory")}
      value={state.summaryValue()}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.securityHistory.description")}</p>
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
                  <span class="min-w-0 break-words text-sm font-medium">
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
              <ButtonIcon
                class="h-7 text-xs"
                disabled={props.state.pendingId() === "security-history:next"}
                icon={mdiChevronDown}
                onClick={props.state.securityHistoryLoadMore}
                variant="outline"
              >
                {messageTranslate("account.securityHistory.loadMore")}
              </ButtonIcon>
            </div>
          </Show>
        </Show>
      </div>
    </AccountDisclosure>
  )
}
