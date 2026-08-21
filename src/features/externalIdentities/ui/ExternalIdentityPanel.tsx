import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"
import { ExternalIdentityIcon } from "./ExternalIdentityIcon.js"

type ExternalIdentityPanelProps = {
  readonly displayName: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onContinue: () => void
  readonly pending: boolean
  readonly type: ExternalIdentityProviderType
}

export function ExternalIdentityPanel(props: ExternalIdentityPanelProps) {
  return (
    <section>
      <div class="flex items-start gap-3">
        <span class="mt-1 grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <ExternalIdentityIcon type={props.type} />
        </span>
        <div class="min-w-0">
          <LoginPanelHeader
            description={messageTranslate("login.provider.description", { provider: props.displayName })}
            title={messageTranslate("login.provider.title", { provider: props.displayName })}
          />
        </div>
      </div>
      <div class="mt-6 grid gap-4">
        <LoginMessages errorMessage={props.errorMessage} />
        <LoginSubmitButton
          label={messageTranslate("login.provider.submit", { provider: props.displayName })}
          onClick={props.onContinue}
          pending={props.pending}
          type="button"
        />
      </div>
      <LoginBackLink onBack={props.onBack} />
    </section>
  )
}
