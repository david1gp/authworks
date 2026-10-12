import { mdiLockReset } from "@adaptive-ds/mdi/mdiLockReset.js"
import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountViewBoundaryStateGet } from "./accountViewBoundaryStateGet.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountPasswordViewProps = {
  readonly actionOnly?: boolean
  readonly confirmPassword: string
  readonly currentPassword: string
  readonly errorMessage?: string
  readonly hasPassword?: boolean
  readonly newPassword: string
  readonly onDialogOpenChange: (open: boolean) => void
  readonly onConfirmPasswordInput: (value: string) => void
  readonly onCurrentPasswordInput: (value: string) => void
  readonly onNewPasswordInput: (value: string) => void
  readonly onRetry: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly dialogOpen: boolean
  readonly status: AccountViewStatus
  readonly validationMessage?: string
}

export function AccountPasswordView(props: AccountPasswordViewProps) {
  const boundary = () => accountViewBoundaryStateGet(props.status, props.errorMessage)
  const hasPassword = () => props.hasPassword ?? true
  const title = () => messageTranslate(hasPassword() ? "account.password.title" : "account.password.setTitle")
  const submit = () => messageTranslate(hasPassword() ? "account.password.submit" : "account.password.setSubmit")
  const dialog = () => (
    <AuthenticatedDialog
      class="h-7 text-xs sm:justify-self-end"
      description={messageTranslate("account.password.description")}
      onOpenChange={props.onDialogOpenChange}
      open={props.dialogOpen}
      title={title()}
      triggerLabel={submit()}
      triggerIcon={mdiLockReset}
      variant="outline"
    >
      <form class="grid gap-2.5" onSubmit={props.onSubmit}>
        <Show when={hasPassword()} fallback={null}>
          <div class="grid min-w-0 gap-1">
            <Label for="account-password-current">{messageTranslate("account.password.current")}</Label>
            <Input
              autocomplete="current-password"
              id="account-password-current"
              onInput={(event) => props.onCurrentPasswordInput(event.currentTarget.value)}
              required={props.hasPassword !== undefined}
              type="password"
              value={props.currentPassword}
            />
            <Show when={props.hasPassword === undefined}>
              <p class="text-xs text-muted-foreground">{messageTranslate("account.password.currentOptionalHint")}</p>
            </Show>
          </div>
        </Show>
        <div class="grid min-w-0 gap-2.5 sm:grid-cols-2">
          <div class="grid min-w-0 gap-1">
            <Label for="account-password-new">{messageTranslate("account.password.new")}</Label>
            <Input
              autocomplete="new-password"
              id="account-password-new"
              minlength={8}
              onInput={(event) => props.onNewPasswordInput(event.currentTarget.value)}
              required
              type="password"
              value={props.newPassword}
            />
          </div>
          <div class="grid min-w-0 gap-1">
            <Label for="account-password-confirm">{messageTranslate("account.password.confirm")}</Label>
            <Input
              autocomplete="new-password"
              id="account-password-confirm"
              minlength={8}
              onInput={(event) => props.onConfirmPasswordInput(event.currentTarget.value)}
              required
              type="password"
              value={props.confirmPassword}
            />
          </div>
        </div>
        <Show when={props.actionOnly ? props.errorMessage : undefined}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <Show when={props.validationMessage}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <Show when={props.status === "success"}>
          <AuthenticatedNotice
            message={messageTranslate(hasPassword() ? "account.password.changed" : "account.password.set")}
          />
        </Show>
        <div>
          <ButtonIcon icon={mdiLockReset} type="submit">
            {submit()}
          </ButtonIcon>
        </div>
      </form>
    </AuthenticatedDialog>
  )
  return (
    <Show
      when={props.actionOnly}
      fallback={
        <AccountStateBoundary
          detail={boundary().detail}
          onRetry={props.onRetry}
          state={boundary().state}
          title={boundary().title}
        >
          <AuthenticatedSection class="max-w-2xl" title={title()}>
            <div class="grid min-w-0 gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div class="grid min-w-0 gap-1">
                <span class="text-sm font-medium">{messageTranslate("shell.nav.password")}</span>
                <span aria-hidden="true" class="text-xs tracking-[0.2em] text-muted-foreground">
                  ••••••••
                </span>
              </div>
              <div class="sm:justify-self-end">{dialog()}</div>
            </div>
          </AuthenticatedSection>
        </AccountStateBoundary>
      }
    >
      {dialog()}
    </Show>
  )
}
