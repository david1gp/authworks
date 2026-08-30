import { Match, Switch } from "solid-js"
import { AccountDeleteView } from "./AccountDeleteView.js"
import { AccountPasswordView } from "./AccountPasswordView.js"
import { AccountProfileView } from "./AccountProfileView.js"
import { accountProductionAdapterStateCreate } from "./accountProductionAdapterStateCreate.js"

export function AccountProductionAdapter(props: {
  readonly kind: "delete" | "email" | "overview" | "password" | "profile"
  readonly state?: ReturnType<typeof accountProductionAdapterStateCreate>
}) {
  const state = props.state ?? accountProductionAdapterStateCreate(() => props.kind)
  return (
    <Switch>
      <Match when={props.kind === "password"}>
        <AccountPasswordView
          confirmPassword={state.confirmPassword.get()}
          currentPassword={state.currentPassword.get()}
          errorMessage={state.errorMessage.get()}
          newPassword={state.newPassword.get()}
          onConfirmPasswordInput={state.confirmPassword.set}
          onCurrentPasswordInput={state.currentPassword.set}
          onNewPasswordInput={state.newPassword.set}
          onRetry={state.load}
          onSubmit={state.passwordSubmit}
          status={state.status.get()}
          validationMessage={state.validationMessage.get()}
        />
      </Match>
      <Match when={props.kind === "delete"}>
        <AccountDeleteView
          confirmation={state.deletionConfirmation.get()}
          email={state.user.get()?.email ?? ""}
          errorMessage={state.errorMessage.get()}
          onConfirmationInput={state.deletionConfirmation.set}
          onDelete={state.accountDelete}
          onRetry={state.load}
          status={state.status.get()}
          validationMessage={state.validationMessage.get()}
        />
      </Match>
      <Match when={props.kind === "overview" || props.kind === "profile" || props.kind === "email"}>
        <AccountProfileView
          displayName={state.displayName.get()}
          email={state.user.get()?.email ?? ""}
          emailActionId={state.emailActionId.get()}
          emailAddresses={state.emailAddresses.get()}
          emailCandidate={state.emailCandidate.get()}
          emailChallengeActive={state.emailChallengeId.get() !== undefined}
          emailErrorMessage={state.emailErrorMessage.get()}
          emailStatus={state.emailStatus.get()}
          emailToken={state.emailToken.get()}
          emailValidationMessage={state.emailValidationMessage.get()}
          emailVerified={state.user.get()?.emailVerified ?? false}
          errorMessage={state.errorMessage.get()}
          firstName={state.firstName.get()}
          genderSignal={state.gender}
          kind={props.kind as "email" | "overview" | "profile"}
          lastName={state.lastName.get()}
          nickName={state.nickName.get()}
          onDisplayNameInput={state.displayName.set}
          onEmailCancel={state.emailAddressAddCancel}
          onEmailInput={state.emailCandidate.set}
          onEmailPrimarySet={state.emailAddressPrimarySet}
          onEmailRemove={state.emailAddressRemove}
          onEmailResend={state.emailAddressAddResend}
          onEmailStart={state.emailAddressAddStart}
          onEmailTokenInput={state.emailToken.set}
          onEmailVerify={state.emailAddressAddVerify}
          onFirstNameInput={state.firstName.set}
          onLastNameInput={state.lastName.set}
          onNickNameInput={state.nickName.set}
          onPhoneCancel={state.phoneChangeCancel}
          onPhoneCodeInput={state.phoneCode.set}
          onPhoneInput={state.phoneCandidate.set}
          onPhoneResend={state.phoneChangeResend}
          onPhoneStart={state.phoneChangeStart}
          onPhoneVerify={state.phoneChangeVerify}
          onPictureRemove={() => void state.pictureRemove()}
          onPictureUpload={(file) => void state.pictureUpload(file)}
          onRetry={state.load}
          onSubmit={state.profileSubmit}
          preferredLanguage={state.preferredLanguage}
          phoneCandidate={state.phoneCandidate.get()}
          phoneChallengeActive={state.phoneChallengeId.get() !== undefined}
          phoneCode={state.phoneCode.get()}
          phoneErrorMessage={state.phoneErrorMessage.get()}
          phoneNumber={state.user.get()?.phoneNumber}
          phoneStatus={state.phoneStatus.get()}
          phoneValidationMessage={state.phoneValidationMessage.get()}
          phoneVerified={state.user.get()?.phoneNumberVerifiedAt !== undefined}
          pictureErrorMessage={state.pictureErrorMessage.get()}
          pictureStatus={state.pictureStatus.get()}
          pictureUrl={state.pictureUrl.get()}
          status={state.status.get()}
          userName={state.user.get()?.userName ?? ""}
          validationMessage={state.validationMessage.get()}
        />
      </Match>
    </Switch>
  )
}
