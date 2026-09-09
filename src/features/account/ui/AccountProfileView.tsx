import { mdiAccountDetailsOutline } from "@adaptive-ds/mdi/mdiAccountDetailsOutline.js"
import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingle } from "#ui/input/select/SelectSingle.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { selectSingleTextDefault } from "#ui/input/select/SelectSingleTexts.js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedSelectStateCreate } from "../../../ui/authenticated/authenticatedSelectStateCreate.js"
import { languagesSupported } from "../../../ui/i18n/model/languagesSupported.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import { AccountEmailAddressView } from "./AccountEmailAddressView.js"
import { AccountProfileIdentityStrip } from "./AccountProfileIdentityStrip.js"
import { AccountProfilePhoneSection } from "./AccountProfilePhoneSection.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"
import { accountGenderItemRender } from "./accountGenderItemRender.js"
import { accountGenderOptionsGet } from "./accountGenderOptionsGet.js"
import { accountGenderValueText } from "./accountGenderValueText.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"
import type { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"
import { accountViewBoundaryStateGet } from "./accountViewBoundaryStateGet.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountProfileViewProps = {
  readonly displayName: string
  readonly email: string
  readonly emailActionId?: string
  readonly emailAddDialogOpen: boolean
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
  readonly onEmailAddDialogOpenChange: (open: boolean) => void
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
  readonly onPhoneAddDialogOpenChange: (open: boolean) => void
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
  readonly preferredLanguage: SignalObject<string>
  readonly phoneAddDialogOpen: boolean
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
  readonly securityProgress?: ReturnType<typeof accountSecurityProgressStateCreate>
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
        {/* Contact methods: email addresses on the left, phone numbers on the right at desktop
            widths, stacked below `lg`. Both sections keep their own list and one add dialog. */}
        <Show when={props.kind === "email"}>
          <div class="grid min-w-0 items-start gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            <AccountEmailAddressView
              actionId={props.emailActionId}
              addDialogOpen={props.emailAddDialogOpen}
              addresses={props.emailAddresses}
              candidate={props.emailCandidate}
              challengeActive={props.emailChallengeActive}
              errorMessage={props.emailErrorMessage}
              onAddCancel={props.onEmailCancel}
              onAddDialogOpenChange={props.onEmailAddDialogOpenChange}
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
            <AccountProfilePhoneSection
              addDialogOpen={props.phoneAddDialogOpen}
              candidate={props.phoneCandidate}
              challengeActive={props.phoneChallengeActive}
              code={props.phoneCode}
              errorMessage={props.phoneErrorMessage}
              onAddDialogOpenChange={props.onPhoneAddDialogOpenChange}
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
        </Show>

        <Show when={props.kind !== "email"}>
          <AccountProfileIdentityStrip
            displayName={props.displayName}
            email={props.email}
            emailVerified={props.emailVerified}
            onPictureRemove={props.onPictureRemove}
            onPictureUpload={props.onPictureUpload}
            pictureErrorMessage={props.pictureErrorMessage}
            pictureStatus={props.pictureStatus}
            pictureUrl={props.pictureUrl}
            securityProgress={props.securityProgress}
            userName={props.userName}
          />

          <AuthenticatedToolbar label={messageTranslate("account.profile.personalInformation")}>
            <div class="grid gap-0.5">
              <h2 class="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Icon class="size-5 text-muted-foreground" path={mdiAccountDetailsOutline} />
                {messageTranslate("account.profile.personalInformation")}
              </h2>
              <p class="text-sm text-muted-foreground">{messageTranslate("account.profile.personalDescription")}</p>
            </div>
          </AuthenticatedToolbar>
          <AuthenticatedSection label={messageTranslate("account.profile.personalInformation")}>
            <form class="grid min-w-0 gap-3 p-4" onSubmit={props.onSubmit}>
              <div class="grid min-w-0 items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
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
                <div class="grid min-w-0 gap-1">
                  <Label for="account-display-name">{messageTranslate("account.profile.displayName")}</Label>
                  <Input
                    id="account-display-name"
                    maxlength={128}
                    onInput={(event) => props.onDisplayNameInput(event.currentTarget.value)}
                    value={props.displayName}
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
                  <Label for="account-preferred-language">
                    {messageTranslate("account.profile.preferredLanguage")}
                  </Label>
                  <SelectSingleNative
                    getOptions={() => ["", ...languagesSupported.map((language) => language.code)]}
                    id="account-preferred-language"
                    valueSignal={props.preferredLanguage}
                    valueText={(code) => {
                      if (code === "") return messageTranslate("account.profile.preferredLanguage.unspecified")
                      return languagesSupported.find((language) => language.code === code)?.nativeName ?? code
                    }}
                  />
                </div>
              </div>

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
