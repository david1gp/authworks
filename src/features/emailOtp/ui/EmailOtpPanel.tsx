import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type EmailOtpPanelProps = {
  readonly code: string
  readonly email: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onCode: (value: string) => void
  readonly onEmail: (value: string) => void
  readonly onResend: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly step: "code" | "email"
  readonly validationMessage?: string
}

export function EmailOtpPanel(props: EmailOtpPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={
          props.step === "email"
            ? messageTranslate("login.emailOtp.description")
            : props.email.length === 0
              ? // The code step was reached directly, so name no address rather than an empty one.
                messageTranslate("login.mfa.emailOtpDescription")
              : messageTranslate("login.emailOtp.codeDescription", { email: props.email })
        }
        title={messageTranslate(props.step === "email" ? "login.emailOtp.title" : "login.emailOtp.codeTitle")}
      />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        {props.step === "email" ? (
          <div class="grid gap-2">
            <Label for="email-otp-address">{messageTranslate("login.register.email")}</Label>
            <Input
              autocomplete="email"
              id="email-otp-address"
              onInput={(event) => props.onEmail(event.currentTarget.value)}
              type="email"
              value={props.email}
            />
          </div>
        ) : (
          <div class="grid gap-2">
            <Label for="email-otp-code">{messageTranslate("login.mfa.verificationCode")}</Label>
            <Input
              autocomplete="one-time-code"
              id="email-otp-code"
              inputmode="numeric"
              maxlength="6"
              onInput={(event) => props.onCode(event.currentTarget.value)}
              value={props.code}
            />
          </div>
        )}
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton
          label={messageTranslate(props.step === "email" ? "login.emailOtp.send" : "login.emailOtp.verify")}
          pending={props.pending}
        />
      </form>
      {props.step === "code" ? (
        <Button class="mt-4 w-full" disabled={props.pending} onClick={props.onResend} type="button" variant="link">
          {messageTranslate("login.emailOtp.resend")}
        </Button>
      ) : null}
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
