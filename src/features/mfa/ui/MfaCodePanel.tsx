import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type MfaCodePanelProps = {
  readonly code: string
  readonly errorMessage?: string
  readonly kind: "email-otp" | "recovery-code" | "totp"
  readonly onBack: () => void
  readonly onCode: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly validationMessage?: string
}

export function MfaCodePanel(props: MfaCodePanelProps) {
  const recovery = () => props.kind === "recovery-code"
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate(
          props.kind === "totp"
            ? "login.mfa.totpDescription"
            : props.kind === "email-otp"
              ? "login.mfa.emailOtpDescription"
              : "login.mfa.recoveryCodeDescription",
        )}
        title={messageTranslate(
          props.kind === "totp"
            ? "login.mfa.totp"
            : props.kind === "email-otp"
              ? "login.mfa.emailOtp"
              : "login.mfa.recoveryCode",
        )}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="mfa-code">
            {messageTranslate(recovery() ? "login.mfa.recoveryCodeLabel" : "login.mfa.verificationCode")}
          </Label>
          <Input
            autocomplete="one-time-code"
            id="mfa-code"
            inputmode={recovery() ? "text" : "numeric"}
            maxlength={recovery() ? "64" : "6"}
            onInput={(event) => props.onCode(event.currentTarget.value)}
            value={props.code}
          />
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton label={messageTranslate("login.mfa.verify")} pending={props.pending} />
      </form>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
