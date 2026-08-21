import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type PasswordRegisterPanelProps = {
  readonly confirmPassword: string
  readonly displayName: string
  readonly email: string
  readonly errorMessage?: string
  readonly newPassword: string
  readonly onBack: () => void
  readonly onConfirmPassword: (value: string) => void
  readonly onDisplayName: (value: string) => void
  readonly onEmail: (value: string) => void
  readonly onNewPassword: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly onUserName: (value: string) => void
  readonly organizationName: string
  readonly pending: boolean
  readonly userName: string
  readonly validationMessage?: string
}

export function PasswordRegisterPanel(props: PasswordRegisterPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.register.description", { organization: props.organizationName })}
        title={messageTranslate("login.register.title")}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="register-display-name">{messageTranslate("login.register.displayName")}</Label>
          <Input
            autocomplete="name"
            id="register-display-name"
            onInput={(event) => props.onDisplayName(event.currentTarget.value)}
            value={props.displayName}
          />
        </div>
        <div class="grid gap-2">
          <Label for="register-email">{messageTranslate("login.register.email")}</Label>
          <Input
            autocomplete="email"
            id="register-email"
            onInput={(event) => props.onEmail(event.currentTarget.value)}
            type="email"
            value={props.email}
          />
        </div>
        <div class="grid gap-2">
          <Label for="register-user-name">{messageTranslate("login.register.userName")}</Label>
          <Input
            autocomplete="username"
            id="register-user-name"
            onInput={(event) => props.onUserName(event.currentTarget.value)}
            value={props.userName}
          />
        </div>
        <div class="grid gap-2">
          <Label for="register-password">{messageTranslate("login.password.new")}</Label>
          <Input
            autocomplete="new-password"
            id="register-password"
            onInput={(event) => props.onNewPassword(event.currentTarget.value)}
            type="password"
            value={props.newPassword}
          />
        </div>
        <div class="grid gap-2">
          <Label for="register-confirm">{messageTranslate("login.password.confirm")}</Label>
          <Input
            autocomplete="new-password"
            id="register-confirm"
            onInput={(event) => props.onConfirmPassword(event.currentTarget.value)}
            type="password"
            value={props.confirmPassword}
          />
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton label={messageTranslate("login.register.submit")} pending={props.pending} />
      </form>
      <LoginBackLink label={messageTranslate("login.register.signIn")} onBack={props.onBack} />
    </section>
  )
}
