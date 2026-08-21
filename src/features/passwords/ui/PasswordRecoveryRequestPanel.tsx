import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type PasswordRecoveryRequestPanelProps = {
  readonly email: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onEmail: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly validationMessage?: string
}

export function PasswordRecoveryRequestPanel(props: PasswordRecoveryRequestPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.recovery.description")}
        title={messageTranslate("login.recovery.title")}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="login-recovery-email">{messageTranslate("login.register.email")}</Label>
          <Input
            autocomplete="email"
            id="login-recovery-email"
            onInput={(event) => props.onEmail(event.currentTarget.value)}
            type="email"
            value={props.email}
          />
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton label={messageTranslate("login.recovery.submit")} pending={props.pending} />
      </form>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
