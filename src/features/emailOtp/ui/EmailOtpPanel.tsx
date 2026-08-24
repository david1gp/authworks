import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import { emailOtpEmailMask } from "../model/emailOtpEmailMask.js"

type EmailOtpPanelProps = {
  readonly code: string
  readonly email: string
  readonly errorMessage?: string
  readonly emailInputRegister: (element: HTMLInputElement) => void
  readonly codeInputRegister: (element: HTMLInputElement) => void
  readonly emailOtpNotice?: string
  readonly onChangeEmail: () => void
  readonly onBack: () => void
  readonly onCode: (value: string) => void
  readonly onEmail: (value: string) => void
  readonly onRememberEmail: (event: Event & { readonly currentTarget: HTMLInputElement }) => void
  readonly onResend: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly rememberEmail: boolean
  readonly resendAllowed: boolean
  readonly resendCountdown: number
  readonly step: "code" | "email"
  readonly validationMessage?: string
}

export function EmailOtpPanel(props: EmailOtpPanelProps) {
  return (
    <section aria-labelledby="login-title">
      <LoginPanelHeader
        description={
          props.step === "email"
            ? undefined
            : props.email.length === 0
              ? // The code step was reached directly, so name no address rather than an empty one.
                messageTranslate("login.mfa.emailOtpDescription")
              : messageTranslate("login.emailOtp.codeDescription", { email: emailOtpEmailMask(props.email) })
        }
        headingId="login-title"
        title={messageTranslate(props.step === "email" ? "login.emailOtp.title" : "login.emailOtp.codeTitle")}
      />
      <form class="mt-6 grid gap-5 sm:gap-4" novalidate onSubmit={props.onSubmit}>
        {props.step === "email" ? (
          <div class="grid gap-2">
            <Label for="email-otp-address">{messageTranslate("login.register.email")}</Label>
            <Input
              autocomplete="username"
              id="email-otp-address"
              inputmode="email"
              maxlength="254"
              name="email"
              onInput={(event) => props.onEmail(event.currentTarget.value)}
              ref={props.emailInputRegister}
              required
              type="email"
              value={props.email}
              disabled={props.pending}
            />
            <label class="my-1 flex items-center gap-2 font-medium">
              <input
                checked={props.rememberEmail}
                class="h-4 w-4 shrink-0 accent-blue-700"
                disabled={props.pending}
                name="remember-email"
                onChange={props.onRememberEmail}
                type="checkbox"
              />
              {messageTranslate("login.emailOtp.remember")}
            </label>
          </div>
        ) : (
          <div class="grid gap-2">
            <Label for="email-otp-code">{messageTranslate("login.mfa.verificationCode")}</Label>
            <Input
              autocomplete="one-time-code"
              id="email-otp-code"
              name="code"
              inputmode="numeric"
              pattern="[0-9]{6}"
              maxlength="6"
              onInput={(event) => props.onCode(event.currentTarget.value)}
              ref={props.codeInputRegister}
              required
              value={props.code}
              disabled={props.pending}
              aria-describedby="email-otp-code-help email-otp-resend-status"
            />
            <p class="text-sm text-muted-foreground" id="email-otp-code-help">
              {messageTranslate("login.emailOtp.codeHelp")}
            </p>
          </div>
        )}
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton
          disabled={props.step === "code" && props.code.length !== 6}
          label={messageTranslate(props.step === "email" ? "login.emailOtp.send" : "login.emailOtp.verify")}
          pendingLabel={messageTranslate(
            props.step === "email" ? "login.emailOtp.sending" : "login.emailOtp.verifying",
          )}
          pending={props.pending}
        />
      </form>
      {props.step === "code" ? (
        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            aria-describedby={props.resendCountdown > 0 ? "email-otp-resend-countdown" : undefined}
            class="w-full"
            disabled={props.pending || !props.resendAllowed}
            onClick={props.onResend}
            type="button"
            variant="link"
          >
            {messageTranslate("login.emailOtp.resend")}
          </Button>
          <Button class="w-full" disabled={props.pending} onClick={props.onChangeEmail} type="button" variant="link">
            {messageTranslate("login.emailOtp.changeEmail")}
          </Button>
        </div>
      ) : null}
      <Show when={props.resendCountdown > 0}>
        <p
          aria-live="polite"
          aria-atomic="true"
          class="mt-2 text-center text-sm text-muted-foreground"
          id="email-otp-resend-countdown"
        >
          {messageTranslate("login.emailOtp.resendCountdown", { seconds: props.resendCountdown })}
        </p>
      </Show>
      <p
        aria-live="polite"
        class="empty:hidden mt-2 text-center text-sm text-muted-foreground"
        id="email-otp-resend-status"
        role="status"
      >
        {props.emailOtpNotice ?? ""}
      </p>
      <LoginBackLink label={messageTranslate("login.emailOtp.back")} onBack={props.onBack} disabled={props.pending} />
    </section>
  )
}
