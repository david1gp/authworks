import { Match, Switch } from "solid-js"
import { AccountDeleteView } from "./AccountDeleteView.js"
import { AccountPasswordView } from "./AccountPasswordView.js"
import { AccountProfileView } from "./AccountProfileView.js"
import { accountProductionAdapterStateCreate } from "./accountProductionAdapterStateCreate.js"

export function AccountProductionAdapter(props: {
  readonly kind: "delete" | "email" | "overview" | "password" | "profile"
}) {
  const state = accountProductionAdapterStateCreate(() => props.kind)
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
          emailVerified={state.user.get()?.emailVerified ?? false}
          errorMessage={state.errorMessage.get()}
          firstName={state.firstName.get()}
          kind={props.kind as "email" | "overview" | "profile"}
          lastName={state.lastName.get()}
          nickName={state.nickName.get()}
          onDisplayNameInput={state.displayName.set}
          onFirstNameInput={state.firstName.set}
          onLastNameInput={state.lastName.set}
          onNickNameInput={state.nickName.set}
          onPreferredLanguageInput={state.preferredLanguage.set}
          onRetry={state.load}
          onSubmit={state.profileSubmit}
          preferredLanguage={state.preferredLanguage.get()}
          status={state.status.get()}
          userName={state.user.get()?.userName ?? ""}
          validationMessage={state.validationMessage.get()}
        />
      </Match>
    </Switch>
  )
}
