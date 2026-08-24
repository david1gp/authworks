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
  readonly onRememberIdentifier: (event: Event & { readonly currentTarget: HTMLInputElement }) => void
  readonly onRevealPassword: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly password: string
  readonly pending: boolean
  readonly passwordInputRegister: (element: HTMLInputElement) => void
  readonly identifierInputRegister: (element: HTMLInputElement) => void
  readonly rememberIdentifier: boolean
  readonly revealPassword: boolean
  readonly valid: boolean
  readonly validationMessage?: string
}

export function PasswordPanel(props: PasswordPanelProps) {
  return (
    <section aria-labelledby="login-title">
      <LoginPanelHeader headingId="login-title" title={messageTranslate("login.password.signInTitle")} />
      <form class="mt-6 grid gap-5 sm:gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="login-identifier">{messageTranslate("login.password.identifier")}</Label>
          <Input
            autocomplete="username"
            id="login-identifier"
            inputmode="email"
            maxlength="254"
            name="identifier"
            onInput={(event) => props.onIdentifier(event.currentTarget.value)}
            ref={props.identifierInputRegister}
            required
            value={props.identifier}
            disabled={props.pending}
          />
        </div>
        <div class="grid gap-2">
          <Label for="login-password">{messageTranslate("login.password.label")}</Label>
          <div class="relative">
            <Input
              autocomplete="current-password"
              class="pr-20"
              id="login-password"
              maxlength="1024"
              name="password"
              onInput={(event) => props.onPassword(event.currentTarget.value)}
              ref={props.passwordInputRegister}
              required
              type={props.revealPassword ? "text" : "password"}
              value={props.password}
              disabled={props.pending}
            />
            <Button
              aria-label={messageTranslate(props.revealPassword ? "login.password.hide" : "login.password.show")}
              class="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-sm"
              disabled={props.pending}
              onClick={props.onRevealPassword}
              type="button"
              variant="ghost"
            >
              {messageTranslate(props.revealPassword ? "login.password.hide" : "login.password.show")}
            </Button>
          </div>
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <label class="my-1 flex items-center gap-2 font-medium">
          <input
            checked={props.rememberIdentifier}
            class="h-4 w-4 shrink-0 accent-blue-700"
            disabled={props.pending}
            name="remember-identifier"
            onChange={props.onRememberIdentifier}
            type="checkbox"
          />
          {messageTranslate("login.password.rememberIdentifier")}
        </label>
        <LoginSubmitButton
          disabled={!props.valid}
          label={messageTranslate("login.password.submit")}
          pending={props.pending}
          pendingLabel={messageTranslate("login.password.signingIn")}
        />
      </form>
      {props.onForgot === undefined ? null : (
        <Button class="mt-4 w-full" disabled={props.pending} onClick={props.onForgot} type="button" variant="link">
          {messageTranslate("login.password.forgot")}
        </Button>
      )}
      <LoginBackLink disabled={props.pending} label={messageTranslate("login.password.back")} onBack={props.onBack} />
    </section>
  )
}
