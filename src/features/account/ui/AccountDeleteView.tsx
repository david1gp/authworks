import { Show } from "solid-js"
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
          class="max-w-2xl rounded-xl border border-danger/40 bg-surface p-5 shadow-sm sm:p-7"
          onSubmit={props.onDelete}
        >
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-danger">
            {messageTranslate("account.delete.dangerZone")}
          </p>
          <h2 class="mt-2 text-xl font-semibold">{messageTranslate("account.delete.title")}</h2>
          <p class="mt-3 leading-7 text-muted-foreground">{messageTranslate("account.delete.warning")}</p>
          <label class="mt-6 grid gap-2 text-sm font-medium">
            {messageTranslate("account.delete.confirmLabel", { email: props.email })}
            <input
              autocomplete="off"
              class="rounded-lg border border-line bg-background px-3 py-2.5"
              required
              value={props.confirmation}
              onInput={(event) => props.onConfirmationInput(event.currentTarget.value)}
            />
          </label>
          <Show when={props.validationMessage}>{(message) => <p class="mt-4 text-sm text-danger">{message()}</p>}</Show>
          <div class="mt-6 flex justify-end">
            <button class="rounded-lg bg-danger px-4 py-2.5 font-semibold text-white" type="submit">
              {messageTranslate("account.delete.submit")}
            </button>
          </div>
        </form>
      </Show>
    </Show>
  )
}
