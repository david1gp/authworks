import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiClockOutline } from "@adaptive-ds/mdi/mdiClockOutline.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiEmailPlusOutline } from "@adaptive-ds/mdi/mdiEmailPlusOutline.js"
import { mdiRefresh } from "@adaptive-ds/mdi/mdiRefresh.js"
import { mdiStar } from "@adaptive-ds/mdi/mdiStar.js"
import { mdiTrashCanOutline } from "@adaptive-ds/mdi/mdiTrashCanOutline.js"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"

type AccountEmailAddressViewProps = {
  readonly actionId?: string
  readonly addresses: readonly UserEmailAddress[]
  readonly candidate: string
  readonly challengeActive: boolean
  readonly errorMessage?: string
  readonly onAddCancel: () => void
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
  return (
    <div class="grid max-w-4xl gap-6 sm:gap-8">
      <section class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <Icon class="size-5 text-accent" path={mdiEmailOutline} />
              <h2 class="text-xl font-semibold tracking-tight">{messageTranslate("account.profile.emailTitle")}</h2>
            </div>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
              {messageTranslate("account.profile.emailAddressDescription")}
            </p>
          </div>
          <Button onClick={props.onRetry} type="button" variant="outline">
            <Icon class="mr-1.5 size-4" path={mdiRefresh} />
            {messageTranslate("account.profile.emailRefresh")}
          </Button>
        </div>

        <ul class="mt-6 grid gap-3" aria-label={messageTranslate("account.profile.emailAddresses")}>
          <For each={props.addresses}>
            {(address) => (
              <li class="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong/60 shadow-2xs">
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon class="size-5" path={mdiEmailOutline} />
                    </div>
                    <div class="min-w-0">
                      <p class="break-all font-medium text-foreground">{address.email}</p>
                      <div class="mt-1 flex flex-wrap items-center gap-2">
                        <Show when={address.isPrimary}>
                          <span class="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent dark:bg-accent/20">
                            <Icon class="size-3" path={mdiStar} />
                            {messageTranslate("account.profile.emailPrimary")}
                          </span>
                        </Show>
                        <span
                          class={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            address.verified
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          <Icon class="size-3" path={address.verified ? mdiCheckCircleOutline : mdiClockOutline} />
                          {address.verified
                            ? messageTranslate("account.profile.verified")
                            : messageTranslate("account.profile.verificationPending")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Show when={!address.isPrimary}>
                      <Button
                        disabled={!address.verified || props.actionId !== undefined}
                        onClick={() => props.onPrimarySet(address.id)}
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
                      title={
                        address.isPrimary ? messageTranslate("account.profile.emailPrimaryRemoveBlocked") : undefined
                      }
                      type="button"
                      variant="outlineRed"
                    >
                      <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                      {props.actionId === address.id && props.status === "sending"
                        ? messageTranslate("account.profile.emailRemoving")
                        : messageTranslate("account.profile.emailRemove")}
                    </Button>
                  </div>
                </div>
              </li>
            )}
          </For>
        </ul>
        <Show when={props.addresses.length === 0}>
          <div class="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
            {messageTranslate("account.profile.emailAddressesEmpty")}
          </div>
        </Show>
      </section>

      <section class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
        <div class="flex items-center gap-2">
          <Icon class="size-5 text-accent" path={mdiEmailPlusOutline} />
          <h2 class="text-xl font-semibold tracking-tight">{messageTranslate("account.profile.emailAddTitle")}</h2>
        </div>
        <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
          {messageTranslate("account.profile.emailAddDescription")}
        </p>
        <Show
          when={props.challengeActive}
          fallback={
            <form class="mt-6 grid gap-4" onSubmit={props.onAddStart}>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.emailNew")}
                <input
                  autocomplete="email"
                  class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  required
                  type="email"
                  value={props.candidate}
                  onInput={(event) => props.onCandidateInput(event.currentTarget.value)}
                />
              </label>
              <div class="flex justify-end">
                <Button disabled={props.status === "sending"} type="submit" variant="filledBlue">
                  {props.status === "sending"
                    ? messageTranslate("account.profile.emailSending")
                    : messageTranslate("account.profile.emailAdd")}
                </Button>
              </div>
            </form>
          }
        >
          <form class="mt-6 grid gap-4 rounded-xl border border-accent/30 bg-accent/5 p-5" onSubmit={props.onAddVerify}>
            <p class="text-sm font-medium text-foreground">
              {props.candidate.length === 0
                ? messageTranslate("account.profile.emailCodeSentGeneric")
                : messageTranslate("account.profile.emailCodeSent", { email: props.candidate })}
            </p>
            <label class="grid gap-2 text-sm font-medium">
              {messageTranslate("account.profile.emailToken")}
              <input
                autocomplete="one-time-code"
                class="rounded-xl border border-line bg-background px-3.5 py-2.5 font-mono text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                required
                value={props.token}
                onInput={(event) => props.onTokenInput(event.currentTarget.value)}
              />
            </label>
            <div class="flex flex-wrap justify-end gap-3 pt-2">
              <Button onClick={props.onAddCancel} type="button" variant="ghost">
                {messageTranslate("account.profile.emailDifferent")}
              </Button>
              <Button
                disabled={props.status === "sending" || props.status === "verifying"}
                onClick={props.onAddResend}
                type="button"
                variant="outline"
              >
                {props.status === "sending"
                  ? messageTranslate("account.profile.emailSending")
                  : messageTranslate("account.profile.emailResend")}
              </Button>
              <Button
                disabled={props.status === "verifying" || props.status === "sending"}
                type="submit"
                variant="filledBlue"
              >
                {props.status === "verifying"
                  ? messageTranslate("account.profile.emailVerifying")
                  : messageTranslate("account.profile.emailVerify")}
              </Button>
            </div>
          </form>
        </Show>
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
        <Show when={props.errorMessage}>
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
            <span>{messageTranslate("account.profile.emailAddressesSaved")}</span>
          </div>
        </Show>
      </section>
    </div>
  )
}
