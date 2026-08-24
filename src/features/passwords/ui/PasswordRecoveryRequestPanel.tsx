import { Match, Switch } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginNoticePanel } from "../../login/ui/LoginNoticePanel.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import { passwordRecoveryRequestStateCreate } from "./passwordRecoveryRequestStateCreate.js"

type PasswordRecoveryRequestPanelProps = {
  readonly email: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onEmail: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly step: "loading" | "email" | "sent" | "fatal"
  readonly validationMessage?: string
}

export function PasswordRecoveryRequestPanel(props: PasswordRecoveryRequestPanelProps) {
  const state = passwordRecoveryRequestStateCreate({
    email: () => props.email,
    onEmail: props.onEmail,
    onSubmit: props.onSubmit,
    pending: () => props.pending,
    step: () => props.step,
  })

  return (
    <section aria-labelledby="login-recovery-title">
      <Switch>
        <Match when={props.step === "loading"}>
          <div class="grid justify-items-center gap-4 py-10" role="status">
            <LoaderShuffle4Dots />
            <h1 class="text-base font-medium" id="login-recovery-title" ref={state.headingRegister} tabindex="-1">
              {messageTranslate("login.recovery.loading")}
            </h1>
          </div>
        </Match>
        <Match when={props.step === "fatal"}>
          <LoginNoticePanel
            actionLabel={messageTranslate("login.recovery.back")}
            description={messageTranslate("login.recovery.unavailableDescription")}
            headingRegister={state.headingRegister}
            kind="error"
            onAction={props.onBack}
            title={messageTranslate("login.recovery.unavailableTitle")}
          />
        </Match>
        <Match when={props.step === "sent"}>
          <LoginNoticePanel
            actionLabel={messageTranslate("login.recovery.back")}
            description={messageTranslate("login.recovery.sentDescription")}
            headingRegister={state.headingRegister}
            kind="pending"
            onAction={props.onBack}
            title={messageTranslate("login.recovery.sentTitle")}
          />
        </Match>
        <Match when={props.step === "email"}>
          <LoginPanelHeader
            headingId="login-recovery-title"
            headingRegister={state.headingRegister}
            title={messageTranslate("login.recovery.title")}
          />
          <form class="mt-6 grid gap-4" novalidate onSubmit={state.submit}>
            <div class="grid gap-2">
              <Label for="login-recovery-email">{messageTranslate("login.register.email")}</Label>
              <Input
                autocomplete="username"
                disabled={props.pending}
                id="login-recovery-email"
                inputmode="email"
                maxlength="254"
                name="email"
                onInput={(event) => state.emailInput(event.currentTarget.value)}
                ref={state.emailInputRegister}
                required
                type="email"
                value={state.email()}
              />
            </div>
            <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
            <LoginSubmitButton
              disabled={!state.valid()}
              label={messageTranslate("login.recovery.submitReference")}
              pending={props.pending}
              pendingLabel={messageTranslate("login.recovery.sending")}
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
