import { mdiGenderFemale } from "@adaptive-ds/mdi/mdiGenderFemale.js"
import { mdiGenderMale } from "@adaptive-ds/mdi/mdiGenderMale.js"
import { mdiGenderNonBinary } from "@adaptive-ds/mdi/mdiGenderNonBinary.js"
import { mdiHelpCircleOutline } from "@adaptive-ds/mdi/mdiHelpCircleOutline.js"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { SelectSingle } from "#ui/input/select/SelectSingle.jsx"
import type { SelectSingleEntry } from "#ui/input/select/SelectSingleEntry.js"
import { selectSingleTextDefault } from "#ui/input/select/SelectSingleTexts.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import { AccountEmailAddressView } from "./AccountEmailAddressView.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountProfileViewProps = {
  readonly displayName: string
  readonly email: string
  readonly emailActionId?: string
  readonly emailAddresses: readonly UserEmailAddress[]
  readonly emailCandidate: string
  readonly emailChallengeActive: boolean
  readonly emailErrorMessage?: string
  readonly emailStatus: AccountEmailViewStatus
  readonly emailToken: string
  readonly emailValidationMessage?: string
  readonly emailVerified: boolean
  readonly errorMessage?: string
  readonly firstName: string
  readonly genderSignal: SignalObject<string>
  readonly kind: "email" | "overview" | "profile"
  readonly lastName: string
  readonly nickName: string
  readonly onDisplayNameInput: (value: string) => void
  readonly onEmailCancel: () => void
  readonly onEmailInput: (value: string) => void
  readonly onEmailResend: () => void
  readonly onEmailStart: (event: SubmitEvent) => void
  readonly onEmailTokenInput: (value: string) => void
  readonly onEmailVerify: (event: SubmitEvent) => void
  readonly onEmailPrimarySet: (emailId: string) => void
  readonly onEmailRemove: (emailId: string) => void
  readonly onFirstNameInput: (value: string) => void
  readonly onLastNameInput: (value: string) => void
  readonly onNickNameInput: (value: string) => void
  readonly onPreferredLanguageInput: (value: string) => void
  readonly onPhoneCancel: () => void
  readonly onPhoneCodeInput: (value: string) => void
  readonly onPhoneInput: (value: string) => void
  readonly onPhoneResend: () => void
  readonly onPhoneStart: (event: SubmitEvent) => void
  readonly onPhoneVerify: (event: SubmitEvent) => void
  readonly onPictureContentTypeInput: (value: string) => void
  readonly onPictureRemove: () => void
  readonly onPictureUrlInput: (value: string) => void
  readonly onRetry: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly preferredLanguage: string
  readonly phoneCandidate: string
  readonly phoneChallengeActive: boolean
  readonly phoneCode: string
  readonly phoneErrorMessage?: string
  readonly phoneNumber?: string
  readonly phoneStatus: AccountPhoneViewStatus
  readonly phoneValidationMessage?: string
  readonly phoneVerified: boolean
  readonly pictureContentType: string
  readonly pictureUrl: string
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
        <Show when={props.kind !== "email"}>
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
        </Show>

        <Show when={props.kind === "email"}>
          <AccountEmailAddressView
            actionId={props.emailActionId}
            addresses={props.emailAddresses}
            candidate={props.emailCandidate}
            challengeActive={props.emailChallengeActive}
            errorMessage={props.emailErrorMessage}
            onAddCancel={props.onEmailCancel}
            onAddResend={props.onEmailResend}
            onAddStart={props.onEmailStart}
            onAddVerify={props.onEmailVerify}
            onCandidateInput={props.onEmailInput}
            onPrimarySet={props.onEmailPrimarySet}
            onRemove={props.onEmailRemove}
            onRetry={props.onRetry}
            onTokenInput={props.onEmailTokenInput}
            status={props.emailStatus}
            token={props.emailToken}
            validationMessage={props.emailValidationMessage}
          />
        </Show>

        <Show when={props.kind !== "email"}>
          <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-7">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 class="text-xl font-semibold">{messageTranslate("account.profile.phoneTitle")}</h2>
                <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("account.profile.phoneDescription")}</p>
              </div>
              <Show when={props.phoneNumber}>
                <span
                  class={`rounded-full px-3 py-1 text-xs font-semibold ${
                    props.phoneVerified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {props.phoneVerified
                    ? messageTranslate("account.profile.verified")
                    : messageTranslate("account.profile.verificationPending")}
                </span>
              </Show>
            </div>
            <div class="mt-6">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {messageTranslate("account.profile.phoneNumber")}
              </p>
              <p class="mt-1 break-all font-medium">
                {props.phoneNumber ?? messageTranslate("account.profile.phoneNotAdded")}
              </p>
            </div>
            <Show
              when={props.phoneChallengeActive}
              fallback={
                <form class="mt-6 grid gap-4" onSubmit={props.onPhoneStart}>
                  <label class="grid gap-2 text-sm font-medium">
                    {props.phoneNumber
                      ? messageTranslate("account.profile.phoneNew")
                      : messageTranslate("account.profile.phoneNumber")}
                    <input
                      autocomplete="tel"
                      class="rounded-lg border border-line bg-background px-3 py-2.5"
                      inputmode="tel"
                      maxlength={16}
                      placeholder={messageTranslate("account.profile.phonePlaceholder")}
                      required
                      type="tel"
                      value={props.phoneCandidate}
                      onInput={(event) => props.onPhoneInput(event.currentTarget.value)}
                    />
                    <span class="text-xs font-normal text-muted-foreground">
                      {messageTranslate("account.profile.phoneHint")}
                    </span>
                  </label>
                  <div class="flex justify-end">
                    <button
                      class="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast disabled:opacity-60"
                      disabled={props.phoneStatus === "sending"}
                      type="submit"
                    >
                      {props.phoneStatus === "sending"
                        ? messageTranslate("account.profile.phoneSending")
                        : props.phoneNumber
                          ? messageTranslate("account.profile.phoneChange")
                          : messageTranslate("account.profile.phoneAdd")}
                    </button>
                  </div>
                </form>
              }
            >
              <form class="mt-6 grid gap-4" onSubmit={props.onPhoneVerify}>
                <p class="text-sm text-muted-foreground">
                  {messageTranslate("account.profile.phoneCodeSent", { phoneNumber: props.phoneCandidate })}
                </p>
                <label class="grid gap-2 text-sm font-medium">
                  {messageTranslate("account.profile.phoneCode")}
                  <input
                    autocomplete="one-time-code"
                    class="rounded-lg border border-line bg-background px-3 py-2.5"
                    inputmode="numeric"
                    maxlength={6}
                    pattern="[0-9]{6}"
                    required
                    value={props.phoneCode}
                    onInput={(event) => props.onPhoneCodeInput(event.currentTarget.value)}
                  />
                </label>
                <div class="flex flex-wrap justify-end gap-3">
                  <button
                    class="rounded-lg border border-line px-4 py-2.5 font-semibold"
                    type="button"
                    onClick={props.onPhoneCancel}
                  >
                    {messageTranslate("account.profile.phoneDifferent")}
                  </button>
                  <button
                    class="rounded-lg border border-line px-4 py-2.5 font-semibold"
                    disabled={props.phoneStatus === "sending" || props.phoneStatus === "verifying"}
                    type="button"
                    onClick={props.onPhoneResend}
                  >
                    {props.phoneStatus === "sending"
                      ? messageTranslate("account.profile.phoneSending")
                      : messageTranslate("account.profile.phoneResend")}
                  </button>
                  <button
                    class="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast disabled:opacity-60"
                    disabled={props.phoneStatus === "verifying" || props.phoneStatus === "sending"}
                    type="submit"
                  >
                    {props.phoneStatus === "verifying"
                      ? messageTranslate("account.profile.phoneVerifying")
                      : messageTranslate("account.profile.phoneVerify")}
                  </button>
                </div>
              </form>
            </Show>
            <Show when={props.phoneValidationMessage}>
              {(message) => <p class="mt-4 text-sm text-danger">{message()}</p>}
            </Show>
            <Show when={props.phoneErrorMessage}>
              {(message) => (
                <p class="mt-4 text-sm text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <Show when={props.phoneStatus === "success"}>
              <p class="mt-4 text-sm font-medium text-success" role="status">
                {messageTranslate("account.profile.phoneSaved")}
              </p>
            </Show>
          </section>

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
              <div class="grid gap-2 text-sm font-medium">
                <span>{messageTranslate("account.profile.gender")}</span>
                <SelectSingle
                  buttonProps={{ class: "w-full justify-between", variant: "outline" }}
                  class="w-full"
                  getOptions={() => accountGenderOptionsGet(props.genderSignal.get())}
                  renderItem={accountGenderItemRender}
                  valueSignal={props.genderSignal}
                  valueText={accountGenderValueText}
                  texts={{
                    ...selectSingleTextDefault,
                    selectEntry: messageTranslate("account.profile.gender.unspecified"),
                  }}
                />
              </div>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.nickName")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  maxlength={128}
                  value={props.nickName}
                  onInput={(event) => props.onNickNameInput(event.currentTarget.value)}
                />
                <span class="text-xs font-normal text-muted-foreground">
                  {messageTranslate("account.profile.nickNameHint")}
                </span>
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
              <label class="grid gap-2 text-sm font-medium sm:col-span-2">
                {messageTranslate("account.profile.pictureUrl")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  type="url"
                  value={props.pictureUrl}
                  onInput={(event) => props.onPictureUrlInput(event.currentTarget.value)}
                />
                <span class="text-xs font-normal text-muted-foreground">
                  {messageTranslate("account.profile.pictureHint")}
                </span>
              </label>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.pictureContentType")}
                <input
                  class="rounded-lg border border-line bg-background px-3 py-2.5"
                  maxlength={128}
                  value={props.pictureContentType}
                  onInput={(event) => props.onPictureContentTypeInput(event.currentTarget.value)}
                />
              </label>
              <Show when={props.pictureUrl.length > 0}>
                <div class="flex items-end">
                  <button
                    class="rounded-lg border border-line px-4 py-2.5 font-semibold"
                    type="button"
                    onClick={props.onPictureRemove}
                  >
                    {messageTranslate("account.profile.pictureRemove")}
                  </button>
                </div>
              </Show>
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

const accountGenderValues = ["unspecified", "woman", "man", "non-binary"] as const

function accountGenderOptionsGet(currentValue: string): SelectSingleEntry[] {
  const options: SelectSingleEntry[] = accountGenderValues.map((value) => ({ type: "item", value }))
  if (currentValue.length > 0 && !accountGenderValues.includes(currentValue as (typeof accountGenderValues)[number])) {
    options.push({ type: "item", value: currentValue })
  }
  return options
}

function accountGenderValueText(value: string): string {
  if (value === "unspecified") return messageTranslate("account.profile.gender.unspecified")
  if (value === "woman") return messageTranslate("account.profile.gender.woman")
  if (value === "man") return messageTranslate("account.profile.gender.man")
  if (value === "non-binary") return messageTranslate("account.profile.gender.nonBinary")
  return value
}

function accountGenderIconPathGet(value: string): string {
  if (value === "woman") return mdiGenderFemale
  if (value === "man") return mdiGenderMale
  if (value === "non-binary") return mdiGenderNonBinary
  return mdiHelpCircleOutline
}

function accountGenderItemRender(value: string): JSX.Element {
  return (
    <span class="flex items-center gap-2">
      <Icon path={accountGenderIconPathGet(value)} />
      <span>{accountGenderValueText(value)}</span>
    </span>
  )
}
