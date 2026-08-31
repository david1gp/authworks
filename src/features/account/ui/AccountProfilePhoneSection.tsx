import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"

/**
 * Phone numbers column of the contact-methods grid: the verified number with its status, and a
 * single compact add/change control that opens the change/OTP flow in a dialog.
 */
export function AccountProfilePhoneSection(props: {
  readonly addDialogOpen: boolean
  readonly candidate: string
  readonly challengeActive: boolean
  readonly code: string
  readonly errorMessage?: string
  readonly onAddDialogOpenChange: (open: boolean) => void
  readonly onCancel: () => void
  readonly onCodeInput: (value: string) => void
  readonly onInput: (value: string) => void
  readonly onResend: () => void
  readonly onStart: (event: SubmitEvent) => void
  readonly onVerify: (event: SubmitEvent) => void
  readonly phoneNumber?: string
  readonly status: AccountPhoneViewStatus
  readonly validationMessage?: string
  readonly verified: boolean
}) {
  const addLabel = () =>
    props.phoneNumber ? messageTranslate("account.profile.phoneChange") : messageTranslate("account.profile.phoneAdd")
  return (
    <AuthenticatedSection
      actions={
        <AuthenticatedDialog
          class="h-7 text-xs"
          description={messageTranslate("account.profile.phoneDescription")}
          onOpenChange={props.onAddDialogOpenChange}
          open={props.addDialogOpen}
          title={addLabel()}
          triggerLabel={addLabel()}
          variant="outline"
        >
          <Show
            when={props.challengeActive}
            fallback={
              <form class="grid gap-3" onSubmit={props.onStart}>
                <div class="grid min-w-0 gap-1">
                  <Label for="account-phone-number">
                    {props.phoneNumber
                      ? messageTranslate("account.profile.phoneNew")
                      : messageTranslate("account.profile.phoneNumber")}
                  </Label>
                  <Input
                    autocomplete="tel"
                    id="account-phone-number"
                    inputmode="tel"
                    maxlength={16}
                    onInput={(event) => props.onInput(event.currentTarget.value)}
                    placeholder={messageTranslate("account.profile.phonePlaceholder")}
                    required
                    type="tel"
                    value={props.candidate}
                  />
                  <p class="text-xs text-muted-foreground">{messageTranslate("account.profile.phoneHint")}</p>
                </div>
                <div>
                  <Button disabled={props.status === "sending"} size="sm" type="submit">
                    {props.status === "sending" ? messageTranslate("account.profile.phoneSending") : addLabel()}
                  </Button>
                </div>
              </form>
            }
          >
            <form class="grid gap-3" onSubmit={props.onVerify}>
              <p class="text-xs text-muted-foreground">
                {messageTranslate("account.profile.phoneCodeSent", { phoneNumber: props.candidate })}
              </p>
              <div class="grid min-w-0 max-w-xs gap-1">
                <Label for="account-phone-code">{messageTranslate("account.profile.phoneCode")}</Label>
                <Input
                  autocomplete="one-time-code"
                  class="font-mono tracking-[0.2em]"
                  id="account-phone-code"
                  inputmode="numeric"
                  maxlength={6}
                  onInput={(event) => props.onCodeInput(event.currentTarget.value)}
                  pattern="[0-9]{6}"
                  required
                  value={props.code}
                />
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Button disabled={props.status === "verifying" || props.status === "sending"} size="sm" type="submit">
                  {props.status === "verifying"
                    ? messageTranslate("account.profile.phoneVerifying")
                    : messageTranslate("account.profile.phoneVerify")}
                </Button>
                <Button
                  disabled={props.status === "sending" || props.status === "verifying"}
                  onClick={props.onResend}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {props.status === "sending"
                    ? messageTranslate("account.profile.phoneSending")
                    : messageTranslate("account.profile.phoneResend")}
                </Button>
                <Button onClick={props.onCancel} size="sm" type="button" variant="ghost">
                  {messageTranslate("account.profile.phoneDifferent")}
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
      }
      class="h-full"
      title={messageTranslate("account.profile.phoneNumbers")}
    >
      <Show
        when={props.phoneNumber}
        fallback={
          <p class="px-3 py-2.5 text-xs text-muted-foreground">
            {messageTranslate("account.profile.phoneNumbersEmpty")}
          </p>
        }
      >
        {(phoneNumber) => (
          <ul aria-label={messageTranslate("account.profile.phoneNumbers")} class="divide-y divide-line-subtle">
            <li class="grid min-w-0 gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <span class="min-w-0 break-all font-mono text-sm font-medium">{phoneNumber()}</span>
              <div class="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <AuthenticatedStatus
                  label={
                    props.verified
                      ? messageTranslate("account.profile.verified")
                      : messageTranslate("account.profile.verificationPending")
                  }
                  tone={props.verified ? "success" : "warning"}
                />
              </div>
            </li>
          </ul>
        )}
      </Show>

      <div class="grid gap-2 px-3 pb-3 empty:hidden">
        <Show when={!props.addDialogOpen && props.errorMessage}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <Show when={props.status === "success"}>
          <AuthenticatedNotice message={messageTranslate("account.profile.phoneSaved")} />
        </Show>
      </div>
    </AuthenticatedSection>
  )
}
