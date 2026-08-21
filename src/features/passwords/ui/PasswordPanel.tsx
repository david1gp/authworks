import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type PasswordPanelProps = {
  readonly errorMessage?: string
  readonly identifier: string
  readonly onBack: () => void
  readonly onForgot?: () => void
  readonly onIdentifier: (value: string) => void
  readonly onPassword: (value: string) => void
  readonly onRevealPassword: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly organizationName: string
  readonly password: string
  readonly pending: boolean
  readonly revealPassword: boolean
  readonly validationMessage?: string
}

export function PasswordPanel(props: PasswordPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.password.description", { organization: props.organizationName })}
        title={messageTranslate("login.password.title")}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="login-identifier">{messageTranslate("login.password.identifier")}</Label>
          <Input
            autocomplete="username"
            id="login-identifier"
            onInput={(event) => props.onIdentifier(event.currentTarget.value)}
            value={props.identifier}
          />
        </div>
        <div class="grid gap-2">
          <Label for="login-password">{messageTranslate("login.password.label")}</Label>
          <div class="flex gap-2">
            <Input
              autocomplete="current-password"
              class="min-w-0 flex-1"
              id="login-password"
              onInput={(event) => props.onPassword(event.currentTarget.value)}
              type={props.revealPassword ? "text" : "password"}
              value={props.password}
            />
            <Button
              aria-label={messageTranslate(props.revealPassword ? "login.password.hide" : "login.password.show")}
              onClick={props.onRevealPassword}
              type="button"
              variant="ghost"
            >
              {messageTranslate(props.revealPassword ? "login.password.hide" : "login.password.show")}
            </Button>
          </div>
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton label={messageTranslate("login.password.submit")} pending={props.pending} />
      </form>
      {props.onForgot === undefined ? null : (
        <Button class="mt-4 w-full" onClick={props.onForgot} type="button" variant="link">
          {messageTranslate("login.password.forgot")}
        </Button>
      )}
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
