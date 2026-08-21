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
      scenario("passkey", "Passkey", "Authenticate with a device-bound passkey.", authenticationStates),
      scenario("passkey/unsupported", "Passkey unavailable", "Explain browser or device incompatibility.", ["error"]),
      scenario("idp", "External identity", "Continue through a configured external identity provider.", formStates),
      scenario("idp/failure", "Provider failure", "Recover from an external provider start failure.", ["error"]),
    ],
    title: "Passwordless and external",
  },
  {
    description: "Second-factor challenges, authenticator enrollment, and recovery codes.",
    key: "mfa",
    scenarios: [
      scenario("mfa", "Choose a factor", "Choose an available second factor.", ["success"]),
      scenario("mfa/totp", "Authenticator code", "Verify a time-based authenticator code.", formStates),
      scenario("mfa/email-otp", "Email code", "Verify an email second factor.", formStates),
      scenario("mfa/passkey", "Passkey factor", "Verify a passkey as a second factor.", formStates),
      scenario(
        "mfa/recovery-code",
        "Recovery code",
        "Use a single recovery code when other factors are unavailable.",
        formStates,
      ),
      scenario("mfa/totp-enroll", "Enroll authenticator", "Connect and confirm a new authenticator.", formStates),
    ],
    title: "Multi-factor authentication",
  },
  {
    description: "Request and complete password recovery without account disclosure.",
    key: "recovery",
    scenarios: [
      scenario("password/forgot", "Request recovery", "Request password recovery instructions.", formStates),
      scenario("password/forgot/sent", "Recovery requested", "Show the non-disclosing email confirmation.", [
        "success",
      ]),
      scenario("password/reset", "Reset password", "Choose a new password from a recovery link.", formStates),
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
