import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LoginBackLink } from "../../login/ui/LoginBackLink.js"
import { LoginMessages } from "../../login/ui/LoginMessages.js"
import { LoginPanelHeader } from "../../login/ui/LoginPanelHeader.js"
import { LoginSubmitButton } from "../../login/ui/LoginSubmitButton.js"
import type { ExternalIdentityLoginStatus } from "../public/externalIdentityLoginStatusSchema.js"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"
import { ExternalIdentityIcon } from "./ExternalIdentityIcon.js"
import { externalIdentityLoginCopyGet } from "./externalIdentityLoginCopyGet.js"

type ExternalIdentityPanelProps = {
  readonly displayName: string
  readonly errorMessage?: string
  readonly onBack: () => void
  readonly onContinue: () => void
  readonly pending: boolean
  readonly status: ExternalIdentityLoginStatus
  readonly type: ExternalIdentityProviderType
}

export function ExternalIdentityPanel(props: ExternalIdentityPanelProps) {
  const copy = () => externalIdentityLoginCopyGet(props.status, props.displayName)

  return (
    <section data-login-provider-status={props.status}>
      <div class="flex items-start gap-3">
        <span class="mt-1 grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <ExternalIdentityIcon type={props.type} />
        </span>
        <div class="min-w-0">
          <LoginPanelHeader
            description={props.status === "ready" || props.status === "pending" ? copy().description : undefined}
            title={copy().title}
          />
        </div>
      </div>
      <div class="mt-6 grid gap-4">
        <Show when={props.status === "failure"}>
          <p class="text-sm text-muted-foreground" role="status">
            {copy().failureDescription}
          </p>
        </Show>
        <Show when={props.status !== "failure" ? props.errorMessage : undefined}>
          {(message) => <LoginMessages errorMessage={message()} />}
        </Show>
        <Show
          when={
            props.status === "account-not-found" ||
            props.status === "linking-failed" ||
            props.status === "registration-failed"
          }
        >
          <p class="text-sm text-muted-foreground" role="status">
            {copy().description}
          </p>
        </Show>
        <Show when={props.status === "pending"}>
          <p class="text-sm text-muted-foreground" role="status">
            {messageTranslate("login.common.working")}
          </p>
        </Show>
        <Show
          when={
            props.status !== "account-not-found" &&
            props.status !== "linking-failed" &&
            props.status !== "registration-failed"
          }
          fallback={
            <LoginBackLink
              disabled={props.pending}
              label={messageTranslate("login.emailOtp.back")}
              onBack={props.onBack}
            />
          }
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              props.onContinue()
            }}
          >
            <LoginSubmitButton
              label={
                props.status === "failure"
                  ? messageTranslate("common.retry")
                  : messageTranslate("login.provider.submit", { provider: props.displayName })
              }
              pending={props.pending || props.status === "pending"}
              pendingLabel={messageTranslate("login.common.working")}
            />
          </form>
          <LoginBackLink
            disabled={props.pending}
            label={messageTranslate("login.emailOtp.back")}
            onBack={props.onBack}
          />
        </Show>
      </div>
    </section>
  )
}
