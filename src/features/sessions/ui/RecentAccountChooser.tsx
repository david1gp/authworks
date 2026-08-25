import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { loginRecentAccountInitialsGet } from "../../login/model/loginRecentAccountInitialsGet.js"
import type { LoginRecentAccount } from "../../login/model/loginRecentAccountSchema.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"

type RecentAccountChooserProps = {
  readonly accounts: readonly LoginRecentAccount[]
  readonly embedded?: boolean
  readonly onBack?: () => void
  readonly onSelect: (account: LoginRecentAccount) => void
  readonly onUseAnotherAccount?: () => void
  readonly pending?: boolean
}

export function RecentAccountChooser(props: RecentAccountChooserProps) {
  return (
    <section class={props.embedded ? "mb-5" : undefined}>
      <Show when={!props.embedded}>
        <LoginPanelHeader
          description={messageTranslate("login.recent.description")}
          headingId="login-recent-title"
          headingTabIndex={-1}
          title={messageTranslate("login.recent.title")}
        />
      </Show>
      <Show when={props.embedded}>
        <p class="m-0 mb-2.5 text-[13px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          {messageTranslate("login.recent.heading")}
        </p>
      </Show>
      <ul class="m-0 mb-3.5 grid list-none gap-2.5 p-0">
        <For each={props.accounts}>
          {(account) => (
            <li>
              <Button
                class="w-full min-h-16 min-w-0 justify-start gap-3.5 rounded-[10px] border-line px-3.5 py-2.5 text-left hover:bg-surface-hover"
                disabled={props.pending}
                onClick={() => props.onSelect(account)}
                type="button"
                variant="outline"
              >
                <span class="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold">
                  {loginRecentAccountInitialsGet(account)}
                </span>
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-extrabold">
                    {account.label ?? account.identifier}
                  </span>
                </span>
              </Button>
            </li>
          )}
        </For>
      </ul>
      <Show when={!props.embedded && props.accounts.length === 0}>
        <p class="mt-6 text-sm text-muted-foreground" role="status">
          {messageTranslate("account.sessions.empty")}
        </p>
      </Show>
      <Show when={props.embedded && props.onUseAnotherAccount}>
        <div class="mt-2">
          <Button
            class="px-0 py-[5px] text-[13px] font-bold"
            disabled={props.pending}
            onClick={props.onUseAnotherAccount}
            type="button"
            variant="link"
          >
            {messageTranslate("login.recent.useAnother")}
          </Button>
        </div>
      </Show>
      <Show when={!props.embedded}>
        <Button
          class="mt-4 w-full"
          disabled={props.pending}
          onClick={props.onUseAnotherAccount}
          type="button"
          variant="link"
        >
          {messageTranslate("login.recent.other")}
        </Button>
        <Show when={props.onBack}>{(onBack) => <LoginBackLink disabled={props.pending} onBack={onBack()} />}</Show>
      </Show>
    </section>
  )
}
