import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"

export function AccountProfilePhoneSection(props: {
  readonly candidate: string
  readonly challengeActive: boolean
  readonly code: string
  readonly errorMessage?: string
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
  return (
    <AuthenticatedSection
      actions={
        <Show when={props.phoneNumber}>
          <AuthenticatedStatus
            label={
              props.verified
                ? messageTranslate("account.profile.verified")
                : messageTranslate("account.profile.verificationPending")
            }
            tone={props.verified ? "success" : "warning"}
          />
        </Show>
      }
      description={messageTranslate("account.profile.phoneDescription")}
      title={messageTranslate("account.profile.phoneTitle")}
    >
      <div class="grid gap-2.5 px-3 py-3">
        <div class="grid min-w-0 gap-0.5">
          <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
            {messageTranslate("account.profile.phoneNumber")}
          </p>
          <p class="min-w-0 truncate font-mono text-sm">
            {props.phoneNumber ?? messageTranslate("account.profile.phoneNotAdded")}
          </p>
        </div>

        <Show
          when={props.challengeActive}
          fallback={
            <form class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={props.onStart}>
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
              <Button disabled={props.status === "sending"} size="sm" type="submit">
                {props.status === "sending"
                  ? messageTranslate("account.profile.phoneSending")
                  : props.phoneNumber
                    ? messageTranslate("account.profile.phoneChange")
                    : messageTranslate("account.profile.phoneAdd")}
              </Button>
            </form>
          }
        >
          <form class="grid gap-2.5 rounded-control border border-line-subtle px-2.5 py-2.5" onSubmit={props.onVerify}>
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

        <Show when={props.validationMessage}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <Show when={props.errorMessage}>{(message) => <AuthenticatedNotice message={message()} tone="danger" />}</Show>
        <Show when={props.status === "success"}>
          <AuthenticatedNotice message={messageTranslate("account.profile.phoneSaved")} />
        </Show>
      </div>
    </AuthenticatedSection>
  )
}
