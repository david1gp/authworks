import { Match, Switch } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import { passwordResetStateCreate } from "./passwordResetStateCreate.js"

type PasswordResetPanelProps = {
  readonly confirmPassword: string
  readonly errorMessage?: string
  readonly newPassword: string
  readonly onBack: () => void
  readonly onConfirmPassword: (value: string) => void
  readonly onNewPassword: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly step: "loading" | "ready" | "invalid-link" | "complete"
  readonly validationMessage?: string
}

export function PasswordResetPanel(props: PasswordResetPanelProps) {
  const state = passwordResetStateCreate({
    confirmPassword: () => props.confirmPassword,
    newPassword: () => props.newPassword,
    onConfirmPassword: props.onConfirmPassword,
    onNewPassword: props.onNewPassword,
    onSubmit: props.onSubmit,
    pending: () => props.pending,
    step: () => props.step,
    validationMessage: () => props.validationMessage,
  })

  return (
    <section aria-labelledby="login-reset-title">
      <Switch>
        <Match when={props.step === "loading"}>
          <div class="grid justify-items-center gap-4 py-10" role="status">
            <LoaderShuffle4Dots />
            <h1 class="text-base font-medium" id="login-reset-title" ref={state.headingRegister} tabindex="-1">
              {messageTranslate("login.recovery.checkingLink")}
            </h1>
          </div>
        </Match>
        <Match when={props.step === "invalid-link"}>
          <LoginPanelHeader
            headingId="login-reset-title"
            headingRegister={state.headingRegister}
            title={messageTranslate("login.recovery.invalidLinkTitle")}
          />
          <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
          <LoginBackLink label={messageTranslate("login.recovery.back")} onBack={props.onBack} />
        </Match>
        <Match when={props.step === "complete"}>
          <LoginPanelHeader
            description={messageTranslate("login.recovery.completeDescriptionReference")}
            headingId="login-reset-title"
            headingRegister={state.headingRegister}
            title={messageTranslate("login.recovery.completeTitleReference")}
          />
          <LoginBackLink label={messageTranslate("login.recovery.back")} onBack={props.onBack} />
        </Match>
        <Match when={props.step === "ready"}>
          <LoginPanelHeader
            headingId="login-reset-title"
            headingRegister={state.headingRegister}
            title={messageTranslate("login.recovery.choosePasswordTitle")}
          />
          <form class="mt-6 grid gap-4" novalidate onSubmit={state.submit}>
            <div class="grid gap-2">
              <Label for="login-reset-password">{messageTranslate("login.password.new")}</Label>
              <div class="relative">
                <Input
                  autocomplete="new-password"
                  class="pr-20"
                  disabled={props.pending}
                  id="login-reset-password"
                  maxlength="200"
                  name="new-password"
                  onInput={(event) => state.newPasswordInput(event.currentTarget.value)}
                  ref={state.newPasswordInputRegister}
                  required
                  type={state.showPassword() ? "text" : "password"}
                  value={state.newPassword()}
                />
                <Button
                  aria-label={messageTranslate(state.showPassword() ? "login.password.hide" : "login.password.show")}
                  class="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-sm"
                  disabled={props.pending}
                  onClick={state.toggleShowPassword}
                  type="button"
                  variant="ghost"
                >
                  {messageTranslate(state.showPassword() ? "login.password.hide" : "login.password.show")}
                </Button>
              </div>
            </div>
            <div class="grid gap-2">
              <Label for="login-reset-confirm">{messageTranslate("account.password.confirm")}</Label>
              <Input
                autocomplete="new-password"
                disabled={props.pending}
                id="login-reset-confirm"
                maxlength="200"
                name="confirm-password"
                onInput={(event) => state.onConfirmPassword(event.currentTarget.value)}
                required
                type={state.showPassword() ? "text" : "password"}
                value={state.confirmPassword()}
              />
            </div>
            <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
            <LoginSubmitButton
              disabled={!state.valid()}
              label={messageTranslate("login.recovery.resetSubmitReference")}
              pending={props.pending}
              pendingLabel={messageTranslate("login.recovery.saving")}
            />
          </form>
          <LoginBackLink
            disabled={props.pending}
            label={messageTranslate("login.recovery.back")}
            onBack={props.onBack}
          />
        </Match>
      </Switch>
    </section>
  )
}
