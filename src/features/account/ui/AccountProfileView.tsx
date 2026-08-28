import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingle } from "#ui/input/select/SelectSingle.jsx"
import { selectSingleTextDefault } from "#ui/input/select/SelectSingleTexts.js"
import { Button } from "#ui/interactive/button/Button.jsx"
import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedSelectStateCreate } from "../../../ui/authenticated/authenticatedSelectStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import { AccountEmailAddressView } from "./AccountEmailAddressView.js"
import { AccountProfileIdentityStrip } from "./AccountProfileIdentityStrip.js"
import { AccountProfilePhoneSection } from "./AccountProfilePhoneSection.js"
import { AccountProfilePictureField } from "./AccountProfilePictureField.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountGenderItemRender } from "./accountGenderItemRender.js"
import { accountGenderOptionsGet } from "./accountGenderOptionsGet.js"
import { accountGenderValueText } from "./accountGenderValueText.js"
import { accountViewBoundaryStateGet } from "./accountViewBoundaryStateGet.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"
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
  const genderSelect = authenticatedSelectStateCreate()
  const boundary = () => accountViewBoundaryStateGet(props.status, props.errorMessage)
  return (
    <AccountStateBoundary
      detail={boundary().detail}
      onRetry={props.onRetry}
      state={boundary().state}
      title={boundary().title}
    >
      <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
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
          <AccountProfileIdentityStrip
            displayName={props.displayName}
            email={props.email}
            emailVerified={props.emailVerified}
            pictureUrl={props.pictureUrl}
            userName={props.userName}
          />

          {/* Sign-in identity and the phone factor are both short read-mostly panels, so they share a row. */}
          <div class="grid min-w-0 gap-3 xl:grid-cols-2 [&>*]:min-w-0">
            <AuthenticatedSection
              actions={
                <AuthenticatedStatus
                  label={
                    props.emailVerified
                      ? messageTranslate("account.profile.verified")
                      : messageTranslate("account.profile.verificationPending")
                  }
                  tone={props.emailVerified ? "success" : "warning"}
                />
              }
              description={messageTranslate("account.profile.signInDescription")}
              padded
              title={messageTranslate("account.profile.signInTitle")}
            >
              <AuthenticatedFieldList
                fields={[
                  { identifier: true, label: messageTranslate("account.profile.userName"), value: props.userName },
                  { identifier: true, label: messageTranslate("account.profile.email"), value: props.email },
                ]}
              />
            </AuthenticatedSection>

            <AccountProfilePhoneSection
              candidate={props.phoneCandidate}
              challengeActive={props.phoneChallengeActive}
              code={props.phoneCode}
              errorMessage={props.phoneErrorMessage}
              onCancel={props.onPhoneCancel}
              onCodeInput={props.onPhoneCodeInput}
              onInput={props.onPhoneInput}
              onResend={props.onPhoneResend}
              onStart={props.onPhoneStart}
              onVerify={props.onPhoneVerify}
              phoneNumber={props.phoneNumber}
              status={props.phoneStatus}
              validationMessage={props.phoneValidationMessage}
              verified={props.phoneVerified}
            />
          </div>

          <AuthenticatedSection
            description={messageTranslate("account.profile.personalDescription")}
            title={messageTranslate("account.profile.personalInformation")}
          >
            <form class="grid gap-2.5 px-3 py-3" onSubmit={props.onSubmit}>
              <div class="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <div class="grid min-w-0 gap-1 sm:col-span-2 lg:col-span-1">
                  <Label for="account-display-name">{messageTranslate("account.profile.displayName")}</Label>
                  <Input
                    id="account-display-name"
                    maxlength={128}
                    onInput={(event) => props.onDisplayNameInput(event.currentTarget.value)}
                    value={props.displayName}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="account-first-name">{messageTranslate("account.profile.firstName")}</Label>
                  <Input
                    id="account-first-name"
                    maxlength={128}
                    onInput={(event) => props.onFirstNameInput(event.currentTarget.value)}
                    value={props.firstName}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="account-last-name">{messageTranslate("account.profile.lastName")}</Label>
                  <Input
                    id="account-last-name"
                    maxlength={128}
                    onInput={(event) => props.onLastNameInput(event.currentTarget.value)}
                    value={props.lastName}
                  />
                </div>
                {/* The gender select is wrapped so its trigger never keeps a dangling
                    `aria-controls` reference while the vendored listbox is unmounted. */}
                <div class="grid min-w-0 gap-1" ref={genderSelect.containerSet}>
                  <Label>{messageTranslate("account.profile.gender")}</Label>
                  <SelectSingle
                    buttonProps={{
                      class: "h-9 w-full justify-between",
                      onOpenChange: genderSelect.openChange,
                      variant: "outline",
                    }}
                    class="w-full"
                    getOptions={() => accountGenderOptionsGet(props.genderSignal.get())}
                    renderItem={accountGenderItemRender}
                    texts={{
                      ...selectSingleTextDefault,
                      selectEntry: messageTranslate("account.profile.gender.unspecified"),
                    }}
                    valueSignal={props.genderSignal}
                    valueText={accountGenderValueText}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="account-nick-name">{messageTranslate("account.profile.nickName")}</Label>
                  <Input
                    id="account-nick-name"
                    maxlength={128}
                    onInput={(event) => props.onNickNameInput(event.currentTarget.value)}
                    value={props.nickName}
                  />
                  <p class="text-xs text-muted-foreground">{messageTranslate("account.profile.nickNameHint")}</p>
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="account-preferred-language">
                    {messageTranslate("account.profile.preferredLanguage")}
                  </Label>
                  <Input
                    id="account-preferred-language"
                    maxlength={16}
                    onInput={(event) => props.onPreferredLanguageInput(event.currentTarget.value)}
                    value={props.preferredLanguage}
                  />
                </div>
              </div>

              <AccountProfilePictureField
                errorMessage={props.pictureErrorMessage}
                onRemove={props.onPictureRemove}
                onUpload={props.onPictureUpload}
                status={props.pictureStatus}
                url={props.pictureUrl}
              />

              <Show when={props.validationMessage}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <Show when={props.status === "success"}>
                <AuthenticatedNotice message={messageTranslate("account.profile.saved")} />
              </Show>
              <div>
                <Button size="sm" type="submit">
                  {messageTranslate("account.profile.save")}
                </Button>
              </div>
            </form>
          </AuthenticatedSection>
        </Show>
      </div>
    </AccountStateBoundary>
  )
}
