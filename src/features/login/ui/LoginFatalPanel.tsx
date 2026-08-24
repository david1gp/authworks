import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginMessages } from "./LoginMessages.js"
import { LoginPanelHeader } from "./LoginPanelHeader.js"

export function LoginFatalPanel(props: {
  readonly errorMessage?: string
  readonly headingRegister: (element: HTMLHeadingElement) => void
}) {
  return (
    <section aria-labelledby="login-fatal-title">
      <LoginPanelHeader
        headingId="login-fatal-title"
        headingRegister={props.headingRegister}
        title={messageTranslate("login.status.fatalTitle")}
      />
      <LoginMessages errorMessage={props.errorMessage} />
    </section>
  )
}
