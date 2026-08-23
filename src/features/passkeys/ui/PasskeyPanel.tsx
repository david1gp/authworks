import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type PasskeyPanelProps = {
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onContinue: () => void
  readonly pending: boolean
  readonly supported: boolean
}

export function PasskeyPanel(props: PasskeyPanelProps) {
  return (
    <section>
      <div class="flex items-start gap-3">
        <span class="mt-1 grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon path={mdiFingerprint} />
        </span>
        <div class="min-w-0">
          <LoginPanelHeader
            description={messageTranslate(props.supported ? "login.passkey.description" : "login.passkey.unsupported")}
            title={messageTranslate("login.passkey.title")}
          />
        </div>
      </div>
      <div class="mt-6 grid gap-4">
        <LoginMessages errorMessage={props.errorMessage} />
        {props.supported ? (
          <LoginSubmitButton
            label={messageTranslate("login.passkey.submit")}
            onClick={props.onContinue}
            pending={props.pending}
            type="button"
          />
        ) : null}
      </div>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
