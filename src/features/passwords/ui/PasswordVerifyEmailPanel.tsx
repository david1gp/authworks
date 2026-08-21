import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"

type PasswordVerifyEmailPanelProps = {
  readonly email: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: boolean
  readonly validationMessage?: string
  readonly verified: boolean
}

export function PasswordVerifyEmailPanel(props: PasswordVerifyEmailPanelProps) {
  return (
    <section>
      <LoginPanelHeader
        description={
          props.verified
            ? messageTranslate("login.verify.verifiedDescription", { email: props.email })
            : messageTranslate("login.verify.description")
        }
        title={messageTranslate(props.verified ? "login.verify.verifiedTitle" : "login.verify.title")}
      />
      {props.verified ? (
        <p class="mt-6 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success" role="status">
          {messageTranslate("login.verify.verifiedDescription", { email: props.email })}
        </p>
      ) : (
        <form class="mt-6 grid gap-4" novalidate onSubmit={props.onSubmit}>
          <LoginMessages errorMessage={props.errorMessage} validationMessage={props.validationMessage} />
          <LoginSubmitButton label={messageTranslate("login.verify.submit")} pending={props.pending} />
        </form>
      )}
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
