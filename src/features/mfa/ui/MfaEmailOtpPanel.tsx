import { Show, Switch, Match } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import type { MfaEmailOtpStage } from "./mfaEmailOtpStageSchema.js"
import { mfaEmailOtpPanelStateCreate } from "./mfaEmailOtpPanelStateCreate.js"

export function MfaEmailOtpPanel(props: {
  readonly available: boolean
  readonly code: string
  readonly countdown: number
  readonly email?: string
  readonly errorMessage?: string
  readonly notice?: string
  readonly onBack: () => void
  readonly onCode: (value: string) => void
  readonly onEnroll: () => void
  readonly onResend: () => void
  readonly onSend: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly stage: MfaEmailOtpStage
  readonly validationMessage?: string
}) {
  const state = mfaEmailOtpPanelStateCreate(() => props.stage)
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate(
          props.available
            ? state.isEnroll()
              ? "login.mfa.emailOtpEnrollDescription"
              : state.isCode()
                ? "login.mfa.emailOtpDescription"
                : "login.mfa.emailOtpSendDescription"
            : "login.mfa.emailOtpUnavailableDescription",
        )}
        title={messageTranslate(
          props.available
            ? state.isEnroll()
              ? "login.mfa.emailOtpEnrollTitle"
              : state.isCode()
                ? "login.mfa.emailOtpCodeTitle"
                : "login.mfa.emailOtp"
            : "login.mfa.emailOtpUnavailableTitle",
        )}
      />
      <Show
        when={props.available}
        fallback={
          <div class="mt-6 grid gap-4">
            <p
              class="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm text-muted-foreground"
              role="status"
            >
              {messageTranslate("login.mfa.emailOtpUnavailableNotice")}
            </p>
            <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
          </div>
        }
      >
        <Switch>
          <Match when={state.isSend()}>
            <div class="mt-6 grid gap-4">
              <Show when={props.email}>{(email) => <p class="text-sm text-muted-foreground">{email()}</p>}</Show>
              <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
              <LoginSubmitButton
                label={messageTranslate("login.mfa.emailOtpSend")}
                onClick={props.onSend}
                pending={props.pending}
                type="button"
              />
            </div>
          </Match>
          <Match when={state.isEnroll()}>
            <div class="mt-6 grid gap-4">
              <p class="text-sm leading-6 text-muted-foreground">
                {messageTranslate("login.mfa.emailOtpEnrollNotice")}
              </p>
              <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
              <LoginSubmitButton
                label={messageTranslate("login.mfa.emailOtpEnroll")}
                onClick={props.onEnroll}
                pending={props.pending}
                type="button"
              />
            </div>
          </Match>
          <Match when={state.isCode()}>
            <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
              <Show when={props.notice}>
                {(notice) => (
                  <p class="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm" role="status">
                    {notice()}
                  </p>
                )}
              </Show>
              <div class="grid gap-2">
                <Label for="mfa-email-code">{messageTranslate("login.mfa.verificationCode")}</Label>
                <Input
                  autocomplete="one-time-code"
                  id="mfa-email-code"
                  inputmode="numeric"
                  maxlength="6"
                  name="code"
                  pattern="[0-9]{6}"
                  onInput={(event) => props.onCode(event.currentTarget.value)}
                  value={props.code}
                  aria-describedby="mfa-email-code-help"
                />
                <p class="text-xs text-muted-foreground" id="mfa-email-code-help">
                  {messageTranslate("login.mfa.enterSixDigits")}
                </p>
              </div>
              <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
              <LoginSubmitButton
                disabled={props.code.length !== 6}
                label={messageTranslate("login.mfa.verify")}
                pending={props.pending}
              />
              <Button
                class="w-full"
                disabled={props.pending || props.countdown > 0}
                onClick={props.onResend}
                type="button"
                variant="outline"
              >
                {props.countdown > 0
                  ? messageTranslate("login.mfa.resendIn", { seconds: props.countdown })
                  : messageTranslate("login.mfa.resend")}
              </Button>
            </form>
          </Match>
        </Switch>
      </Show>
      <LoginBackLink
        disabled={props.pending}
        label={messageTranslate("login.mfa.backToChoices")}
        onBack={props.onBack}
      />
    </section>
  )
}
