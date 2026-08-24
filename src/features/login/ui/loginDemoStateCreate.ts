import { useLocation, useNavigate } from "@solidjs/router"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoLoginPasswordPreference } from "../../demo/demoLoginPasswordPreference.js"
import { loginPathResolve } from "../model/loginPathResolve.js"
import { loginDemoAdapterCreate } from "./loginDemoAdapterCreate.js"
import { loginDemoInitialStateResolve } from "./loginDemoInitialStateResolve.js"
import { loginDemoStates } from "./loginDemoStates.js"
import { loginPageStateCreate } from "./loginPageStateCreate.js"

export const loginDemoBasePath = "/demo/login"

/**
 * Fixture-backed login state. The fixture outcome comes from `?state=`, and legacy demo paths that
 * encoded an outcome in the URL still resolve to the same state without a query parameter.
 */
export function loginDemoStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const resolved = () => loginPathResolve(location.pathname, loginDemoBasePath)
  const fixtureState = () => resolved()?.state ?? demoFixtureStateSelect(location.search, loginDemoStates)
  const initialState = loginDemoInitialStateResolve(resolved()?.screen, fixtureState())
  const page = loginPageStateCreate({
    adapter: loginDemoAdapterCreate({ fixtureState, onResume: () => navigate(`${loginDemoBasePath}/signed-in`) }),
    basePath: loginDemoBasePath,
    defaultPreference: () => demoLoginPasswordPreference,
    initialEmailOtpNotice: () =>
      fixtureState() !== "error" && resolved()?.screen === "email-otp-code"
        ? messageTranslate("login.emailOtp.resent")
        : undefined,
    initialErrorMessage: () =>
      fixtureState() !== "error"
        ? undefined
        : resolved()?.screen === "password"
          ? messageTranslate("login.error.credentialsInvalid")
          : resolved()?.screen === "email-otp"
            ? "The email code could not be sent."
            : resolved()?.screen === "email-otp-code"
              ? "The email code is incorrect."
              : undefined,
    initialPasskeyStatus: () => (resolved()?.screen === "passkey" ? initialState.passkeyStatus : undefined),
    initialMfaSetupUnavailable: () => fixtureState() === "mfa-setup-unavailable",
    initialProviderId: () => {
      const providerId = resolved()?.providerId
      if (providerId !== undefined) return providerId
      if (resolved()?.screen !== "provider") return undefined
      return initialState.discovery?.providers[0]?.id
    },
    initialProviderSubroute: () => resolved()?.providerSubroute,
    initialDiscovery: () => initialState.discovery,
    initialStatus: () => initialState.status,
    navigate: (path) => navigate(`${path}${location.search}`),
    passwordChangeExpired: () => fixtureState() === "password-change-expired",
    recoveryRequestStep: () =>
      fixtureState() === "recovery-loading" ? "loading" : fixtureState() === "recovery-fatal" ? "fatal" : "email",
    recoveryResetInitialStep: () =>
      fixtureState() === "reset-loading" ? "loading" : fixtureState() === "reset-invalid" ? "invalid-link" : "ready",
    recoveryToken: () => "demo-recovery-token-abcdefghijklmnopqrstuvwxyz",
    screen: () => resolved()?.screen ?? "unsupported",
    verificationToken: () => "demo-verification-token-abcdefghijklmnopqrstuvw",
  })

  return { fixtureState, page, path: () => location.pathname }
}
