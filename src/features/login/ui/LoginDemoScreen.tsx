import { Match, Show, Switch } from "solid-js"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { DemoLoginDirectory } from "../../demo/ui/DemoLoginDirectory.js"
import { DemoNav } from "../../demo/ui/DemoNav.js"
import { RecentAccountChooser } from "../../sessions/ui/RecentAccountChooser.js"
import { EmailOtpPanel } from "../../emailOtp/ui/EmailOtpPanel.js"
import { ExternalIdentityPanel } from "../../externalIdentities/ui/ExternalIdentityPanel.js"
import { MfaEmailOtpPanel } from "../../mfa/ui/MfaEmailOtpPanel.js"
import { MfaPanel } from "../../mfa/ui/MfaPanel.js"
import { MfaTotpEnrollPanel } from "../../mfa/ui/MfaTotpEnrollPanel.js"
import { MfaTotpPanel } from "../../mfa/ui/MfaTotpPanel.js"
import { PasskeyPanel } from "../../passkeys/ui/PasskeyPanel.js"
import { PasswordChangeRequiredPanel } from "../../passwords/ui/PasswordChangeRequiredPanel.js"
import { PasswordPanel } from "../../passwords/ui/PasswordPanel.js"
import { PasswordRecoveryRequestPanel } from "../../passwords/ui/PasswordRecoveryRequestPanel.js"
import { PasswordResetPanel } from "../../passwords/ui/PasswordResetPanel.js"
import { LoginFrame } from "./LoginFrame.js"
import { MethodChooser } from "./MethodChooser.js"
import { UnsupportedMethodPanel } from "./UnsupportedMethodPanel.js"
import type { loginDemoAppStateCreate } from "./loginDemoAppStateCreate.js"

type LoginDemoState = ReturnType<typeof loginDemoAppStateCreate>

export function LoginDemoScreen(props: { state: LoginDemoState }) {
  return (
    <div class="flex min-h-dvh gap-4 p-4">
      <DemoNav
        compact={props.state.chrome() === "compact"}
        onNavigate={props.state.go}
        onToggle={props.state.onToggleChrome}
      />
      <main class="min-w-0 flex-1">
        <Switch fallback={<DemoLoginDirectory />}>
          <Match when={props.state.scenario() === "/demo/login"}>
            <DemoLoginDirectory />
          </Match>
          <Match when={props.state.scenario() === "/demo/login/loading"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <div class="grid justify-items-center gap-4 py-12">
                <LoaderShuffle4Dots />
                <p>Loading sign-in…</p>
              </div>
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/unsupported"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <UnsupportedMethodPanel
                title="Sign-in unavailable"
                description="This sign-in request cannot be completed in the demo."
                onBack={() => props.state.go("/demo/login")}
              />
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/chooser"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <MethodChooser methods={props.state.methods} onSelect={props.state.onSelectMethod} />
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/chooser/recent-accounts"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <RecentAccountChooser
                onSelect={(value) => {
                  props.state.onIdentifier(value)
                  props.state.go("/demo/login/password")
                }}
              />
            </LoginFrame>
          </Match>
          <Match
            when={
              props.state.scenario() === "/demo/login/email-otp" ||
              props.state.scenario() === "/demo/login/email-otp/code"
            }
          >
            <LoginFrame bootstrap={props.state.bootstrap}>
              <Show
                when={props.state.completed()}
                fallback={
                  <EmailOtpPanel
                    code={props.state.code()}
                    email={props.state.email()}
                    error={props.state.error()}
                    remainingSeconds={props.state.resendSeconds()}
                    step={props.state.otpStep()}
                    onBack={() => props.state.go("/demo/login/chooser")}
                    onCode={props.state.onCode}
                    onEmail={props.state.onEmail}
                    onResend={props.state.onResend}
                    onSubmit={props.state.onEmailOtpSubmit}
                  />
                }
              >
                <CompletionNotice />
              </Show>
            </LoginFrame>
          </Match>
          <Match
            when={
              props.state.scenario() === "/demo/login/password" ||
              props.state.scenario() === "/demo/login/password/error"
            }
          >
            <LoginFrame bootstrap={props.state.bootstrap}>
              <Show
                when={props.state.completed()}
                fallback={
                  <PasswordPanel
                    error={props.state.error()}
                    identifier={props.state.identifier()}
                    password={props.state.password?.() ?? ""}
                    rememberIdentifier={props.state.rememberIdentifier()}
                    revealPassword={props.state.revealPassword()}
                    onBack={() => props.state.go("/demo/login/chooser")}
                    onIdentifier={props.state.onIdentifier}
                    onPassword={props.state.onPassword}
                    onRememberIdentifier={props.state.onRememberIdentifier}
                    onRevealPassword={props.state.onRevealPassword}
                    onSubmit={props.state.onPasswordSubmit}
                    onForgot={props.state.onForgot}
                  />
                }
              >
                <CompletionNotice />
              </Show>
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/password/change-required"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <Show
                when={props.state.completed()}
                fallback={
                  <PasswordChangeRequiredPanel
                    newPassword={props.state.newPassword()}
                    onBack={() => props.state.go("/demo/login/chooser")}
                    onNewPassword={props.state.onNewPassword}
                    onSubmit={props.state.onChangeRequiredSubmit}
                  />
                }
              >
                <CompletionNotice />
              </Show>
            </LoginFrame>
          </Match>
          <Match
            when={
              props.state.scenario() === "/demo/login/passkey" ||
              props.state.scenario() === "/demo/login/passkey/unsupported"
            }
          >
            <LoginFrame bootstrap={props.state.bootstrap}>
              <Show
                when={props.state.completed()}
                fallback={
                  <PasskeyPanel
                    unsupported={props.state.scenario() === "/demo/login/passkey/unsupported"}
                    onBack={() => props.state.go("/demo/login/chooser")}
                    onComplete={props.state.onPasskey}
                  />
                }
              >
                <CompletionNotice />
              </Show>
            </LoginFrame>
          </Match>
          <Match
            when={props.state.scenario() === "/demo/login/idp" || props.state.scenario() === "/demo/login/idp/failure"}
          >
            <LoginFrame bootstrap={props.state.bootstrap}>
              <Show
                when={props.state.completed()}
                fallback={
                  <ExternalIdentityPanel
                    failed={props.state.scenario() === "/demo/login/idp/failure" && !!props.state.error()}
                    onBack={() => props.state.go("/demo/login/chooser")}
                    onContinue={props.state.onExternalIdentity}
                  />
                }
              >
                <CompletionNotice />
              </Show>
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/mfa"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <MfaPanel
                onBack={() => props.state.go("/demo/login/chooser")}
                onEmail={() => props.state.go("/demo/login/mfa/email-otp")}
                onTotp={() => props.state.go("/demo/login/mfa/totp")}
                onPasskey={() => props.state.go("/demo/login/passkey")}
              />
            </LoginFrame>
          </Match>
          <Match
            when={
              props.state.scenario() === "/demo/login/mfa/totp" ||
              props.state.scenario() === "/demo/login/mfa/email-otp"
            }
          >
            <LoginFrame bootstrap={props.state.bootstrap}>
              <Show
                when={props.state.completed()}
                fallback={
                  props.state.scenario() === "/demo/login/mfa/totp" ? (
                    <MfaTotpPanel
                      code={props.state.code()}
                      error={props.state.error()}
                      onBack={() => props.state.go("/demo/login/mfa")}
                      onCode={props.state.onCode}
                      onSubmit={props.state.onMfaSubmit}
                    />
                  ) : (
                    <MfaEmailOtpPanel
                      code={props.state.code()}
                      error={props.state.error()}
                      onBack={() => props.state.go("/demo/login/mfa")}
                      onCode={props.state.onCode}
                      onSubmit={props.state.onMfaSubmit}
                    />
                  )
                }
              >
                <CompletionNotice />
              </Show>
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/mfa/totp-enroll"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <Show
                when={props.state.completed()}
                fallback={
                  <MfaTotpEnrollPanel
                    code={props.state.code()}
                    error={props.state.error()}
                    onBack={() => props.state.go("/demo/login/mfa")}
                    onCode={props.state.onCode}
                    onSubmit={props.state.onEnrollSubmit}
                  />
                }
              >
                <CompletionNotice />
              </Show>
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/password/forgot"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <PasswordRecoveryRequestPanel
                email={props.state.email()}
                error={props.state.error()}
                onBack={() => props.state.go("/demo/login/password")}
                onEmail={props.state.onEmail}
                onSubmit={props.state.onRecoverySubmit}
              />
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/password/forgot/sent"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <SuccessNotice
                title="Check your email"
                copy="If an account matches, recovery instructions are on their way."
                onBack={() => props.state.go("/demo/login/chooser")}
              />
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/password/reset"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <PasswordResetPanel
                newPassword={props.state.newPassword()}
                onNewPassword={props.state.onNewPassword}
                onSubmit={props.state.onResetSubmit}
              />
            </LoginFrame>
          </Match>
          <Match when={props.state.scenario() === "/demo/login/password/reset/complete"}>
            <LoginFrame bootstrap={props.state.bootstrap}>
              <SuccessNotice
                title="Password reset complete"
                copy="You can now return to sign in with your new password."
                onBack={() => props.state.go("/demo/login/password")}
              />
            </LoginFrame>
          </Match>
        </Switch>
      </main>
    </div>
  )
}

function CompletionNotice() {
  return (
    <p class="rounded-lg bg-green-100 p-4 text-green-900 dark:bg-green-950 dark:text-green-100" role="status">
      Demo submission completed successfully.
    </p>
  )
}

function SuccessNotice(props: { title: string; copy: string; onBack: () => void }) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">{props.title}</h1>
      <p class="mt-3 text-muted-foreground">{props.copy}</p>
      <Button class="mt-6" variant="filledBlue" onClick={props.onBack}>
        Return to sign in
      </Button>
    </section>
  )
}
