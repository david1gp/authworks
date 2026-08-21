import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "./LoginBackLink.js"
import { LoginMessages } from "./LoginMessages.js"
import { LoginPanelHeader } from "./LoginPanelHeader.js"
import { LoginSubmitButton } from "./LoginSubmitButton.js"

export function LoginLogoutPanel(props: {
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onLogout: () => void
  readonly organizationName: string
  readonly pending: boolean
}) {
  return (
    <section>
      <LoginPanelHeader
        description={messageTranslate("login.logout.description")}
        title={messageTranslate("login.logout.title", { organization: props.organizationName })}
      />
      <div class="mt-6 grid gap-4">
        <LoginMessages errorMessage={props.errorMessage} />
        <LoginSubmitButton
          label={messageTranslate("login.logout.submit")}
          onClick={props.onLogout}
          pending={props.pending}
          type="button"
        />
      </div>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
