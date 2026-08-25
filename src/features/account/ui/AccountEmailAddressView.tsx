import { For, Show } from "solid-js"
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
    <div class="grid max-w-4xl gap-6">
      <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold">{messageTranslate("account.profile.emailTitle")}</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {messageTranslate("account.profile.emailAddressDescription")}
            </p>
          </div>
          <button class="rounded-lg border border-line px-4 py-2 font-semibold" type="button" onClick={props.onRetry}>
            {messageTranslate("account.profile.emailRefresh")}
          </button>
        </div>
        <ul class="mt-6 grid gap-3" aria-label={messageTranslate("account.profile.emailAddresses")}>
          <For each={props.addresses}>
            {(address) => (
              <li class="rounded-lg border border-line bg-background p-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                  <div class="min-w-0">
                    <p class="break-all font-medium">{address.email}</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <Show when={address.isPrimary}>
                        <span class="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                          {messageTranslate("account.profile.emailPrimary")}
                        </span>
                      </Show>
                      <span
                        class={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          address.verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {address.verified
                          ? messageTranslate("account.profile.verified")
                          : messageTranslate("account.profile.verificationPending")}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Show when={!address.isPrimary}>
                      <button
                        class="rounded-lg border border-line px-3 py-2 text-sm font-semibold disabled:opacity-60"
                        disabled={!address.verified || props.actionId !== undefined}
                        type="button"
                        onClick={() => props.onPrimarySet(address.id)}
                      >
                        {props.actionId === address.id && props.status === "sending"
                          ? messageTranslate("account.profile.emailUpdating")
                          : messageTranslate("account.profile.emailMakePrimary")}
                      </button>
                    </Show>
                    <button
                      class="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                      disabled={address.isPrimary || props.actionId !== undefined}
                      title={
                        address.isPrimary ? messageTranslate("account.profile.emailPrimaryRemoveBlocked") : undefined
                      }
                      type="button"
                      onClick={() => props.onRemove(address.id)}
                    >
                      {props.actionId === address.id && props.status === "sending"
                        ? messageTranslate("account.profile.emailRemoving")
                        : messageTranslate("account.profile.emailRemove")}
                    </button>
                  </div>
                </div>
              </li>
            )}
          </For>
        </ul>
        <Show when={props.addresses.length === 0}>
          <p class="mt-6 text-sm text-muted-foreground">{messageTranslate("account.profile.emailAddressesEmpty")}</p>
        </Show>
      </section>

      <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <h2 class="text-xl font-semibold">{messageTranslate("account.profile.emailAddTitle")}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("account.profile.emailAddDescription")}</p>
        <Show
          when={props.challengeActive}
          fallback={
            <form class="mt-6 grid gap-4" onSubmit={props.onAddStart}>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.emailNew")}
                <input
                  autocomplete="email"
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  required
                  type="email"
                  value={props.candidate}
                  onInput={(event) => props.onCandidateInput(event.currentTarget.value)}
                />
              </label>
              <div class="flex justify-end">
                <button
                  class="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast disabled:opacity-60"
                  disabled={props.status === "sending"}
                  type="submit"
                >
                  {props.status === "sending"
                    ? messageTranslate("account.profile.emailSending")
                    : messageTranslate("account.profile.emailAdd")}
                </button>
              </div>
            </form>
          }
        >
          <form class="mt-6 grid gap-4" onSubmit={props.onAddVerify}>
            <p class="text-sm text-muted-foreground">
              {props.candidate.length === 0
                ? messageTranslate("account.profile.emailCodeSentGeneric")
                : messageTranslate("account.profile.emailCodeSent", { email: props.candidate })}
            </p>
            <label class="grid gap-2 text-sm font-medium">
              {messageTranslate("account.profile.emailToken")}
              <input
                autocomplete="one-time-code"
                class="rounded-lg border border-line bg-background px-3 py-2.5"
                required
                value={props.token}
                onInput={(event) => props.onTokenInput(event.currentTarget.value)}
              />
            </label>
            <div class="flex flex-wrap justify-end gap-3">
              <button
                class="rounded-lg border border-line px-4 py-2.5 font-semibold"
                type="button"
                onClick={props.onAddCancel}
              >
                {messageTranslate("account.profile.emailDifferent")}
              </button>
              <button
                class="rounded-lg border border-line px-4 py-2.5 font-semibold"
                disabled={props.status === "sending" || props.status === "verifying"}
                type="button"
                onClick={props.onAddResend}
              >
                {props.status === "sending"
                  ? messageTranslate("account.profile.emailSending")
                  : messageTranslate("account.profile.emailResend")}
              </button>
              <button
                class="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast disabled:opacity-60"
                disabled={props.status === "verifying" || props.status === "sending"}
                type="submit"
              >
                {props.status === "verifying"
                  ? messageTranslate("account.profile.emailVerifying")
                  : messageTranslate("account.profile.emailVerify")}
              </button>
            </div>
          </form>
        </Show>
        <Show when={props.validationMessage}>{(message) => <p class="mt-4 text-sm text-danger">{message()}</p>}</Show>
        <Show when={props.errorMessage}>
          {(message) => (
            <p class="mt-4 text-sm text-danger" role="alert">
              {message()}
            </p>
          )}
        </Show>
        <Show when={props.status === "success"}>
          <p class="mt-4 text-sm font-medium text-success" role="status">
            {messageTranslate("account.profile.emailAddressesSaved")}
          </p>
        </Show>
      </section>
    </div>
  )
}
