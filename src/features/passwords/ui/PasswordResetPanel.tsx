import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type PasswordResetPanelProps = {
  readonly confirmPassword: string
  readonly errorMessage?: string
  readonly newPassword: string
  readonly onConfirmPassword: (value: string) => void
  readonly onNewPassword: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly validationMessage?: string
}

export function PasswordResetPanel(props: PasswordResetPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.recovery.resetDescription")}
        title={messageTranslate("login.recovery.resetTitle")}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="login-reset-password">{messageTranslate("login.password.new")}</Label>
          <Input
            autocomplete="new-password"
            id="login-reset-password"
            onInput={(event) => props.onNewPassword(event.currentTarget.value)}
            type="password"
            value={props.newPassword}
          />
        </div>
        <div class="grid gap-2">
          <Label for="login-reset-confirm">{messageTranslate("login.password.confirm")}</Label>
          <Input
            autocomplete="new-password"
            id="login-reset-confirm"
            onInput={(event) => props.onConfirmPassword(event.currentTarget.value)}
            type="password"
            value={props.confirmPassword}
          />
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton label={messageTranslate("login.recovery.resetSubmit")} pending={props.pending} />
      </form>
    </section>
  )
}
