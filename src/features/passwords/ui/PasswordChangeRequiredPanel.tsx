import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type PasswordChangeRequiredPanelProps = {
  readonly confirmPassword: string
  readonly currentPassword: string
  readonly errorMessage?: string
  readonly newPassword: string
  readonly onBack: () => void
  readonly onConfirmPassword: (value: string) => void
  readonly onCurrentPassword: (value: string) => void
  readonly onNewPassword: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly validationMessage?: string
}

export function PasswordChangeRequiredPanel(props: PasswordChangeRequiredPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.password.changeDescription")}
        title={messageTranslate("login.password.changeTitle")}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="login-current-password">{messageTranslate("login.password.current")}</Label>
          <Input
            autocomplete="current-password"
            id="login-current-password"
            onInput={(event) => props.onCurrentPassword(event.currentTarget.value)}
            type="password"
            value={props.currentPassword}
          />
        </div>
        <div class="grid gap-2">
          <Label for="login-new-password">{messageTranslate("login.password.new")}</Label>
          <Input
            autocomplete="new-password"
            id="login-new-password"
            onInput={(event) => props.onNewPassword(event.currentTarget.value)}
            type="password"
            value={props.newPassword}
          />
        </div>
        <div class="grid gap-2">
          <Label for="login-confirm-password">{messageTranslate("login.password.confirm")}</Label>
          <Input
            autocomplete="new-password"
            id="login-confirm-password"
            onInput={(event) => props.onConfirmPassword(event.currentTarget.value)}
            type="password"
            value={props.confirmPassword}
          />
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton label={messageTranslate("login.recovery.resetSubmit")} pending={props.pending} />
      </form>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
