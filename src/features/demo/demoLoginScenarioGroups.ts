import type { DemoFixtureScenarioGroup } from "./demoFixtureScenarioGroupSchema.js"
import type { DemoFixtureState } from "./demoFixtureStateSchema.js"

const formStates: readonly DemoFixtureState[] = ["success", "error", "loading"]
const authenticationStates: readonly DemoFixtureState[] = ["success", "error", "loading", "expired"]

export const demoLoginScenarioGroups: DemoFixtureScenarioGroup[] = [
  {
    description: "Entry points derived from the discovered login policy and locally remembered accounts.",
    key: "chooser",
    scenarios: [
      scenario("chooser", "Method chooser", "Choose an allowed primary authentication method.", formStates),
      scenario("chooser/recent-accounts", "Recent accounts", "Continue with an account remembered on this device.", [
        "success",
        "empty",
        "error",
        "loading",
      ]),
    ],
    title: "Start sign-in",
  },
  {
    description: "Password and email-code authentication with deterministic local fixtures.",
    key: "password-email",
    scenarios: [
      scenario("password", "Password", "Sign in with an email address or username and password.", authenticationStates),
      scenario("password/error", "Invalid credentials", "Show a safe invalid-credentials response.", ["error"]),
      scenario(
        "password/change-required",
        "Password change required",
        "Set a new password before continuing.",
        formStates,
      ),
      scenario(
        "password/change-required/expired",
        "Password change required",
        "Your password has expired. Set a new password to continue.",
        ["password-change-expired"],
      ),
      scenario("email-otp", "Request email code", "Request a one-time code delivered by email.", formStates),
      scenario(
        "email-otp/code",
        "Verify email code",
        "Enter the six-digit email verification code.",
        authenticationStates,
      ),
    ],
    title: "Password and email code",
  },
  {
    description: "Registration and server-issued email confirmation.",
    key: "registration",
    scenarios: [
      scenario("register", "Registration", "Create a human account under the active login policy.", formStates),
      scenario("register/done", "Confirmation sent", "Show the non-disclosing verification notice.", ["success"]),
      scenario("verify-email", "Email verification", "Confirm an address from a server-issued link.", formStates),
    ],
    title: "Registration and verification",
  },
  {
    description: "Passkeys and configured Google, GitHub, and Microsoft providers.",
    key: "passwordless",
    scenarios: [
      scenario("passkey", "Passkey", "Authenticate with a device-bound passkey.", [
        ...authenticationStates,
        "mfa-continuation",
        "permission-denied",
      ]),
      scenario("passkey/unsupported", "Passkey unavailable", "Explain browser or device incompatibility.", [
        "passkey-unsupported",
      ]),
      scenario(
        "passkey/permission-denied",
        "Passkey unavailable",
        "This browser or device cannot use passkeys. Choose another sign-in method.",
        ["passkey-permission-denied"],
      ),
      scenario(
        "passkey/ceremony-failure",
        "Passkey unavailable",
        "This browser or device cannot use passkeys. Choose another sign-in method.",
        ["passkey-ceremony-failure"],
      ),
      scenario("passkey/pending", "Passkey", "Confirm with your device screen lock, fingerprint, or security key.", [
        "passkey-pending",
      ]),
      scenario("idp", "External identity", "Continue through a configured external identity provider.", formStates),
      scenario("idp/failure", "Provider failure", "Recover from an external provider start failure.", ["error"]),
      scenario(
        "idp/account-not-found",
        "No account linked",
        "Account linking could not be completed. Please try another sign-in method.",
        ["success"],
      ),
      scenario(
        "idp/linking-failed",
        "Could not link account",
        "Account linking could not be completed. Please try another sign-in method.",
        ["success"],
      ),
      scenario(
        "idp/registration-failed",
        "Could not link account",
        "Account linking could not be completed. Please try another sign-in method.",
        ["success"],
      ),
    ],
    title: "Passwordless and external",
  },
  {
    description: "Second-factor challenges, authenticator enrollment, and recovery codes.",
    key: "mfa",
    scenarios: [
      scenario("mfa", "Choose a factor", "Choose an available second factor.", ["success"]),
      scenario(
        "mfa/loading",
        "Loading 2-step verification options...",
        "Fetching the available second-factor choices.",
        ["mfa-loading"],
      ),
      scenario(
        "mfa/retry",
        "2-step verification unavailable",
        "The available second-factor choices could not be loaded.",
        ["mfa-retry"],
      ),
      scenario(
        "mfa/enroll",
        "Set up 2-step verification",
        "Select a method to set up 2-step verification for your account.",
        ["mfa-enroll"],
      ),
      scenario(
        "mfa/optional",
        "Optional 2-step verification",
        "You can set up 2-step verification for extra security or skip for now.",
        ["mfa-optional"],
      ),
      scenario(
        "mfa/satisfied",
        "2-step verification satisfied",
        "Your sign-in already satisfies the 2-step verification policy.",
        ["mfa-satisfied"],
      ),
      scenario("mfa/totp", "Authenticator code", "Verify a time-based authenticator code.", formStates),
      scenario("mfa/email-otp", "Email code", "Verify an email second factor.", formStates),
      scenario(
        "mfa/email-otp/code",
        "Email verification code",
        "Enter the six-digit code we sent to your email address.",
        authenticationStates,
      ),
      scenario(
        "mfa/email-otp/enroll",
        "Set up email codes",
        "Verification codes will be sent to your account email address.",
        formStates,
      ),
      scenario("mfa/passkey", "Passkey factor", "Verify a passkey as a second factor.", formStates),
      scenario(
        "mfa/passkey/enroll",
        "Passkey setup unavailable",
        "Passkey enrollment is not exposed by the hosted login contract.",
        ["mfa-setup-unavailable"],
      ),
      scenario(
        "mfa/recovery-code",
        "Recovery code",
        "Use a single recovery code when other factors are unavailable.",
        formStates,
      ),
      scenario("mfa/totp-enroll", "Enroll authenticator", "Connect and confirm a new authenticator.", formStates),
      scenario(
        "mfa/totp-enroll/unavailable",
        "Authenticator app",
        "Authenticator setup could not be prepared here. The setup details cannot be restored after a reload.",
        ["mfa-setup-unavailable"],
      ),
    ],
    title: "Multi-factor authentication",
  },
  {
    description: "Request and complete password recovery without account disclosure.",
    key: "recovery",
    scenarios: [
      scenario("password/forgot", "Request recovery", "Request password recovery instructions.", formStates),
      scenario(
        "password/forgot/loading",
        "Loading password recovery...",
        "Enter your email address and we will send recovery instructions if an account exists.",
        ["recovery-loading"],
      ),
      scenario(
        "password/forgot/unavailable",
        "Password recovery unavailable",
        "Password recovery is temporarily unavailable.",
        ["recovery-fatal"],
      ),
      scenario("password/forgot/sent", "Recovery requested", "Show the non-disclosing email confirmation.", [
        "success",
      ]),
      scenario("password/reset", "Reset password", "Choose a new password from a recovery link.", formStates),
      scenario("password/reset/loading", "Checking your reset link...", "Loading password recovery...", [
        "reset-loading",
      ]),
      scenario(
        "password/reset/invalid",
        "This reset link is no longer valid",
        "This password reset link is invalid or has expired.",
        ["reset-invalid"],
      ),
      scenario("password/reset/complete", "Reset complete", "Return to sign-in after a successful reset.", ["success"]),
    ],
    title: "Recovery",
  },
  {
    description: "Interaction outcomes and sign-out for hosted OIDC requests.",
    key: "interaction",
    scenarios: [
      scenario("signed-in", "Interaction complete", "Show the resumed-interaction confirmation.", ["success"]),
      scenario("logout", "Logout", "Confirm sign-out for the current browser session.", formStates),
      scenario("logout/done", "Signed out", "Confirm a completed sign-out and validated return path.", ["success"]),
    ],
    title: "Interaction and logout",
  },
  {
    description: "Cross-flow fallbacks used by every hosted interaction screen.",
    key: "chrome",
    scenarios: [
      scenario("loading", "Loading", "Show progress while realm discovery resolves.", ["loading"]),
      scenario("continuing", "Continuing sign-in...", "Continuing sign-in...", ["continuing"]),
      scenario(
        "fatal",
        "Start sign-in again",
        "This sign-in request cannot be completed. Return to the application and try again.",
        ["fatal"],
      ),
      scenario("unsupported", "Unavailable request", "Explain an unsupported or expired interaction.", ["error"]),
    ],
    title: "Shared states",
  },
]

function scenario(path: string, title: string, description: string, states: readonly DemoFixtureState[]) {
  return {
    availability: "available" as const,
    description,
    key: path.replaceAll("/", "-"),
    path: `/demo/login/${path}`,
    states: [...states],
    title,
  }
}
