import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import { passwordChangeRequiredStateCreate } from "./passwordChangeRequiredStateCreate.js"

type PasswordChangeRequiredPanelProps = {
  readonly confirmPassword: string
  readonly currentPassword: string
  readonly errorMessage?: string
  readonly expired: boolean
  readonly newPassword: string
  readonly onConfirmPassword: (value: string) => void
  readonly onCurrentPassword: (value: string) => void
  readonly onNewPassword: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly validationMessage?: string
}

export function PasswordChangeRequiredPanel(props: PasswordChangeRequiredPanelProps) {
  const state = passwordChangeRequiredStateCreate({
    confirmPassword: () => props.confirmPassword,
    currentPassword: () => props.currentPassword,
    newPassword: () => props.newPassword,
    onConfirmPassword: props.onConfirmPassword,
    onCurrentPassword: props.onCurrentPassword,
    onNewPassword: props.onNewPassword,
    onSubmit: props.onSubmit,
    pending: () => props.pending,
    validationMessage: () => props.validationMessage,
  })

  return (
    <section aria-labelledby="login-password-change-title">
      <LoginPanelHeader
        description={
          props.expired
            ? messageTranslate("login.password.expiredDescription")
            : messageTranslate("login.password.changeRequiredDescription")
        }
        headingId="login-password-change-title"
        title={messageTranslate("login.password.changeRequiredTitle")}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={state.onSubmit}>
        <div class="grid gap-2">
          <Label for="login-current-password">{messageTranslate("login.password.current")}</Label>
          <Input
            autocomplete="current-password"
            disabled={props.pending}
            id="login-current-password"
            maxlength="200"
            name="current-password"
            onInput={(event) => state.onCurrentPassword(event.currentTarget.value)}
            ref={state.registerCurrentPassword}
            required
            type={state.showPassword() ? "text" : "password"}
            value={state.currentPassword()}
          />
        </div>
        <div class="grid gap-2">
          <Label for="login-new-password">{messageTranslate("login.password.new")}</Label>
          <Input
            autocomplete="new-password"
            disabled={props.pending}
            id="login-new-password"
            maxlength="200"
            name="new-password"
            onInput={(event) => state.onNewPassword(event.currentTarget.value)}
            ref={state.registerNewPassword}
            required
            type={state.showPassword() ? "text" : "password"}
            value={state.newPassword()}
          />
        </div>
        <div class="grid gap-2">
          <Label for="login-confirm-password">{messageTranslate("account.password.confirm")}</Label>
          <Input
            autocomplete="new-password"
            disabled={props.pending}
            id="login-confirm-password"
            maxlength="200"
            name="confirm-password"
            onInput={(event) => state.onConfirmPassword(event.currentTarget.value)}
            required
            type={state.showPassword() ? "text" : "password"}
            value={state.confirmPassword()}
          />
        </div>
        <button
          aria-label={messageTranslate(state.showPassword() ? "login.password.hide" : "login.password.show")}
          class="w-fit justify-self-end text-sm text-link underline underline-offset-2"
          disabled={props.pending}
          onClick={state.toggleShowPassword}
          type="button"
        >
          {messageTranslate(state.showPassword() ? "login.password.hide" : "login.password.show")}
        </button>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton
          label={messageTranslate("login.password.changeSubmit")}
          pending={props.pending}
          pendingLabel={messageTranslate("login.password.saving")}
        />
      </form>
    </section>
  )
}
