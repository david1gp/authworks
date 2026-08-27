import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiAlertOutline } from "@adaptive-ds/mdi/mdiAlertOutline.js"
import { mdiTrashCanOutline } from "@adaptive-ds/mdi/mdiTrashCanOutline.js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
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
  return (
    <Show
      when={props.status !== "loading" && props.status !== "error" && props.status !== "expired"}
      fallback={
        <ProductionStatePanel
          detail={props.errorMessage}
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={props.status === "loading" ? "loading" : props.status === "expired" ? "inaccessible" : "error"}
          title={props.status === "expired" ? messageTranslate("account.sessionExpired") : undefined}
        />
      }
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
        <form
          class="max-w-2xl rounded-2xl border border-red-200 bg-surface p-6 shadow-xs transition-colors dark:border-red-900/60 sm:p-8"
          onSubmit={props.onDelete}
        >
          <div class="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-1.5 w-fit">
            <Icon class="size-4 text-danger" path={mdiAlertOutline} />
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-danger">
              {messageTranslate("account.delete.dangerZone")}
            </p>
          </div>
          <h2 class="mt-4 text-xl font-semibold tracking-tight">{messageTranslate("account.delete.title")}</h2>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{messageTranslate("account.delete.warning")}</p>
          <label class="mt-6 grid gap-2 text-sm font-medium">
            {messageTranslate("account.delete.confirmLabel", { email: props.email })}
            <input
              autocomplete="off"
              class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/15"
              required
              value={props.confirmation}
              onInput={(event) => props.onConfirmationInput(event.currentTarget.value)}
            />
          </label>
          <Show when={props.validationMessage}>
            {(message) => (
              <div
                class="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3.5 text-sm text-danger"
                role="alert"
              >
                <Icon class="size-4 shrink-0" path={mdiAlertCircleOutline} />
                <span>{message()}</span>
              </div>
            )}
          </Show>
          <div class="mt-6 flex justify-end">
            <Button
              class="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
              type="submit"
              variant="filledRed"
            >
              <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
              {messageTranslate("account.delete.submit")}
            </Button>
          </div>
        </form>
      </Show>
    </Show>
  )
}
