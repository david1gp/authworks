import { Match, Show, Switch } from "solid-js"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { EmailOtpPanel } from "../../emailOtp/ui/EmailOtpPanel.js"
import { ExternalIdentityPanel } from "../../externalIdentities/ui/ExternalIdentityPanel.js"
import { MfaCodePanel } from "../../mfa/ui/MfaCodePanel.js"
import { MfaEmailOtpPanel } from "../../mfa/ui/MfaEmailOtpPanel.js"
import { MfaPanel } from "../../mfa/ui/MfaPanel.js"
import { MfaPasskeyEnrollPanel } from "../../mfa/ui/MfaPasskeyEnrollPanel.js"
import { MfaTotpEnrollPanel } from "../../mfa/ui/MfaTotpEnrollPanel.js"
import { PasskeyPanel } from "../../passkeys/ui/PasskeyPanel.js"
import { PasswordChangeRequiredPanel } from "../../passwords/ui/PasswordChangeRequiredPanel.js"
import { PasswordPanel } from "../../passwords/ui/PasswordPanel.js"
import { PasswordRecoveryRequestPanel } from "../../passwords/ui/PasswordRecoveryRequestPanel.js"
import { PasswordRegisterPanel } from "../../passwords/ui/PasswordRegisterPanel.js"
import { PasswordResetPanel } from "../../passwords/ui/PasswordResetPanel.js"
import { PasswordVerifyEmailPanel } from "../../passwords/ui/PasswordVerifyEmailPanel.js"
import { RecentAccountChooser } from "../../sessions/ui/RecentAccountChooser.js"
import { LoginFatalPanel } from "./LoginFatalPanel.js"
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
  const provider = () => state.provider()

  return (
    <Switch>
      <Match
        when={
          state.status() === "loading" ||
          (state.status() === "continuing" && state.screen() !== "signed-in") ||
          (state.status() !== "fatal" && state.screen() === "loading")
        }
      >
        <LoginUnavailableFrame busy>
          <div class="grid justify-items-center gap-4 py-10" role="status">
            <LoaderShuffle4Dots />
            <h1 class="text-base font-medium" ref={state.lifecycleHeadingRegister} tabindex="-1">
              {state.status() === "continuing"
                ? messageTranslate("login.status.continuing")
                : messageTranslate("login.status.loading")}
            </h1>
          </div>
        </LoginUnavailableFrame>
      </Match>
      <Match when={state.status() === "fatal"}>
        <LoginUnavailableFrame unavailable>
          <LoginFatalPanel errorMessage={state.errorMessage()} headingRegister={state.lifecycleHeadingRegister} />
        </LoginUnavailableFrame>
      </Match>
      <Match when={state.status() === "unavailable" || state.screen() === "unsupported"}>
        <LoginUnavailableFrame unavailable>
          <LoginNoticePanel
            description={messageTranslate("login.status.unavailableDescription")}
            kind="error"
            title={messageTranslate("login.status.unavailableTitle")}
          />
        </LoginUnavailableFrame>
      </Match>
      <Match when={state.discovery()}>
        {(discovery) => (
          <LoginFrame bootstrap={discovery()} busy={state.pending()} screen={state.screen()}>
            <Switch>
              <Match when={state.screen() === "chooser"}>
                <MethodChooser
                  discovery={discovery()}
                  methods={state.methods()}
                  onRecentAccount={state.recentAccountSelect}
                  onRegister={() => state.go("register")}
                  onSelect={(method, providerId) => {
                    if (method === "external-identity" && providerId !== undefined) state.providerSelect(providerId)
                    state.go(
                      method === "external-identity"
                        ? "provider"
                        : method === "email-otp"
                          ? "email-otp"
                          : method === "passkey"
                            ? "passkey"
                            : "password",
                    )
                  }}
                  pending={state.pending()}
                  recentAccounts={state.recentAccounts()}
                />
              </Match>
              <Match when={state.screen() === "recent-accounts"}>
                <RecentAccountChooser
                  accounts={state.recentAccounts()}
                  onBack={() => state.go("chooser")}
                  onUseAnotherAccount={() => state.go("chooser")}
                  pending={state.pending()}
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
                  onRememberIdentifier={state.rememberIdentifierChange}
                  onRevealPassword={() => state.revealPassword.set(!state.revealPassword.get())}
                  onSubmit={state.passwordSubmit}
                  password={state.password.get()}
                  pending={state.pending()}
                  passwordInputRegister={state.passwordInputRegister}
                  identifierInputRegister={state.identifierInputRegister}
                  rememberIdentifier={state.rememberIdentifier()}
                  revealPassword={state.revealPassword.get()}
                  valid={state.passwordValid()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "password-change-required"}>
                <PasswordChangeRequiredPanel
                  confirmPassword={state.confirmPassword.get()}
                  currentPassword={state.password.get()}
                  errorMessage={state.errorMessage()}
                  expired={state.passwordChangeExpired()}
                  newPassword={state.newPassword.get()}
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
                  description={
                    state.email.get().trim().length === 0
                      ? messageTranslate("login.verify.description")
                      : messageTranslate("login.register.doneDescription", { email: state.email.get() })
                  }
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
                  emailInputRegister={state.emailOtpEmailInputRegister}
                  codeInputRegister={state.emailOtpCodeInputRegister}
                  emailOtpNotice={state.emailOtpNotice()}
                  errorMessage={state.errorMessage()}
                  onChangeEmail={state.emailOtpChangeEmail}
                  onBack={() => state.go("chooser")}
                  onCode={state.emailOtpCodeSet}
                  onEmail={state.email.set}
                  onRememberEmail={state.rememberIdentifierChange}
                  onResend={state.emailOtpResend}
                  onSubmit={state.emailOtpSubmit}
                  pending={state.pending()}
                  rememberEmail={state.rememberIdentifier()}
                  resendAllowed={state.emailOtpResendAllowed()}
                  resendCountdown={state.emailOtpResendCountdown()}
                  step={state.screen() === "email-otp" ? "email" : "code"}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "passkey"}>
                <PasskeyPanel
                  errorMessage={state.errorMessage()}
                  identifier={state.identifier.get()}
                  identifierInputRegister={state.identifierInputRegister}
                  mfaContinuation={state.screen() === "mfa-passkey"}
                  onBack={() => state.go("chooser")}
                  onContinue={state.passkeyAuthenticate}
                  onIdentifier={state.identifier.set}
                  onRememberIdentifier={state.rememberIdentifierChange}
                  pending={state.pending()}
                  rememberIdentifier={state.rememberIdentifier()}
                  supported={state.passkeySupported()}
                  status={state.passkeyStatus()}
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
                      status={state.providerStatus()}
                      type={configured().type}
                    />
                  )}
                </Show>
              </Match>
              <Match
                when={
                  state.screen() === "mfa" ||
                  state.screen() === "mfa-enroll" ||
                  state.screen() === "mfa-loading" ||
                  state.screen() === "mfa-optional" ||
                  state.screen() === "mfa-options-unavailable" ||
                  state.screen() === "mfa-satisfied"
                }
              >
                <MfaPanel
                  errorMessage={state.errorMessage()}
                  factorAvailability={state.mfaFactorAvailability()}
                  factors={state.mfaFactors()}
                  mode={state.mfaMode()}
                  onBack={() => state.go("chooser")}
                  onContinue={() => state.go("signed-in")}
                  onRetry={state.mfaOptionsRetry}
                  onSelect={(factor) =>
                    state.go(
                      factor === "totp"
                        ? state.screen() === "mfa-enroll" || state.screen() === "mfa-optional"
                          ? "mfa-totp-enroll"
                          : "mfa-totp"
                        : factor === "email-otp"
                          ? state.screen() === "mfa-enroll" || state.screen() === "mfa-optional"
                            ? "mfa-email-otp-enroll"
                            : "mfa-email-otp"
                          : factor === "passkey"
                            ? state.screen() === "mfa-enroll" || state.screen() === "mfa-optional"
                              ? "mfa-passkey-enroll"
                              : "mfa-passkey"
                            : "mfa-recovery-code",
                    )
                  }
                  onSkip={() => state.go("signed-in")}
                  pending={state.pending()}
                />
              </Match>
              <Match when={state.screen() === "mfa-totp" || state.screen() === "mfa-recovery-code"}>
                <MfaCodePanel
                  code={state.code.get()}
                  errorMessage={state.errorMessage()}
                  kind={state.screen() === "mfa-totp" ? "totp" : "recovery-code"}
                  onBack={() => state.go("mfa")}
                  onCode={state.mfaCodeSet}
                  onSubmit={state.mfaSubmit}
                  pending={state.pending()}
                  validationMessage={state.validationMessage()}
                  valid={state.mfaCodeValid()}
                />
              </Match>
              <Match
                when={
                  state.screen() === "mfa-email-otp" ||
                  state.screen() === "mfa-email-otp-code" ||
                  state.screen() === "mfa-email-otp-enroll"
                }
              >
                <MfaEmailOtpPanel
                  available={state.mfaEmailOtpAvailable()}
                  code={state.code.get()}
                  countdown={state.mfaEmailOtpResendCountdown()}
                  email={state.email.get()}
                  errorMessage={state.errorMessage()}
                  notice={state.mfaEmailOtpNotice()}
                  onBack={() => state.go("mfa")}
                  onCode={state.mfaCodeSet}
                  onEnroll={state.mfaEmailOtpEnroll}
                  onResend={state.mfaEmailOtpResend}
                  onSend={state.mfaEmailOtpSend}
                  onSubmit={state.mfaSubmit}
                  pending={state.pending()}
                  stage={state.mfaEmailOtpStage()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "mfa-passkey"}>
                <PasskeyPanel
                  errorMessage={state.errorMessage()}
                  identifier={state.identifier.get()}
                  identifierInputRegister={state.identifierInputRegister}
                  mfaContinuation
                  onBack={() => state.go("mfa")}
                  onContinue={state.mfaPasskeyAuthenticate}
                  onIdentifier={state.identifier.set}
                  onRememberIdentifier={state.rememberIdentifierChange}
                  pending={state.pending()}
                  rememberIdentifier={state.rememberIdentifier()}
                  supported={state.passkeySupported()}
                  status={state.passkeyStatus()}
                  mfaAvailable={state.mfaPasskeyAvailable()}
                />
              </Match>
              <Match when={state.screen() === "mfa-passkey-enroll"}>
                <MfaPasskeyEnrollPanel
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("mfa")}
                  pending={state.pending()}
                />
              </Match>
              <Match when={state.screen() === "mfa-totp-enroll"}>
                <MfaTotpEnrollPanel
                  code={state.code.get()}
                  errorMessage={state.errorMessage()}
                  onBack={() => state.go("mfa")}
                  onCode={state.mfaCodeSet}
                  onStart={() => void state.totpEnrollStart()}
                  onSubmit={state.totpEnrollSubmit}
                  pending={state.pending()}
                  otpauthUri={state.totpSetup()?.otpauthUri}
                  secret={state.totpSetup()?.secret}
                  setupUnavailable={state.totpSetupUnavailable()}
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
                  step={state.recoveryRequestStep()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "recovery-sent"}>
                <LoginNoticePanel
                  actionLabel={messageTranslate("login.recovery.back")}
                  description={messageTranslate("login.recovery.sentDescription")}
                  kind="pending"
                  onAction={() => state.go("password")}
                  title={messageTranslate("login.recovery.sentTitle")}
                />
              </Match>
              <Match when={state.screen() === "recovery-reset"}>
                <PasswordResetPanel
                  confirmPassword={state.confirmPassword.get()}
                  errorMessage={state.errorMessage()}
                  newPassword={state.newPassword.get()}
                  onBack={() => state.go("password")}
                  onConfirmPassword={state.confirmPassword.set}
                  onNewPassword={state.newPassword.set}
                  onSubmit={state.recoveryResetSubmit}
                  pending={state.pending()}
                  step={state.recoveryResetStep()}
                  validationMessage={state.validationMessage()}
                />
              </Match>
              <Match when={state.screen() === "recovery-complete"}>
                <PasswordResetPanel
                  confirmPassword={state.confirmPassword.get()}
                  errorMessage={state.errorMessage()}
                  newPassword={state.newPassword.get()}
                  onBack={() => state.go("password")}
                  onConfirmPassword={state.confirmPassword.set}
                  onNewPassword={state.newPassword.set}
                  onSubmit={state.recoveryResetSubmit}
                  pending={state.pending()}
                  step="complete"
                  validationMessage={state.validationMessage()}
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
