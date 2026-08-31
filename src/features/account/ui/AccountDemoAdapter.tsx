import { useLocation } from "@solidjs/router"
import { Match, Switch } from "solid-js"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoScenarioPlaceholderStateCreate } from "../../demo/ui/demoScenarioPlaceholderStateCreate.js"
import { AccountDeleteView } from "./AccountDeleteView.js"
import { AccountDemoFixtureHeader } from "./AccountDemoFixtureHeader.js"
import { AccountPasswordView } from "./AccountPasswordView.js"
import { AccountProfileView } from "./AccountProfileView.js"
import { accountDemoAdapterStateCreate } from "./accountDemoAdapterStateCreate.js"

export function AccountDemoAdapter(props: {
  readonly kind: "delete" | "email" | "overview" | "password" | "profile"
  readonly path: string
}) {
  const fixture = demoScenarioPlaceholderStateCreate(() => demoAccountScenarioGroups)
  const location = useLocation()
  const state = accountDemoAdapterStateCreate(() => props.kind)
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  const page = state.page
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AccountDemoFixtureHeader
        description={scenario()?.description ?? ""}
        stateOptions={fixture.stateOptions()}
        title={scenario()?.title ?? ""}
      />
      <Switch>
        <Match when={props.kind === "password"}>
          <AccountPasswordView
            confirmPassword={page.confirmPassword.get()}
            currentPassword={page.currentPassword.get()}
            errorMessage={page.errorMessage.get()}
            newPassword={page.newPassword.get()}
            dialogOpen={page.passwordDialogOpen.get()}
            onDialogOpenChange={page.passwordDialogOpenSet}
            onConfirmPasswordInput={page.confirmPassword.set}
            onCurrentPasswordInput={page.currentPassword.set}
            onNewPasswordInput={page.newPassword.set}
            onRetry={page.load}
            onSubmit={page.passwordSubmit}
            status={page.status.get()}
            validationMessage={page.validationMessage.get()}
          />
        </Match>
        <Match when={props.kind === "delete"}>
          <AccountDeleteView
            confirmation={page.deletionConfirmation.get()}
            email={page.user.get()?.email ?? ""}
            errorMessage={page.errorMessage.get()}
            onConfirmationInput={page.deletionConfirmation.set}
            onDelete={page.accountDelete}
            onRetry={page.load}
            status={page.status.get()}
            validationMessage={page.validationMessage.get()}
          />
        </Match>
        <Match when={props.kind === "overview" || props.kind === "profile" || props.kind === "email"}>
          <AccountProfileView
            displayName={page.displayName.get()}
            email={page.user.get()?.email ?? ""}
            emailActionId={page.emailActionId.get()}
            emailAddDialogOpen={page.emailAddDialogOpen.get()}
            emailAddresses={page.emailAddresses.get()}
            emailCandidate={page.emailCandidate.get()}
            emailChallengeActive={page.emailChallengeId.get() !== undefined}
            emailErrorMessage={page.emailErrorMessage.get()}
            emailStatus={page.emailStatus.get()}
            emailToken={page.emailToken.get()}
            emailValidationMessage={page.emailValidationMessage.get()}
            emailVerified={page.user.get()?.emailVerified ?? false}
            errorMessage={page.errorMessage.get()}
            firstName={page.firstName.get()}
            genderSignal={page.gender}
            kind={props.kind as "email" | "overview" | "profile"}
            lastName={page.lastName.get()}
            nickName={page.nickName.get()}
            onDisplayNameInput={page.displayName.set}
            onEmailAddDialogOpenChange={page.emailAddDialogOpenSet}
            onEmailCancel={page.emailAddressAddCancel}
            onEmailInput={page.emailCandidate.set}
            onEmailPrimarySet={page.emailAddressPrimarySet}
            onEmailRemove={page.emailAddressRemove}
            onEmailResend={page.emailAddressAddResend}
            onEmailStart={page.emailAddressAddStart}
            onEmailTokenInput={page.emailToken.set}
            onEmailVerify={page.emailAddressAddVerify}
            onFirstNameInput={page.firstName.set}
            onLastNameInput={page.lastName.set}
            onNickNameInput={page.nickName.set}
            onPhoneAddDialogOpenChange={page.phoneAddDialogOpenSet}
            onPhoneCancel={page.phoneChangeCancel}
            onPhoneCodeInput={page.phoneCode.set}
            onPhoneInput={page.phoneCandidate.set}
            onPhoneResend={page.phoneChangeResend}
            onPhoneStart={page.phoneChangeStart}
            onPhoneVerify={page.phoneChangeVerify}
            onPictureRemove={() => void page.pictureRemove()}
            onPictureUpload={(file) => void page.pictureUpload(file)}
            onRetry={page.load}
            onSubmit={page.profileSubmit}
            preferredLanguage={page.preferredLanguage}
            phoneAddDialogOpen={page.phoneAddDialogOpen.get()}
            phoneCandidate={page.phoneCandidate.get()}
            phoneChallengeActive={page.phoneChallengeId.get() !== undefined}
            phoneCode={page.phoneCode.get()}
            phoneErrorMessage={page.phoneErrorMessage.get()}
            phoneNumber={page.user.get()?.phoneNumber}
            phoneStatus={page.phoneStatus.get()}
            phoneValidationMessage={page.phoneValidationMessage.get()}
            phoneVerified={page.user.get()?.phoneNumberVerifiedAt !== undefined}
            pictureErrorMessage={page.pictureErrorMessage.get()}
            pictureStatus={page.pictureStatus.get()}
            pictureUrl={page.pictureUrl.get()}
            status={page.status.get()}
            userName={page.user.get()?.userName ?? ""}
            validationMessage={page.validationMessage.get()}
          />
        </Match>
      </Switch>
    </div>
  )
}
