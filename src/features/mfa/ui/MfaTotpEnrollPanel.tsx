import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { CodeBlock } from "#ui/static/code/CodeBlock.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type MfaTotpEnrollPanelProps = {
  readonly code: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onCode: (value: string) => void
  readonly onStart: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly secret?: string
  readonly validationMessage?: string
}

export function MfaTotpEnrollPanel(props: MfaTotpEnrollPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.totpEnroll.description")}
        title={messageTranslate("login.totpEnroll.title")}
      />
      <Show
        when={props.secret}
        fallback={
          <div class="mt-6 grid gap-4">
            <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
            <LoginSubmitButton
              label={messageTranslate("login.totpEnroll.start")}
              onClick={props.onStart}
              pending={props.pending}
              type="button"
            />
          </div>
        }
      >
        {(secret) => (
          <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
            <CodeBlock data={secret()} />
            <div class="grid gap-2">
              <Label for="totp-enroll-code">{messageTranslate("login.mfa.verificationCode")}</Label>
              <Input
                autocomplete="one-time-code"
                id="totp-enroll-code"
                inputmode="numeric"
                maxlength="6"
                onInput={(event) => props.onCode(event.currentTarget.value)}
                value={props.code}
              />
            </div>
            <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
            <LoginSubmitButton label={messageTranslate("login.totpEnroll.submit")} pending={props.pending} />
          </form>
        )}
      </Show>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
