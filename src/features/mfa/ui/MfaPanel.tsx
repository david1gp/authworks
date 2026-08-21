import { mdiCellphoneKey, mdiEmailOutline, mdiFingerprint, mdiLifebuoy } from "@mdi/js"
import { For } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"

type MfaFactor = "email-otp" | "passkey" | "recovery-code" | "totp"

const factorIcons: Readonly<Record<MfaFactor, string>> = {
  "email-otp": mdiEmailOutline,
  passkey: mdiFingerprint,
  "recovery-code": mdiLifebuoy,
  totp: mdiCellphoneKey,
}

const factorLabels: Readonly<
  Record<MfaFactor, "login.mfa.emailOtp" | "login.mfa.passkey" | "login.mfa.recoveryCode" | "login.mfa.totp">
> = {
  "email-otp": "login.mfa.emailOtp",
  passkey: "login.mfa.passkey",
  "recovery-code": "login.mfa.recoveryCode",
  totp: "login.mfa.totp",
}

export function MfaPanel(props: {
  readonly factors: readonly MfaFactor[]
  readonly onBack: () => void
  readonly onSelect: (factor: MfaFactor) => void
}) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.mfa.description")}
        title={messageTranslate("login.mfa.title")}
      />
      <div class="mt-6 grid gap-3">
        <For each={props.factors}>
          {(factor) => (
            <Button
              class="w-full min-w-0 justify-start gap-3 p-4 text-left"
              onClick={() => props.onSelect(factor)}
              type="button"
              variant="outline"
            >
              <Icon class="shrink-0" path={factorIcons[factor]} />
              <span class="truncate font-semibold">{messageTranslate(factorLabels[factor])}</span>
            </Button>
          )}
        </For>
      </div>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
