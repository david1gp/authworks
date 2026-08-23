import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { LoginRecentAccount } from "../../login/model/loginRecentAccountSchema.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"

type RecentAccountChooserProps = {
  readonly accounts: readonly LoginRecentAccount[]
  readonly onBack: () => void
  readonly onSelect: (account: LoginRecentAccount | undefined) => void
}

export function RecentAccountChooser(props: RecentAccountChooserProps) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.recent.description")}
        title={messageTranslate("login.recent.title")}
      />
      <div class="mt-6 grid gap-3">
        <For each={props.accounts}>
          {(account) => (
            <Button
              class="w-full min-w-0 justify-start gap-3 p-4 text-left"
              onClick={() => props.onSelect(account)}
              type="button"
              variant="outline"
            >
              <Icon class="shrink-0" path={mdiAccountCircleOutline} />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-semibold">{account.identifier}</span>
                <small class="text-muted-foreground">
                  {messageTranslate("account.sessions.lastUsed", {
                    date: localeDateFormat(account.lastUsedAt, { dateStyle: "medium" }),
                  })}
                </small>
              </span>
            </Button>
          )}
        </For>
      </div>
      <Show when={props.accounts.length === 0}>
        <p class="mt-6 text-sm text-muted-foreground" role="status">
          {messageTranslate("account.sessions.empty")}
        </p>
      </Show>
      <Button class="mt-4 w-full" onClick={() => props.onSelect(undefined)} type="button" variant="link">
        {messageTranslate("login.recent.other")}
      </Button>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
