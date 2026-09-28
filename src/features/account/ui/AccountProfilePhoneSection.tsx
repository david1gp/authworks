import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiPhoneOutline } from "@adaptive-ds/mdi/mdiPhoneOutline.js"
import { mdiPhonePlusOutline } from "@adaptive-ds/mdi/mdiPhonePlusOutline.js"
import { mdiPhoneRefreshOutline } from "@adaptive-ds/mdi/mdiPhoneRefreshOutline.js"
import { mdiRefresh } from "@adaptive-ds/mdi/mdiRefresh.js"
import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"

/** The phone card keeps its details collapsed and its change/OTP flow inside a dialog. */
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
  return (
    <AccountDisclosure
      class="h-full"
      icon={mdiPhoneOutline}
      status={messageTranslate(
        !props.phoneNumber
          ? "account.profile.notSet"
          : props.verified
            ? "account.profile.verified"
            : "account.profile.verificationPending",
      )}
      statusTone={props.phoneNumber && props.verified ? "success" : "neutral"}
      summary={messageTranslate("account.profile.phoneNumbers")}
      value={props.phoneNumber || messageTranslate("account.profile.notSet")}
      variant="card"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.profile.phoneDescription")}</p>
        <ul aria-label={messageTranslate("account.profile.phoneNumbers")} class="divide-y divide-line-subtle">
          <li class="min-w-0">
            <AuthenticatedDialog
              class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
              description={messageTranslate("account.profile.phoneDescription")}
              onOpenChange={props.onAddDialogOpenChange}
              open={props.addDialogOpen}
              title={messageTranslate(props.phoneNumber ? "account.profile.phoneChange" : "account.profile.phoneAdd")}
              triggerLabel={
                props.phoneNumber ? (
                  <span class="grid min-w-0 gap-1">
                    <span class="sr-only">{messageTranslate("account.profile.phoneChange")}: </span>
                    <span class="break-all font-mono text-sm font-medium">{props.phoneNumber}</span>
                    <AuthenticatedStatus
                      label={
                        props.verified
                          ? messageTranslate("account.profile.verified")
                          : messageTranslate("account.profile.verificationPending")
                      }
                      tone={props.verified ? "success" : "warning"}
                    />
                  </span>
                ) : (
                  messageTranslate("account.profile.phoneAdd")
                )
              }
              triggerIcon={props.phoneNumber ? undefined : mdiPhonePlusOutline}
              variant="ghost"
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
                      <ButtonIcon disabled={props.status === "sending"} icon={mdiPhonePlusOutline} type="submit">
                        {props.status === "sending"
                          ? messageTranslate("account.profile.phoneSending")
                          : messageTranslate(
                              props.phoneNumber ? "account.profile.phoneChange" : "account.profile.phoneAdd",
                            )}
                      </ButtonIcon>
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
                    <ButtonIcon
                      disabled={props.status === "verifying" || props.status === "sending"}
                      icon={mdiCheckCircleOutline}
                      type="submit"
                    >
                      {props.status === "verifying"
                        ? messageTranslate("account.profile.phoneVerifying")
                        : messageTranslate("account.profile.phoneVerify")}
                    </ButtonIcon>
                    <ButtonIcon
                      disabled={props.status === "sending" || props.status === "verifying"}
                      icon={mdiRefresh}
                      onClick={props.onResend}
                      type="button"
                      variant="outline"
                    >
                      {props.status === "sending"
                        ? messageTranslate("account.profile.phoneSending")
                        : messageTranslate("account.profile.phoneResend")}
                    </ButtonIcon>
                    <ButtonIcon icon={mdiPhoneRefreshOutline} onClick={props.onCancel} type="button" variant="ghost">
                      {messageTranslate("account.profile.phoneDifferent")}
                    </ButtonIcon>
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
          </li>
        </ul>
      </div>
      <div class="mt-2 grid gap-2 empty:hidden">
        <Show when={!props.addDialogOpen && props.errorMessage}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <Show when={props.status === "success"}>
          <AuthenticatedNotice message={messageTranslate("account.profile.phoneSaved")} />
        </Show>
      </div>
    </AccountDisclosure>
  )
}
