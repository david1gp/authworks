import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"

export function MfaPasskeyEnrollPanel(props: {
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly pending: boolean
}) {
  return (
    <section>
      <span class="mb-5 grid size-12 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon path={mdiFingerprint} />
      </span>
      <LoginPanelHeader
        description={messageTranslate("login.mfa.passkeyEnrollmentUnavailableDescription")}
        title={messageTranslate("login.mfa.passkeyEnrollmentUnavailableTitle")}
      />
      <div class="mt-6 grid gap-4">
        <LoginMessages errorMessage={props.errorMessage} />
        <p class="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm text-muted-foreground" role="status">
          {messageTranslate("login.mfa.passkeyEnrollmentUnavailableNotice")}
        </p>
      </div>
      <LoginBackLink disabled={props.pending} onBack={props.onBack} />
    </section>
  )
}
