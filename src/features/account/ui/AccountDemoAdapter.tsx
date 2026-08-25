import { Match, Switch } from "solid-js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { AccountDeleteView } from "./AccountDeleteView.js"
import { AccountPasswordView } from "./AccountPasswordView.js"
import { AccountProfileView } from "./AccountProfileView.js"
import { accountDemoAdapterStateCreate } from "./accountDemoAdapterStateCreate.js"

export function AccountDemoAdapter(props: {
  readonly kind: "delete" | "email" | "overview" | "password" | "profile"
  readonly path: string
}) {
  const state = accountDemoAdapterStateCreate(() => props.kind)
  const page = state.page
  return (
    <div class="mx-auto max-w-5xl">
      <div class="mb-6 rounded-xl border border-line bg-surface p-4">
        <DemoFixtureStateSelector
          options={(["success", "loading", "error"] as const).map((fixtureState) => ({
            href: `${props.path}?state=${fixtureState}`,
            label: demoFixtureStateLabel(fixtureState),
            selected: state.fixtureState() === fixtureState,
          }))}
        />
      </div>
      <Switch>
        <Match when={props.kind === "password"}>
          <AccountPasswordView
            confirmPassword={page.confirmPassword.get()}
            currentPassword={page.currentPassword.get()}
            errorMessage={page.errorMessage.get()}
            newPassword={page.newPassword.get()}
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
            emailVerified={page.user.get()?.emailVerified ?? false}
            errorMessage={page.errorMessage.get()}
            firstName={page.firstName.get()}
            kind={props.kind as "email" | "overview" | "profile"}
            lastName={page.lastName.get()}
            nickName={page.nickName.get()}
            onDisplayNameInput={page.displayName.set}
            onFirstNameInput={page.firstName.set}
            onLastNameInput={page.lastName.set}
            onNickNameInput={page.nickName.set}
            onPreferredLanguageInput={page.preferredLanguage.set}
            onPhoneCancel={page.phoneChangeCancel}
            onPhoneCodeInput={page.phoneCode.set}
            onPhoneInput={page.phoneCandidate.set}
            onPhoneResend={page.phoneChangeResend}
            onPhoneStart={page.phoneChangeStart}
            onPhoneVerify={page.phoneChangeVerify}
            onRetry={page.load}
            onSubmit={page.profileSubmit}
            preferredLanguage={page.preferredLanguage.get()}
            phoneCandidate={page.phoneCandidate.get()}
            phoneChallengeActive={page.phoneChallengeId.get() !== undefined}
            phoneCode={page.phoneCode.get()}
            phoneErrorMessage={page.phoneErrorMessage.get()}
            phoneNumber={page.user.get()?.phoneNumber}
            phoneStatus={page.phoneStatus.get()}
            phoneValidationMessage={page.phoneValidationMessage.get()}
            phoneVerified={page.user.get()?.phoneNumberVerifiedAt !== undefined}
            status={page.status.get()}
            userName={page.user.get()?.userName ?? ""}
            validationMessage={page.validationMessage.get()}
          />
        </Match>
      </Switch>
    </div>
  )
}
