import { mdiAccountRemoveOutline } from "@adaptive-ds/mdi/mdiAccountRemoveOutline.js"
import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountDeleteViewStateCreate } from "./accountDeleteViewStateCreate.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountDeleteViewProps = {
  readonly confirmation: string
  readonly dialogOpen: boolean
  readonly email: string
  readonly errorMessage?: string
  readonly onConfirmationInput: (value: string) => void
  readonly onDelete: (event: SubmitEvent) => void
  readonly onDialogOpenChange: (open: boolean) => void
  readonly onRetry: () => void
  readonly pending: boolean
  readonly status: AccountViewStatus
  readonly validationMessage?: string
}

export function AccountDeleteView(props: AccountDeleteViewProps) {
  const state = accountDeleteViewStateCreate(props)
  return (
    <AccountStateBoundary
      detail={state.boundary().detail}
      onRetry={props.onRetry}
      state={state.boundary().state}
      title={state.boundary().title}
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
        <AccountDisclosure
          class="border-danger/35"
          icon={mdiAccountRemoveOutline}
          status={messageTranslate("account.delete.dangerZone")}
          statusTone="danger"
          summary={messageTranslate("account.delete.title")}
          variant="card"
        >
          <div class="grid gap-3">
            <p class="text-xs text-muted-foreground">{messageTranslate("account.delete.warning")}</p>
            <div>
              <AuthenticatedDialog
                description={messageTranslate("account.delete.warning")}
                onOpenChange={props.onDialogOpenChange}
                open={props.dialogOpen}
                title={messageTranslate("account.delete.title")}
                triggerIcon={mdiAccountRemoveOutline}
                triggerLabel={messageTranslate("account.delete.dangerZoneToggle")}
                variant="outline"
              >
                <form class="grid gap-3" onSubmit={props.onDelete}>
                  <div class="grid min-w-0 gap-1">
                    <Label for="account-delete-confirmation">
                      {messageTranslate("account.delete.confirmLabel", { email: props.email })}
                    </Label>
                    <Input
                      autocomplete="off"
                      disabled={props.pending}
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
                    <ButtonIcon
                      disabled={props.pending}
                      icon={mdiAccountRemoveOutline}
                      type="submit"
                      variant="filledRed"
                    >
                      {messageTranslate("account.delete.submit")}
                    </ButtonIcon>
                  </div>
                </form>
              </AuthenticatedDialog>
            </div>
          </div>
        </AccountDisclosure>
      </Show>
    </AccountStateBoundary>
  )
}
