import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { LoginPrimaryMethod } from "../model/loginPrimaryMethodsGet.js"
import { LoginPanelHeader } from "./LoginPanelHeader.js"
import type { LoginDiscovery } from "./loginAdapter.js"
import { MethodChoiceButton } from "./MethodChoiceButton.js"

type MethodChooserProps = {
  readonly discovery: LoginDiscovery
  readonly methods: readonly LoginPrimaryMethod[]
  readonly onRecentAccounts: () => void
  readonly onRegister: () => void
  readonly onSelect: (method: LoginPrimaryMethod) => void
  readonly showRecentAccounts: boolean
}

export function MethodChooser(props: MethodChooserProps) {
  const provider = () => props.discovery.providers[0]
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.chooser.description", {
          organization: props.discovery.organization.name,
        })}
        title={messageTranslate("login.chooser.title")}
      />
      <div class="mt-6 grid gap-3">
        <For each={props.methods}>
          {(method) => (
            <MethodChoiceButton
              detail={
                method === "external-identity"
                  ? messageTranslate("login.chooser.providerDetail")
                  : method === "email-otp"
                    ? messageTranslate("login.chooser.emailOtpDetail")
                    : method === "passkey"
                      ? messageTranslate("login.chooser.passkeyDetail")
                      : messageTranslate("login.chooser.passwordDetail")
              }
              label={
                method === "external-identity"
                  ? messageTranslate("login.chooser.providerLabel", {
                      provider: provider()?.displayName ?? messageTranslate("app.name"),
                    })
                  : method === "email-otp"
                    ? messageTranslate("login.chooser.emailOtpLabel")
                    : method === "passkey"
                      ? messageTranslate("login.chooser.passkeyLabel")
                      : messageTranslate("login.chooser.passwordLabel")
              }
              method={method}
              onClick={() => props.onSelect(method)}
              providerType={provider()?.type}
            />
          )}
        </For>
      </div>
      <div class="mt-5 grid gap-1">
        <Show when={props.showRecentAccounts}>
          <Button onClick={props.onRecentAccounts} type="button" variant="link">
            {messageTranslate("login.chooser.useRecent")}
          </Button>
        </Show>
        <Show when={props.discovery.policy.allowRegistration}>
          <Button onClick={props.onRegister} type="button" variant="link">
            {messageTranslate("login.chooser.register")}
          </Button>
        </Show>
      </div>
    </section>
  )
}
