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
    methods: () => props.methods,
    recentAccounts: () => props.recentAccounts,
  })
  return (
    <section aria-labelledby="login-chooser-title" class="login-chooser" data-layout={state.layout()}>
      <LoginPanelHeader
        headingId="login-chooser-title"
        title={
          state.hasRecentAccounts()
            ? messageTranslate("login.chooser.accountOrMethodTitle")
            : messageTranslate("login.chooser.methodTitle")
        }
      />
      <Show when={state.hasRecentAccounts()}>
        <div class="mt-6">
          <RecentAccountChooser
            accounts={props.recentAccounts}
            embedded
            onSelect={props.onRecentAccount}
            pending={props.pending}
          />
        </div>
        <p class="mb-3 mt-[18px] text-xs font-bold uppercase tracking-[0.05em] text-muted-foreground">
          {messageTranslate("login.chooser.orChooseMethod")}
        </p>
      </Show>
      <div class="login-chooser-groups" classList={{ "mt-6": !state.hasRecentAccounts() }}>
        <Show when={state.ownMethods().length > 0}>
          <ul class="login-chooser-list">
            <For each={state.ownMethods()}>
              {(method) => (
                <li>
                  <MethodChoiceButton
                    detail={state.methodCopy(method).detail}
                    label={state.methodCopy(method).label}
                    lastUsed={state.methodIsLastUsed(method)}
                    method={method}
                    onClick={() => props.onSelect(method)}
                    pending={props.pending}
                    providerType={state.provider()?.type}
                  />
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show when={state.layout() === "split"}>
          <div aria-hidden="true" class="login-chooser-divider">
            <span>{messageTranslate("login.chooser.or")}</span>
          </div>
        </Show>
        <Show when={state.providers().length > 0}>
          <ul class="login-chooser-list">
            <For each={state.providers()}>
              {(provider) => (
                <li>
                  <MethodChoiceButton
                    detail={state.methodCopy("external-identity", provider).detail}
                    label={state.methodCopy("external-identity", provider).label}
                    method="external-identity"
                    onClick={() => props.onSelect("external-identity", provider.id)}
                    pending={props.pending}
                    providerType={provider.type}
                  />
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
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
