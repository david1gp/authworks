import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountProfileViewProps = {
  readonly displayName: string
  readonly email: string
  readonly emailVerified: boolean
  readonly errorMessage?: string
  readonly firstName: string
  readonly kind: "email" | "overview" | "profile"
  readonly lastName: string
  readonly nickName: string
  readonly onDisplayNameInput: (value: string) => void
  readonly onFirstNameInput: (value: string) => void
  readonly onLastNameInput: (value: string) => void
  readonly onNickNameInput: (value: string) => void
  readonly onPreferredLanguageInput: (value: string) => void
  readonly onRetry: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly preferredLanguage: string
  readonly status: AccountViewStatus
  readonly userName: string
  readonly validationMessage?: string
}

export function AccountProfileView(props: AccountProfileViewProps) {
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
      <div class="grid max-w-4xl gap-6">
        <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold">
                {props.kind === "email"
                  ? messageTranslate("account.profile.emailTitle")
                  : messageTranslate("account.profile.signInTitle")}
              </h2>
              <p class="mt-1 text-sm text-muted-foreground">
                {props.kind === "email"
                  ? messageTranslate("account.profile.emailDescription")
                  : messageTranslate("account.profile.signInDescription")}
              </p>
            </div>
            <span
              class={`rounded-full px-3 py-1 text-xs font-semibold ${
                props.emailVerified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {props.emailVerified
                ? messageTranslate("account.profile.verified")
                : messageTranslate("account.profile.verificationPending")}
            </span>
          </div>
          <dl class="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {messageTranslate("account.profile.userName")}
              </dt>
              <dd class="mt-1 break-all font-medium">{props.userName}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {messageTranslate("account.profile.email")}
              </dt>
              <dd class="mt-1 break-all font-medium">{props.email}</dd>
            </div>
          </dl>
        </section>

        <Show when={props.kind !== "email"}>
          <form class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-7" onSubmit={props.onSubmit}>
            <h2 class="text-xl font-semibold">{messageTranslate("account.profile.personalInformation")}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("account.profile.personalDescription")}</p>
            <div class="mt-6 grid gap-5 sm:grid-cols-2">
              <label class="grid gap-2 text-sm font-medium sm:col-span-2">
                {messageTranslate("account.profile.displayName")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  maxlength={128}
                  value={props.displayName}
                  onInput={(event) => props.onDisplayNameInput(event.currentTarget.value)}
                />
              </label>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.firstName")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  maxlength={128}
                  value={props.firstName}
                  onInput={(event) => props.onFirstNameInput(event.currentTarget.value)}
                />
              </label>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.lastName")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  maxlength={128}
                  value={props.lastName}
                  onInput={(event) => props.onLastNameInput(event.currentTarget.value)}
                />
              </label>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.nickName")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  maxlength={128}
                  value={props.nickName}
                  onInput={(event) => props.onNickNameInput(event.currentTarget.value)}
                />
              </label>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.preferredLanguage")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  maxlength={16}
                  value={props.preferredLanguage}
                  onInput={(event) => props.onPreferredLanguageInput(event.currentTarget.value)}
                />
              </label>
            </div>
            <Show when={props.validationMessage}>
              {(message) => <p class="mt-4 text-sm text-danger">{message()}</p>}
            </Show>
            <Show when={props.status === "success"}>
              <p class="mt-4 text-sm font-medium text-success" role="status">
                {messageTranslate("account.profile.saved")}
              </p>
            </Show>
            <div class="mt-6 flex justify-end">
              <button class="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast" type="submit">
                {messageTranslate("account.profile.save")}
              </button>
            </div>
          </form>
        </Show>
      </div>
    </Show>
  )
}
