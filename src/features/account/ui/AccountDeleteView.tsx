import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountViewBoundaryStateGet } from "./accountViewBoundaryStateGet.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountDeleteViewProps = {
  readonly confirmation: string
  readonly email: string
  readonly errorMessage?: string
  readonly onConfirmationInput: (value: string) => void
  readonly onDelete: (event: SubmitEvent) => void
  readonly onRetry: () => void
  readonly status: AccountViewStatus
  readonly validationMessage?: string
}

export function AccountDeleteView(props: AccountDeleteViewProps) {
  const boundary = () => accountViewBoundaryStateGet(props.status, props.errorMessage)
  return (
    <AccountStateBoundary
      detail={boundary().detail}
      onRetry={props.onRetry}
      state={boundary().state}
      title={boundary().title}
    >
      <Show
        when={props.status !== "success"}
        fallback={
          <ProductionStatePanel
            detail={messageTranslate("account.delete.deletedDetail")}
            state="empty"
            title={messageTranslate("account.delete.deletedTitle")}
          />
        }
      >
        <AuthenticatedSection
          actions={<AuthenticatedStatus label={messageTranslate("account.delete.dangerZone")} tone="danger" />}
          class="max-w-2xl border-danger/35"
          description={messageTranslate("account.delete.warning")}
          title={messageTranslate("account.delete.title")}
        >
          <form class="grid gap-2.5 px-3 py-3" onSubmit={props.onDelete}>
            <div class="grid min-w-0 gap-1">
              <Label for="account-delete-confirmation">
                {messageTranslate("account.delete.confirmLabel", { email: props.email })}
              </Label>
              <Input
                autocomplete="off"
                id="account-delete-confirmation"
                onInput={(event) => props.onConfirmationInput(event.currentTarget.value)}
                required
                value={props.confirmation}
              />
            </div>
            <Show when={props.validationMessage}>
              {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
            </Show>
            <div>
              <Button size="sm" type="submit" variant="filledRed">
                {messageTranslate("account.delete.submit")}
              </Button>
            </div>
          </form>
        </AuthenticatedSection>
      </Show>
    </AccountStateBoundary>
  )
}
