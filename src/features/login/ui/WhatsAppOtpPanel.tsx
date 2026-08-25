import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "./LoginBackLink.js"
import { LoginMessages } from "./LoginMessages.js"
import { LoginPanelHeader } from "./LoginPanelHeader.js"
import { LoginSubmitButton } from "./LoginSubmitButton.js"

type WhatsAppOtpPanelProps = {
  readonly code: string
  readonly codeInputRegister: (element: HTMLInputElement) => void
  readonly codeValid: boolean
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onChangePhone: () => void
  readonly onCode: (value: string) => void
  readonly onPhoneNumber: (value: string) => void
  readonly onResend: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly phoneInputRegister: (element: HTMLInputElement) => void
  readonly phoneNumber: string
  readonly phoneNumberValid: boolean
  readonly resendAllowed: boolean
  readonly resendCountdown: number
  readonly step: "code" | "phone"
  readonly validationMessage?: string
}

export function WhatsAppOtpPanel(props: WhatsAppOtpPanelProps) {
  return (
    <section aria-labelledby="login-title">
      <LoginPanelHeader
        description={
          props.step === "phone"
            ? messageTranslate("login.whatsappOtp.description")
            : props.phoneNumber.length === 0
              ? messageTranslate("login.emailOtp.codeHelp")
              : messageTranslate("login.whatsappOtp.codeDescription", { phoneNumber: props.phoneNumber })
        }
        headingId="login-title"
        title={messageTranslate(props.step === "phone" ? "login.whatsappOtp.title" : "login.whatsappOtp.codeTitle")}
      />
      <form class="mt-6 grid gap-5 sm:gap-4" novalidate onSubmit={props.onSubmit}>
        {props.step === "phone" ? (
          <div class="grid gap-2">
            <Label for="whatsapp-otp-phone">{messageTranslate("login.whatsappOtp.phoneNumber")}</Label>
            <Input
              aria-describedby="whatsapp-otp-phone-help"
              autocomplete="tel"
              disabled={props.pending}
              id="whatsapp-otp-phone"
              inputmode="tel"
              maxlength="16"
              name="phone-number"
              onInput={(event) => props.onPhoneNumber(event.currentTarget.value)}
              pattern="\+[1-9][0-9]{1,14}"
              placeholder={messageTranslate("login.whatsappOtp.phonePlaceholder")}
              ref={props.phoneInputRegister}
              required
              type="tel"
              value={props.phoneNumber}
            />
            <p class="text-sm text-muted-foreground" id="whatsapp-otp-phone-help">
              {messageTranslate("login.whatsappOtp.phoneHint")}
            </p>
          </div>
        ) : (
          <div class="grid gap-2">
            <Label for="whatsapp-otp-code">{messageTranslate("login.mfa.verificationCode")}</Label>
            <Input
              aria-describedby="whatsapp-otp-code-help whatsapp-otp-resend-countdown"
              autocomplete="one-time-code"
              disabled={props.pending}
              id="whatsapp-otp-code"
              inputmode="numeric"
              maxlength="6"
              name="code"
              onInput={(event) => props.onCode(event.currentTarget.value)}
              pattern="[0-9]{6}"
              ref={props.codeInputRegister}
              required
              value={props.code}
            />
            <p class="text-sm text-muted-foreground" id="whatsapp-otp-code-help">
              {messageTranslate("login.emailOtp.codeHelp")}
            </p>
          </div>
        )}
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton
          disabled={props.step === "phone" ? !props.phoneNumberValid : !props.codeValid}
          label={messageTranslate(props.step === "phone" ? "login.whatsappOtp.send" : "common.continue")}
          pending={props.pending}
          pendingLabel={messageTranslate(
            props.step === "phone" ? "login.whatsappOtp.sending" : "login.whatsappOtp.verifying",
          )}
        />
      </form>
      {props.step === "code" ? (
        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            aria-describedby={props.resendCountdown > 0 ? "whatsapp-otp-resend-countdown" : undefined}
            class="w-full"
            disabled={props.pending || !props.resendAllowed}
            onClick={props.onResend}
            type="button"
            variant="link"
          >
            {messageTranslate("login.whatsappOtp.resend")}
          </Button>
          <Button class="w-full" disabled={props.pending} onClick={props.onChangePhone} type="button" variant="link">
            {messageTranslate("login.whatsappOtp.differentNumber")}
          </Button>
        </div>
      ) : null}
      <Show when={props.resendCountdown > 0}>
        <p
          aria-atomic="true"
          aria-live="polite"
          class="mt-2 text-center text-sm text-muted-foreground"
          id="whatsapp-otp-resend-countdown"
        >
          {messageTranslate("login.emailOtp.resendCountdown", { seconds: props.resendCountdown })}
        </p>
      </Show>
      <LoginBackLink label={messageTranslate("login.emailOtp.back")} onBack={props.onBack} disabled={props.pending} />
    </section>
  )
}
