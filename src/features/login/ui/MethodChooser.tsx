import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { RecentAccountChooser } from "../../sessions/ui/RecentAccountChooser.js"
import type { LoginPrimaryMethod } from "../model/loginPrimaryMethodsGet.js"
import type { LoginRecentAccount } from "../model/loginRecentAccountSchema.js"
import { LoginPanelHeader } from "./LoginPanelHeader.js"
import type { LoginDiscovery } from "./loginAdapter.js"
import { MethodChoiceButton } from "./MethodChoiceButton.js"
import { methodChooserStateCreate } from "./methodChooserStateCreate.js"

type MethodChooserProps = {
  readonly discovery: LoginDiscovery
  readonly methods: readonly LoginPrimaryMethod[]
  readonly onRecentAccount: (account: LoginRecentAccount) => void
  readonly onRegister: () => void
  readonly onSelect: (method: LoginPrimaryMethod, providerId?: string) => void
  readonly pending: boolean
  readonly recentAccounts: readonly LoginRecentAccount[]
}

export function MethodChooser(props: MethodChooserProps) {
  const state = methodChooserStateCreate({
    discovery: () => props.discovery,
    recentAccounts: () => props.recentAccounts,
  })
  return (
    <section aria-labelledby="login-chooser-title">
      <LoginPanelHeader
        headingId="login-chooser-title"
        title={
          state.hasRecentAccounts()
            ? messageTranslate("login.chooser.accountOrMethodTitle")
            : messageTranslate("login.chooser.methodTitle")
        }
      />
      <Show when={state.hasRecentAccounts()}>
        <RecentAccountChooser
          accounts={props.recentAccounts}
          embedded
          onSelect={props.onRecentAccount}
          pending={props.pending}
        />
        <p class="my-[18px] mb-3 text-xs font-bold uppercase tracking-[0.05em] text-muted-foreground">
          {messageTranslate("login.chooser.orChooseMethod")}
        </p>
      </Show>
      <ul class="m-0 grid list-none gap-2.5 p-0">
        <For each={props.methods}>
          {(method) => (
            <li>
              <Show
                when={method === "external-identity"}
                fallback={
                  <MethodChoiceButton
                    detail={state.methodCopy(method).detail}
                    label={state.methodCopy(method).label}
                    lastUsed={state.methodIsLastUsed(method)}
                    method={method}
                    onClick={() => props.onSelect(method)}
                    pending={props.pending}
                    providerType={state.provider()?.type}
                  />
                }
              >
                <For each={props.discovery.providers}>
                  {(provider) => (
                    <MethodChoiceButton
                      detail={state.methodCopy(method, provider).detail}
                      label={state.methodCopy(method, provider).label}
                      method={method}
                      onClick={() => props.onSelect(method, provider.id)}
                      pending={props.pending}
                      providerType={provider.type}
                    />
                  )}
                </For>
              </Show>
            </li>
          )}
        </For>
      </ul>
      <div class="mt-5 grid gap-1">
        <Show when={props.discovery.policy.allowRegistration}>
          <Button disabled={props.pending} onClick={props.onRegister} type="button" variant="link">
            {messageTranslate("login.chooser.register")}
          </Button>
        </Show>
      </div>
    </section>
  )
}
