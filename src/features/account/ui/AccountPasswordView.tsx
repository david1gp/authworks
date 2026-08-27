import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiLockOutline } from "@adaptive-ds/mdi/mdiLockOutline.js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
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
      <form class="max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8" onSubmit={props.onSubmit}>
        <div class="flex items-center gap-2">
          <Icon class="size-5 text-accent" path={mdiLockOutline} />
          <h2 class="text-xl font-semibold tracking-tight">{messageTranslate("account.password.title")}</h2>
        </div>
        <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
          {messageTranslate("account.password.description")}
        </p>
        <div class="mt-6 grid gap-5">
          <label class="grid gap-2 text-sm font-medium">
            {messageTranslate("account.password.current")}
            <input
              autocomplete="current-password"
              class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
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
              class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
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
              class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
              minlength={8}
              required
              type="password"
              value={props.confirmPassword}
              onInput={(event) => props.onConfirmPasswordInput(event.currentTarget.value)}
            />
          </label>
        </div>
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
        <Show when={props.status === "success"}>
          <div
            class="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            role="status"
          >
            <Icon class="size-4 shrink-0" path={mdiCheckCircleOutline} />
            <span>{messageTranslate("account.password.changed")}</span>
          </div>
        </Show>
        <div class="mt-6 flex justify-end">
          <Button type="submit" variant="filledBlue">
            {messageTranslate("account.password.submit")}
          </Button>
        </div>
      </form>
    </Show>
  )
}
