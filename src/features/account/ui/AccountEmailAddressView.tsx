import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiEmailEditOutline } from "@adaptive-ds/mdi/mdiEmailEditOutline.js"
import { mdiEmailFastOutline } from "@adaptive-ds/mdi/mdiEmailFastOutline.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiEmailPlusOutline } from "@adaptive-ds/mdi/mdiEmailPlusOutline.js"
import { mdiEmailRemoveOutline } from "@adaptive-ds/mdi/mdiEmailRemoveOutline.js"
import { mdiRefresh } from "@adaptive-ds/mdi/mdiRefresh.js"
import { mdiStarOutline } from "@adaptive-ds/mdi/mdiStarOutline.js"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"
import { accountEmailAddressViewStateCreate } from "./accountEmailAddressViewStateCreate.js"

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

export function AccountEmailAddressView(props: AccountEmailAddressViewProps) {
  const state = accountEmailAddressViewStateCreate(() => props.addresses)
  return (
    <AccountDisclosure
      icon={mdiEmailOutline}
      summary={messageTranslate("account.profile.emailAddresses")}
      value={state.summaryValue()}
      status={state.summaryStatus()}
      statusTone={state.summaryTone()}
      variant="card"
      class="h-full"
    >
      <div class="grid gap-3">
        <p class="text-xs text-muted-foreground">{messageTranslate("account.profile.emailDescription")}</p>
        <div class="flex flex-wrap gap-2">
          <ButtonIcon class="h-8 text-xs" icon={mdiRefresh} onClick={props.onRetry} type="button" variant="outline">
            {messageTranslate("account.profile.emailRefresh")}
          </ButtonIcon>
        </div>
        <ul aria-label={messageTranslate("account.profile.emailAddresses")} class="divide-y divide-line-subtle">
          <Show when={props.addresses.length === 0}>
            <li class="px-2 py-2.5 text-xs text-muted-foreground">
              {messageTranslate("account.profile.emailAddressesEmpty")}
            </li>
          </Show>
          <For each={props.addresses}>
            {(address) => (
              <li class="min-w-0">
                <AuthenticatedDialog
                  class="!flex !h-auto w-full min-w-0 !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
                  onOpenChange={(open) => state.dialogOpenChange(address.id, open)}
                  open={state.dialogOpen(address.id)}
                  title={address.email}
                  triggerLabel={
                    <span class="grid min-w-0 gap-1">
                      <span class="min-w-0 break-all text-sm font-medium">{address.email}</span>
                      <span class="flex flex-wrap items-center gap-1.5">
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
                      </span>
                    </span>
                  }
                  variant="ghost"
                >
                  <div class="grid gap-3">
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
                    <div class="flex flex-wrap gap-2">
                      <Show when={!address.isPrimary}>
                        <ButtonIcon
                          disabled={!address.verified || props.actionId !== undefined}
                          icon={mdiStarOutline}
                          onClick={() => props.onPrimarySet(address.id)}
                          type="button"
                          variant="outline"
                        >
                          {props.actionId === address.id && props.status === "sending"
                            ? messageTranslate("account.profile.emailUpdating")
                            : messageTranslate("account.profile.emailMakePrimary")}
                        </ButtonIcon>
                      </Show>
                      <ButtonIcon
                        class={authenticatedDangerOutlineButtonClass}
                        disabled={address.isPrimary || props.actionId !== undefined}
                        icon={mdiEmailRemoveOutline}
                        onClick={() => props.onRemove(address.id)}
                        title={
                          address.isPrimary ? messageTranslate("account.profile.emailPrimaryRemoveBlocked") : undefined
                        }
                        type="button"
                        variant="outline"
                      >
                        {props.actionId === address.id && props.status === "sending"
                          ? messageTranslate("account.profile.emailRemoving")
                          : messageTranslate("account.profile.emailRemove")}
                      </ButtonIcon>
                    </div>
                    <Show when={!props.addDialogOpen && props.errorMessage}>
                      {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                    </Show>
                  </div>
                </AuthenticatedDialog>
              </li>
            )}
          </For>
          <li>
            <AuthenticatedDialog
              class="!flex !h-auto w-full !justify-start !rounded-none !px-2 !py-2.5 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent"
              description={messageTranslate("account.profile.emailAddDescription")}
              onOpenChange={props.onAddDialogOpenChange}
              open={props.addDialogOpen}
              title={messageTranslate("account.profile.emailAddTitle")}
              triggerLabel={messageTranslate("account.profile.emailAdd")}
              triggerIcon={mdiEmailPlusOutline}
              variant="ghost"
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
                      <ButtonIcon disabled={props.status === "sending"} icon={mdiEmailPlusOutline} type="submit">
                        {props.status === "sending"
                          ? messageTranslate("account.profile.emailSending")
                          : messageTranslate("account.profile.emailAdd")}
                      </ButtonIcon>
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
                    <ButtonIcon
                      disabled={props.status === "verifying" || props.status === "sending"}
                      icon={mdiCheckCircleOutline}
                      type="submit"
                    >
                      {props.status === "verifying"
                        ? messageTranslate("account.profile.emailVerifying")
                        : messageTranslate("account.profile.emailVerify")}
                    </ButtonIcon>
                    <ButtonIcon
                      disabled={props.status === "sending" || props.status === "verifying"}
                      icon={mdiEmailFastOutline}
                      onClick={props.onAddResend}
                      type="button"
                      variant="outline"
                    >
                      {props.status === "sending"
                        ? messageTranslate("account.profile.emailSending")
                        : messageTranslate("account.profile.emailResend")}
                    </ButtonIcon>
                    <ButtonIcon icon={mdiEmailEditOutline} onClick={props.onAddCancel} type="button" variant="ghost">
                      {messageTranslate("account.profile.emailDifferent")}
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
          <AuthenticatedNotice message={messageTranslate("account.profile.emailAddressesSaved")} />
        </Show>
      </div>
    </AccountDisclosure>
  )
}
