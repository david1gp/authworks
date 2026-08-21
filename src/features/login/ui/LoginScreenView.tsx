import { Match, Show, Switch } from "solid-js"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { EmailOtpPanel } from "../../emailOtp/ui/EmailOtpPanel.js"
import { ExternalIdentityPanel } from "../../externalIdentities/ui/ExternalIdentityPanel.js"
import { MfaCodePanel } from "../../mfa/ui/MfaCodePanel.js"
import { MfaPanel } from "../../mfa/ui/MfaPanel.js"
import { MfaTotpEnrollPanel } from "../../mfa/ui/MfaTotpEnrollPanel.js"
import { PasskeyPanel } from "../../passkeys/ui/PasskeyPanel.js"
import { PasswordChangeRequiredPanel } from "../../passwords/ui/PasswordChangeRequiredPanel.js"
import { PasswordPanel } from "../../passwords/ui/PasswordPanel.js"
import { PasswordRecoveryRequestPanel } from "../../passwords/ui/PasswordRecoveryRequestPanel.js"
import { PasswordRegisterPanel } from "../../passwords/ui/PasswordRegisterPanel.js"
import { PasswordResetPanel } from "../../passwords/ui/PasswordResetPanel.js"
import { PasswordVerifyEmailPanel } from "../../passwords/ui/PasswordVerifyEmailPanel.js"
import { RecentAccountChooser } from "../../sessions/ui/RecentAccountChooser.js"
import { LoginFrame } from "./LoginFrame.js"
import { LoginLogoutPanel } from "./LoginLogoutPanel.js"
import { LoginNoticePanel } from "./LoginNoticePanel.js"
import { LoginUnavailableFrame } from "./LoginUnavailableFrame.js"
import type { LoginPageState } from "./loginPageStateCreate.js"
import { MethodChooser } from "./MethodChooser.js"

/** Renders any hosted login screen purely from the shared page state; no adapter knowledge here. */
export function LoginScreenView(props: { readonly state: LoginPageState }) {
  const state = props.state
  const organizationName = () => state.discovery()?.organization.name ?? messageTranslate("app.name")
  const provider = () => state.discovery()?.providers[0]

  return (
    <Switch>
      <Match when={state.status() === "loading" || state.screen() === "loading"}>
        <LoginUnavailableFrame>
          <div class="grid justify-items-center gap-4 py-10" role="status">
            <LoaderShuffle4Dots />
            <p class="font-medium">{messageTranslate("login.status.loading")}</p>
          </div>
        </LoginUnavailableFrame>
      </Match>
      <Match when={state.status() === "unavailable" || state.screen() === "unsupported"}>
        <LoginUnavailableFrame>
          <LoginNoticePanel
            description={state.errorMessage() ?? messageTranslate("login.status.unavailableDescription")}
            kind="error"
            title={messageTranslate("login.status.unavailableTitle")}
          />
        </LoginUnavailableFrame>
      </Match>
      <Match when={state.discovery()}>
        {(discovery) => (
          <LoginFrame bootstrap={discovery()}>
            <Switch>
              <Match when={state.screen() === "chooser"}>
                <MethodChooser
                  discovery={discovery()}
                  methods={state.methods()}
                  onRecentAccounts={() => state.go("recent-accounts")}
                  onRegister={() => state.go("register")}
                  onSelect={(method) =>
                    state.go(
                      method === "external-identity"
                        ? "provider"
                        : method === "email-otp"
                          ? "email-otp"
                          : method === "passkey"
                            ? "passkey"
                            : "password",
                    )
                  }
                  showRecentAccounts={state.recentAccounts().length > 0}
                />
              </Match>
              <Match when={state.screen() === "recent-accounts"}>
                <RecentAccountChooser
                  accounts={state.recentAccounts()}
                  onBack={() => state.go("chooser")}
                  onSelect={state.recentAccountSelect}
                />
              </Match>
              <Match when={state.screen() === "password"}>
                <PasswordPanel
                  errorMessage={state.errorMessage()}
                  identifier={state.identifier.get()}
                  onBack={() => state.go("chooser")}
                  onForgot={discovery().policy.allowPasswordRecovery ? () => state.go("recovery-request") : undefined}
                  onIdentifier={state.identifier.set}
                  onPassword={state.password.set}
                  onRevealPassword={() => state.revealPassword.set(!state.revealPassword.get())}
                  onSubmit={state.passwordSubmit}
                  organizationName={organizationName()}
                  password={state.password.get()}
                  pending={state.pending()}
                  revealPassword={state.revealPassword.get()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "password-change-required"}>
                <PasswordChangeRequiredPanel
                  confirmPassword={state.confirmPassword.get()}
                  currentPassword={state.password.get()}
                  errorMessage={state.errorMessage()}
                  newPassword={state.newPassword.get()}
                  onBack={() => state.go("chooser")}
                  onConfirmPassword={state.confirmPassword.set}
                  onCurrentPassword={state.password.set}
                  onNewPassword={state.newPassword.set}
                  onSubmit={state.passwordChangeSubmit}
                  pending={state.pending()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "register"}>
                <PasswordRegisterPanel
                  confirmPassword={state.confirmPassword.get()}
                  displayName={state.displayName.get()}
                  email={state.email.get()}
                  errorMessage={state.errorMessage()}
                  newPassword={state.newPassword.get()}
                  onBack={() => state.go("chooser")}
                  onConfirmPassword={state.confirmPassword.set}
                  onDisplayName={state.displayName.set}
                  onEmail={state.email.set}
                  onNewPassword={state.newPassword.set}
                  onSubmit={state.registerSubmit}
                  onUserName={state.userName.set}
                  organizationName={organizationName()}
                  pending={state.pending()}
                  userName={state.userName.get()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "register-done"}>
                <LoginNoticePanel
                  actionLabel={messageTranslate("login.chooser.title")}
                  description={messageTranslate("login.register.doneDescription", { email: state.email.get() })}
                  kind="pending"
                  onAction={() => state.go("chooser")}
                  title={messageTranslate("login.register.doneTitle")}
                />
              </Match>
              <Match when={state.screen() === "verify-email"}>
                <PasswordVerifyEmailPanel
                  email={state.email.get()}
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("chooser")}
                  onSubmit={state.verifyEmailSubmit}
                  pending={state.pending()}
                  validationMessage={state.validationMessage()}
                  verified={state.status() === "verified"}
                />
              </Match>
              <Match when={state.screen() === "email-otp" || state.screen() === "email-otp-code"}>
                <EmailOtpPanel
                  code={state.code.get()}
                  email={state.email.get()}
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("chooser")}
                  onCode={state.code.set}
                  onEmail={state.email.set}
                  onResend={state.emailOtpResend}
                  onSubmit={state.emailOtpSubmit}
                  pending={state.pending()}
                  step={state.screen() === "email-otp" ? "email" : "code"}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "passkey"}>
                <PasskeyPanel
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("chooser")}
                  onContinue={state.passkeyAuthenticate}
                  pending={state.pending()}
                  supported={state.passkeySupported()}
                />
              </Match>
              <Match when={state.screen() === "provider"}>
                <Show
                  when={provider()}
                  fallback={
                    <LoginNoticePanel
                      description={messageTranslate("login.status.unavailableDescription")}
                      kind="error"
                      title={messageTranslate("login.status.unavailableTitle")}
                    />
                  }
                >
                  {(configured) => (
                    <ExternalIdentityPanel
                      displayName={configured().displayName}
                      errorMessage={state.errorMessage()}
                      onBack={() => state.go("chooser")}
                      onContinue={() => void state.providerStart(configured().id)}
                      pending={state.pending()}
                      type={configured().type}
                    />
                  )}
                </Show>
              </Match>
              <Match when={state.screen() === "mfa"}>
                <MfaPanel
                  factors={["totp", "email-otp", "passkey", "recovery-code"]}
                  onBack={() => state.go("chooser")}
                  onSelect={(factor) =>
                    state.go(
                      factor === "totp"
                        ? "mfa-totp"
                        : factor === "email-otp"
                          ? "mfa-email-otp"
                          : factor === "passkey"
                            ? "mfa-passkey"
                            : "mfa-recovery-code",
                    )
                  }
                />
              </Match>
              <Match
                when={
                  state.screen() === "mfa-totp" ||
                  state.screen() === "mfa-email-otp" ||
                  state.screen() === "mfa-recovery-code"
                }
              >
                <MfaCodePanel
                  code={state.code.get()}
                  errorMessage={state.errorMessage()}
                  kind={
                    state.screen() === "mfa-totp"
                      ? "totp"
                      : state.screen() === "mfa-email-otp"
                        ? "email-otp"
                        : "recovery-code"
                  }
                  onBack={() => state.go("mfa")}
                  onCode={state.code.set}
                  onSubmit={state.mfaSubmit}
                  pending={state.pending()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "mfa-passkey"}>
                <PasskeyPanel
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("mfa")}
                  onContinue={state.passkeyAuthenticate}
                  pending={state.pending()}
                  supported={state.passkeySupported()}
                />
              </Match>
              <Match when={state.screen() === "mfa-totp-enroll"}>
                <MfaTotpEnrollPanel
                  code={state.code.get()}
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("mfa")}
                  onCode={state.code.set}
                  onStart={() => void state.totpEnrollStart()}
                  onSubmit={state.totpEnrollSubmit}
                  pending={state.pending()}
                  secret={state.totpSecret()?.secret}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "recovery-request"}>
                <PasswordRecoveryRequestPanel
                  email={state.email.get()}
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("password")}
                  onEmail={state.email.set}
                  onSubmit={state.recoverySubmit}
                  pending={state.pending()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "recovery-sent"}>
                <LoginNoticePanel
                  actionLabel={messageTranslate("login.chooser.title")}
                  description={messageTranslate("login.recovery.sentDescription")}
                  kind="pending"
                  onAction={() => state.go("chooser")}
                  title={messageTranslate("login.recovery.sentTitle")}
                />
              </Match>
              <Match when={state.screen() === "recovery-reset"}>
                <PasswordResetPanel
                  confirmPassword={state.confirmPassword.get()}
                  errorMessage={state.errorMessage()}
                  newPassword={state.newPassword.get()}
                  onConfirmPassword={state.confirmPassword.set}
                  onNewPassword={state.newPassword.set}
                  onSubmit={state.recoveryResetSubmit}
                  pending={state.pending()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "recovery-complete"}>
                <LoginNoticePanel
                  actionLabel={messageTranslate("login.password.submit")}
                  description={messageTranslate("login.recovery.completeDescription")}
                  kind="success"
                  onAction={() => state.go("password")}
                  title={messageTranslate("login.recovery.completeTitle")}
                />
              </Match>
              <Match when={state.screen() === "logout"}>
                <LoginLogoutPanel
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("chooser")}
                  onLogout={() => void state.logout()}
                  organizationName={organizationName()}
                  pending={state.pending()}
                />
              </Match>
              <Match when={state.screen() === "logout-done"}>
                <LoginNoticePanel
                  actionLabel={messageTranslate("login.chooser.title")}
                  description={messageTranslate("login.logout.doneDescription", { organization: organizationName() })}
                  kind="success"
                  onAction={() => state.go("chooser")}
                  title={messageTranslate("login.logout.doneTitle")}
                />
              </Match>
              <Match when={state.screen() === "signed-in"}>
                <LoginNoticePanel
                  description={messageTranslate("login.signedIn.description", { organization: organizationName() })}
                  kind="success"
                  title={messageTranslate("login.signedIn.title")}
                />
              </Match>
            </Switch>
          </LoginFrame>
        )}
      </Match>
    </Switch>
  )
}
