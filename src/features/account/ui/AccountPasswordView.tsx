import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountPasswordViewProps = {
  readonly confirmPassword: string
  readonly currentPassword: string
  readonly errorMessage?: string
  readonly newPassword: string
  readonly onConfirmPasswordInput: (value: string) => void
  readonly onCurrentPasswordInput: (value: string) => void
  readonly onNewPasswordInput: (value: string) => void
  readonly onRetry: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly status: AccountViewStatus
  readonly validationMessage?: string
}

export function AccountPasswordView(props: AccountPasswordViewProps) {
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
      <form class="max-w-2xl rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-7" onSubmit={props.onSubmit}>
        <h2 class="text-xl font-semibold">{messageTranslate("account.password.title")}</h2>
        <p class="mt-1 text-sm leading-6 text-muted-foreground">{messageTranslate("account.password.description")}</p>
        <div class="mt-6 grid gap-5">
          <label class="grid gap-2 text-sm font-medium">
            {messageTranslate("account.password.current")}
            <input
              autocomplete="current-password"
              class="rounded-lg border border-line bg-background px-3 py-2.5"
              required
              type="password"
              value={props.currentPassword}
              onInput={(event) => props.onCurrentPasswordInput(event.currentTarget.value)}
            />
          </label>
          <label class="grid gap-2 text-sm font-medium">
            {messageTranslate("account.password.new")}
            <input
              autocomplete="new-password"
              class="rounded-lg border border-line bg-background px-3 py-2.5"
              minlength={8}
              required
              type="password"
              value={props.newPassword}
              onInput={(event) => props.onNewPasswordInput(event.currentTarget.value)}
            />
          </label>
          <label class="grid gap-2 text-sm font-medium">
            {messageTranslate("account.password.confirm")}
            <input
              autocomplete="new-password"
              class="rounded-lg border border-line bg-background px-3 py-2.5"
              minlength={8}
              required
              type="password"
              value={props.confirmPassword}
              onInput={(event) => props.onConfirmPasswordInput(event.currentTarget.value)}
            />
          </label>
        </div>
        <Show when={props.validationMessage}>{(message) => <p class="mt-4 text-sm text-danger">{message()}</p>}</Show>
        <Show when={props.status === "success"}>
          <p class="mt-4 text-sm font-medium text-success" role="status">
            {messageTranslate("account.password.changed")}
          </p>
        </Show>
        <div class="mt-6 flex justify-end">
          <button class="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast" type="submit">
            {messageTranslate("account.password.submit")}
          </button>
        </div>
      </form>
    </Show>
  )
}
