import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import type { MfaFactor } from "../model/mfaFactorSchema.js"
import { mfaCodePanelStateCreate } from "./mfaCodePanelStateCreate.js"

type MfaCodePanelProps = {
  readonly code: string
  readonly errorMessage?: string
  readonly kind: Extract<MfaFactor, "recovery-code" | "totp">
  readonly onBack: () => void
  readonly onCode: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly validationMessage?: string
  readonly valid?: boolean
}

export function MfaCodePanel(props: MfaCodePanelProps) {
  const state = mfaCodePanelStateCreate(() => props.kind)
  return (
    <section>
      <LoginPanelHeader description={messageTranslate(state.description())} title={messageTranslate(state.title())} />
      <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
        <div class="grid gap-2">
          <Label for="mfa-code">{messageTranslate(state.label())}</Label>
          <Input
            autocomplete={props.kind === "totp" ? "one-time-code" : "off"}
            id="mfa-code"
            inputmode={state.inputMode()}
            maxlength={state.maxLength()}
            name="code"
            pattern={state.pattern()}
            onInput={(event) => props.onCode(event.currentTarget.value)}
            value={props.code}
            aria-describedby="mfa-code-help"
          />
          <p class="text-xs text-muted-foreground" id="mfa-code-help">
            {messageTranslate(props.kind === "totp" ? "login.mfa.enterSixDigits" : "login.mfa.enterRecoveryCode")}
          </p>
        </div>
        <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
        <LoginSubmitButton
          disabled={props.valid === false}
          label={messageTranslate("login.mfa.verify")}
          pending={props.pending}
        />
      </form>
      <LoginBackLink
        disabled={props.pending}
        label={messageTranslate("login.mfa.backToChoices")}
        onBack={props.onBack}
      />
    </section>
  )
}
