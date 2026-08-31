import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"

type AccountEmailAddressViewProps = {
  readonly actionId?: string
  readonly addDialogOpen: boolean
  readonly addresses: readonly UserEmailAddress[]
  readonly candidate: string
  readonly challengeActive: boolean
  readonly errorMessage?: string
  readonly onAddCancel: () => void
  readonly onAddDialogOpenChange: (open: boolean) => void
  readonly onAddResend: () => void
  readonly onAddStart: (event: SubmitEvent) => void
  readonly onAddVerify: (event: SubmitEvent) => void
  readonly onCandidateInput: (value: string) => void
  readonly onPrimarySet: (emailId: string) => void
  readonly onRemove: (emailId: string) => void
  readonly onRetry: () => void
  readonly onTokenInput: (value: string) => void
  readonly status: AccountEmailViewStatus
  readonly token: string
  readonly validationMessage?: string
}

/**
 * Email addresses column of the contact-methods grid: one list row per address with its status and
 * lifecycle actions, and a single compact add control that opens the add/verify flow in a dialog.
 */
export function AccountEmailAddressView(props: AccountEmailAddressViewProps) {
  return (
    <AuthenticatedSection
      actions={
        <>
          <Button class="h-7 text-xs" onClick={props.onRetry} type="button" variant="outline">
            {messageTranslate("account.profile.emailRefresh")}
          </Button>
          <AuthenticatedDialog
            class="h-7 text-xs"
            description={messageTranslate("account.profile.emailAddDescription")}
            onOpenChange={props.onAddDialogOpenChange}
            open={props.addDialogOpen}
            title={messageTranslate("account.profile.emailAddTitle")}
            triggerLabel={messageTranslate("account.profile.emailAdd")}
            variant="outline"
          >
            <Show
              when={props.challengeActive}
              fallback={
                <form class="grid gap-3" onSubmit={props.onAddStart}>
                  <div class="grid min-w-0 gap-1">
                    <Label for="account-email-new">{messageTranslate("account.profile.emailNew")}</Label>
                    <Input
                      autocomplete="email"
                      id="account-email-new"
                      onInput={(event) => props.onCandidateInput(event.currentTarget.value)}
                      required
                      type="email"
                      value={props.candidate}
                    />
                  </div>
                  <div>
                    <Button disabled={props.status === "sending"} size="sm" type="submit">
                      {props.status === "sending"
                        ? messageTranslate("account.profile.emailSending")
                        : messageTranslate("account.profile.emailAdd")}
                    </Button>
                  </div>
                </form>
              }
            >
              <form class="grid gap-3" onSubmit={props.onAddVerify}>
                <p class="text-xs text-muted-foreground">
                  {props.candidate.length === 0
                    ? messageTranslate("account.profile.emailCodeSentGeneric")
                    : messageTranslate("account.profile.emailCodeSent", { email: props.candidate })}
                </p>
                <div class="grid min-w-0 gap-1">
                  <Label for="account-email-token">{messageTranslate("account.profile.emailToken")}</Label>
                  <Input
                    autocomplete="one-time-code"
                    class="font-mono"
                    id="account-email-token"
                    onInput={(event) => props.onTokenInput(event.currentTarget.value)}
                    required
                    value={props.token}
                  />
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Button disabled={props.status === "verifying" || props.status === "sending"} size="sm" type="submit">
                    {props.status === "verifying"
                      ? messageTranslate("account.profile.emailVerifying")
                      : messageTranslate("account.profile.emailVerify")}
                  </Button>
                  <Button
                    disabled={props.status === "sending" || props.status === "verifying"}
                    onClick={props.onAddResend}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {props.status === "sending"
                      ? messageTranslate("account.profile.emailSending")
                      : messageTranslate("account.profile.emailResend")}
                  </Button>
                  <Button onClick={props.onAddCancel} size="sm" type="button" variant="ghost">
                    {messageTranslate("account.profile.emailDifferent")}
                  </Button>
                </div>
              </form>
            </Show>

            <div class="mt-3 grid gap-2 empty:hidden">
              <Show when={props.validationMessage}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <Show when={props.errorMessage}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
            </div>
          </AuthenticatedDialog>
        </>
      }
      class="h-full"
      title={messageTranslate("account.profile.emailAddresses")}
    >
      <Show
        when={props.addresses.length > 0}
        fallback={
          <p class="px-3 py-2.5 text-xs text-muted-foreground">
            {messageTranslate("account.profile.emailAddressesEmpty")}
          </p>
        }
      >
        <ul aria-label={messageTranslate("account.profile.emailAddresses")} class="divide-y divide-line-subtle">
          <For each={props.addresses}>
            {(address) => (
              <li class="grid min-w-0 gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                {/* An address is the account's recovery identity, so it wraps to stay fully
                  readable on narrow viewports instead of truncating behind its actions. */}
                <div class="grid min-w-0 gap-1">
                  <span class="min-w-0 break-all text-sm font-medium">{address.email}</span>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <Show when={address.isPrimary}>
                      <AuthenticatedStatus label={messageTranslate("account.profile.emailPrimary")} tone="accent" />
                    </Show>
                    <AuthenticatedStatus
                      label={
                        address.verified
                          ? messageTranslate("account.profile.verified")
                          : messageTranslate("account.profile.verificationPending")
                      }
                      tone={address.verified ? "success" : "warning"}
                    />
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <Show when={!address.isPrimary}>
                    <Button
                      disabled={!address.verified || props.actionId !== undefined}
                      onClick={() => props.onPrimarySet(address.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {props.actionId === address.id && props.status === "sending"
                        ? messageTranslate("account.profile.emailUpdating")
                        : messageTranslate("account.profile.emailMakePrimary")}
                    </Button>
                  </Show>
                  <Button
                    disabled={address.isPrimary || props.actionId !== undefined}
                    onClick={() => props.onRemove(address.id)}
                    size="sm"
                    title={
                      address.isPrimary ? messageTranslate("account.profile.emailPrimaryRemoveBlocked") : undefined
                    }
                    type="button"
                    variant="filledRed"
                  >
                    {props.actionId === address.id && props.status === "sending"
                      ? messageTranslate("account.profile.emailRemoving")
                      : messageTranslate("account.profile.emailRemove")}
                  </Button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <div class="grid gap-2 px-3 pb-3 empty:hidden">
        <Show when={!props.addDialogOpen && props.errorMessage}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <Show when={props.status === "success"}>
          <AuthenticatedNotice message={messageTranslate("account.profile.emailAddressesSaved")} />
        </Show>
      </div>
    </AuthenticatedSection>
  )
}
