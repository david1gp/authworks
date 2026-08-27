import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { mdiAccountEditOutline } from "@adaptive-ds/mdi/mdiAccountEditOutline.js"
import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCameraOutline } from "@adaptive-ds/mdi/mdiCameraOutline.js"
import { mdiCellphone } from "@adaptive-ds/mdi/mdiCellphone.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiClockOutline } from "@adaptive-ds/mdi/mdiClockOutline.js"
import { mdiGenderFemale } from "@adaptive-ds/mdi/mdiGenderFemale.js"
import { mdiGenderMale } from "@adaptive-ds/mdi/mdiGenderMale.js"
import { mdiGenderNonBinary } from "@adaptive-ds/mdi/mdiGenderNonBinary.js"
import { mdiHelpCircleOutline } from "@adaptive-ds/mdi/mdiHelpCircleOutline.js"
import { mdiShieldAccountOutline } from "@adaptive-ds/mdi/mdiShieldAccountOutline.js"
import { mdiTrashCanOutline } from "@adaptive-ds/mdi/mdiTrashCanOutline.js"
import { mdiUploadOutline } from "@adaptive-ds/mdi/mdiUploadOutline.js"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { SelectSingle } from "#ui/input/select/SelectSingle.jsx"
import type { SelectSingleEntry } from "#ui/input/select/SelectSingleEntry.js"
import { selectSingleTextDefault } from "#ui/input/select/SelectSingleTexts.js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import { userPictureConstraints } from "../../users/public/userPictureConstraints.js"
import { AccountEmailAddressView } from "./AccountEmailAddressView.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

const accountPictureAcceptAttribute = userPictureConstraints.contentTypes.join(",")

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
  readonly onPictureRemove: () => void
  readonly onPictureUpload: (file: File) => void
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
  readonly pictureErrorMessage?: string
  readonly pictureStatus: AccountPictureViewStatus
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
      <div class="grid max-w-4xl gap-6 sm:gap-8">
        <Show when={props.kind !== "email"}>
          {/* User overview hero card */}
          <section class="overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xs transition-colors sm:p-8">
            <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-5">
                <div class="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-muted ring-2 ring-line/50 sm:size-20">
                  <div class="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <Icon class="size-10" path={mdiAccountCircleOutline} />
                  </div>
                  <Show when={props.pictureUrl.length > 0}>
                    <img
                      aria-hidden="true"
                      class="relative size-full object-cover"
                      role="presentation"
                      src={props.pictureUrl}
                      onError={(event) => {
                        event.currentTarget.style.display = "none"
                      }}
                    />
                  </Show>
                </div>
                <div class="min-w-0">
                  <h2 class="truncate text-xl font-bold tracking-tight sm:text-2xl">
                    {props.displayName || props.userName || props.email}
                  </h2>
                  <p class="truncate text-sm text-muted-foreground">@{props.userName || props.email}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        props.emailVerified
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      <Icon class="size-3.5" path={props.emailVerified ? mdiCheckCircleOutline : mdiClockOutline} />
                      {props.emailVerified
                        ? messageTranslate("account.profile.verified")
                        : messageTranslate("account.profile.verificationPending")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sign-in details */}
          <section class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <Icon class="size-5 text-accent" path={mdiShieldAccountOutline} />
                  <h2 class="text-xl font-semibold tracking-tight">
                    {props.kind === "email"
                      ? messageTranslate("account.profile.emailTitle")
                      : messageTranslate("account.profile.signInTitle")}
                  </h2>
                </div>
                <p class="mt-1 text-sm text-muted-foreground">
                  {props.kind === "email"
                    ? messageTranslate("account.profile.emailDescription")
                    : messageTranslate("account.profile.signInDescription")}
                </p>
              </div>
              <span
                class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  props.emailVerified
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300"
                }`}
              >
                <Icon class="size-3.5" path={props.emailVerified ? mdiCheckCircleOutline : mdiClockOutline} />
                {props.emailVerified
                  ? messageTranslate("account.profile.verified")
                  : messageTranslate("account.profile.verificationPending")}
              </span>
            </div>
            <dl class="mt-6 grid gap-4 rounded-xl border border-line/70 bg-muted/40 p-4 sm:grid-cols-2">
              <div class="rounded-lg bg-surface p-3.5 shadow-2xs">
                <dt class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {messageTranslate("account.profile.userName")}
                </dt>
                <dd class="mt-1 break-all font-mono text-sm font-medium">{props.userName}</dd>
              </div>
              <div class="rounded-lg bg-surface p-3.5 shadow-2xs">
                <dt class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {messageTranslate("account.profile.email")}
                </dt>
                <dd class="mt-1 break-all text-sm font-medium">{props.email}</dd>
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
          {/* WhatsApp phone number section */}
          <section class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <Icon class="size-5 text-accent" path={mdiCellphone} />
                  <h2 class="text-xl font-semibold tracking-tight">{messageTranslate("account.profile.phoneTitle")}</h2>
                </div>
                <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {messageTranslate("account.profile.phoneDescription")}
                </p>
              </div>
              <Show when={props.phoneNumber}>
                <span
                  class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    props.phoneVerified
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  <Icon class="size-3.5" path={props.phoneVerified ? mdiCheckCircleOutline : mdiClockOutline} />
                  {props.phoneVerified
                    ? messageTranslate("account.profile.verified")
                    : messageTranslate("account.profile.verificationPending")}
                </span>
              </Show>
            </div>
            <div class="mt-6 rounded-xl border border-line/70 bg-muted/40 p-4">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {messageTranslate("account.profile.phoneNumber")}
              </p>
              <p class="mt-1 break-all font-mono text-sm font-medium">
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
                      class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
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
                    <Button disabled={props.phoneStatus === "sending"} type="submit" variant="filledBlue">
                      {props.phoneStatus === "sending"
                        ? messageTranslate("account.profile.phoneSending")
                        : props.phoneNumber
                          ? messageTranslate("account.profile.phoneChange")
                          : messageTranslate("account.profile.phoneAdd")}
                    </Button>
                  </div>
                </form>
              }
            >
              <form
                class="mt-6 grid gap-4 rounded-xl border border-accent/30 bg-accent/5 p-5"
                onSubmit={props.onPhoneVerify}
              >
                <p class="text-sm font-medium text-foreground">
                  {messageTranslate("account.profile.phoneCodeSent", { phoneNumber: props.phoneCandidate })}
                </p>
                <label class="grid gap-2 text-sm font-medium">
                  {messageTranslate("account.profile.phoneCode")}
                  <input
                    autocomplete="one-time-code"
                    class="rounded-xl border border-line bg-background px-3.5 py-2.5 font-mono text-base tracking-widest transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                    inputmode="numeric"
                    maxlength={6}
                    pattern="[0-9]{6}"
                    required
                    value={props.phoneCode}
                    onInput={(event) => props.onPhoneCodeInput(event.currentTarget.value)}
                  />
                </label>
                <div class="flex flex-wrap justify-end gap-3 pt-2">
                  <Button onClick={props.onPhoneCancel} type="button" variant="ghost">
                    {messageTranslate("account.profile.phoneDifferent")}
                  </Button>
                  <Button
                    disabled={props.phoneStatus === "sending" || props.phoneStatus === "verifying"}
                    onClick={props.onPhoneResend}
                    type="button"
                    variant="outline"
                  >
                    {props.phoneStatus === "sending"
                      ? messageTranslate("account.profile.phoneSending")
                      : messageTranslate("account.profile.phoneResend")}
                  </Button>
                  <Button
                    disabled={props.phoneStatus === "verifying" || props.phoneStatus === "sending"}
                    type="submit"
                    variant="filledBlue"
                  >
                    {props.phoneStatus === "verifying"
                      ? messageTranslate("account.profile.phoneVerifying")
                      : messageTranslate("account.profile.phoneVerify")}
                  </Button>
                </div>
              </form>
            </Show>
            <Show when={props.phoneValidationMessage}>
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
            <Show when={props.phoneErrorMessage}>
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
            <Show when={props.phoneStatus === "success"}>
              <div
                class="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                role="status"
              >
                <Icon class="size-4 shrink-0" path={mdiCheckCircleOutline} />
                <span>{messageTranslate("account.profile.phoneSaved")}</span>
              </div>
            </Show>
          </section>

          {/* Personal information form */}
          <form class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8" onSubmit={props.onSubmit}>
            <div class="flex items-center gap-2">
              <Icon class="size-5 text-accent" path={mdiAccountEditOutline} />
              <h2 class="text-xl font-semibold tracking-tight">
                {messageTranslate("account.profile.personalInformation")}
              </h2>
            </div>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
              {messageTranslate("account.profile.personalDescription")}
            </p>

            <div class="mt-6 grid gap-5 sm:grid-cols-2">
              <label class="grid gap-2 text-sm font-medium sm:col-span-2">
                {messageTranslate("account.profile.displayName")}
                <input
                  class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  maxlength={128}
                  value={props.displayName}
                  onInput={(event) => props.onDisplayNameInput(event.currentTarget.value)}
                />
              </label>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.firstName")}
                <input
                  class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  maxlength={128}
                  value={props.firstName}
                  onInput={(event) => props.onFirstNameInput(event.currentTarget.value)}
                />
              </label>
              <label class="grid gap-2 text-sm font-medium">
                {messageTranslate("account.profile.lastName")}
                <input
                  class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  maxlength={128}
                  value={props.lastName}
                  onInput={(event) => props.onLastNameInput(event.currentTarget.value)}
                />
              </label>
              <div class="grid gap-2 text-sm font-medium">
                <span>{messageTranslate("account.profile.gender")}</span>
                <SelectSingle
                  buttonProps={{ class: "w-full justify-between rounded-xl", variant: "outline" }}
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
                  class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
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
                  class="rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  maxlength={16}
                  value={props.preferredLanguage}
                  onInput={(event) => props.onPreferredLanguageInput(event.currentTarget.value)}
                />
              </label>
              <div class="grid gap-3 text-sm font-medium sm:col-span-2 rounded-xl border border-line/70 bg-muted/30 p-4 sm:p-5">
                <div class="flex items-center gap-2">
                  <Icon class="size-4 text-accent" path={mdiCameraOutline} />
                  <span>{messageTranslate("account.profile.picture")}</span>
                </div>
                <div class="flex flex-wrap items-center gap-4 pt-1">
                  <Show when={props.pictureUrl.length > 0}>
                    <img
                      alt={messageTranslate("account.profile.pictureAlt")}
                      class="size-16 rounded-full border-2 border-line object-cover shadow-xs"
                      src={props.pictureUrl}
                    />
                  </Show>
                  <label class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98]">
                    <Icon class="size-4 text-muted-foreground" path={mdiUploadOutline} />
                    <span>{messageTranslate("account.profile.pictureChoose")}</span>
                    <input
                      accept={accountPictureAcceptAttribute}
                      aria-label={messageTranslate("account.profile.pictureChoose")}
                      class="sr-only"
                      disabled={props.pictureStatus === "uploading" || props.pictureStatus === "removing"}
                      type="file"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0]
                        event.currentTarget.value = ""
                        if (file !== undefined) props.onPictureUpload(file)
                      }}
                    />
                  </label>
                  <Show when={props.pictureUrl.length > 0}>
                    <Button
                      disabled={props.pictureStatus === "uploading" || props.pictureStatus === "removing"}
                      onClick={props.onPictureRemove}
                      type="button"
                      variant="outlineRed"
                    >
                      <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                      {messageTranslate("account.profile.pictureRemove")}
                    </Button>
                  </Show>
                </div>
                <span class="text-xs font-normal text-muted-foreground">
                  {messageTranslate("account.profile.pictureHint")}
                </span>
                <Show when={props.pictureErrorMessage}>
                  {(message) => (
                    <div
                      class="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
                      role="alert"
                    >
                      <Icon class="size-4 shrink-0" path={mdiAlertCircleOutline} />
                      <span>{message()}</span>
                    </div>
                  )}
                </Show>
                <Show when={props.pictureStatus === "uploading"}>
                  <p class="text-sm font-normal text-muted-foreground" role="status">
                    {messageTranslate("account.profile.pictureUploading")}
                  </p>
                </Show>
                <Show when={props.pictureStatus === "success"}>
                  <div
                    class="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    role="status"
                  >
                    <Icon class="size-4 shrink-0" path={mdiCheckCircleOutline} />
                    <span>{messageTranslate("account.profile.pictureSaved")}</span>
                  </div>
                </Show>
              </div>
            </div>
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
            <Show when={props.status === "success"}>
              <div
                class="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                role="status"
              >
                <Icon class="size-4 shrink-0" path={mdiCheckCircleOutline} />
                <span>{messageTranslate("account.profile.saved")}</span>
              </div>
            </Show>
            <div class="mt-6 flex justify-end">
              <Button type="submit" variant="filledBlue">
                {messageTranslate("account.profile.save")}
              </Button>
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
