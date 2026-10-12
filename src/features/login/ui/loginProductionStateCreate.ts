import { useLocation, useNavigate } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { loginChallengeTokenSelect } from "../model/loginChallengeTokenSelect.js"
import { loginInteractionHandleSelect } from "../model/loginInteractionHandleSelect.js"
import { loginPathResolve } from "../model/loginPathResolve.js"
import { loginReturnPathSelect } from "../model/loginReturnPathSelect.js"
import type { LoginDiscovery } from "./loginAdapter.js"
import { loginApiCreate } from "./loginApiCreate.js"
import { loginPageStateCreate } from "./loginPageStateCreate.js"
import { loginProductionAdapterCreate } from "./loginProductionAdapterCreate.js"

const loginBasePath = "/login"

/** Wires the hosted login to real browser APIs, runtime realm discovery, and interaction resume. */
export function loginProductionStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const discovery = createSignalObject<LoginDiscovery | undefined>(undefined)
  const api = loginApiCreate({ baseUrl: window.location.origin })
  const search = () => new URLSearchParams(location.search)
  const interactionHandle = () => loginInteractionHandleSelect(search().get("interaction"))
  const mfaChallengeToken = () => loginChallengeTokenSelect(search().get("mfa_challenge"))
  const returnPath = () => loginReturnPathSelect(search().get("return_to"), "/account")

  const adapter = loginProductionAdapterCreate({
    api,
    discovery: discovery.get,
    discoverySet: discovery.set,
    domain: window.location.host,
    interactionHandle,
    interactionResume: () => {
      const handle = interactionHandle()
      if (handle === undefined) {
        window.location.assign(returnPath())
        return
      }
      window.location.assign(
        `/oauth2/authorize?interaction=${encodeURIComponent(handle)}&return_to=${encodeURIComponent(returnPath())}`,
      )
    },
  })

  const page = loginPageStateCreate({
    adapter,
    basePath: loginBasePath,
    clearToken: () => {
      const next = new URL(window.location.href)
      next.searchParams.delete("token")
      window.history.replaceState(window.history.state, "", `${next.pathname}${next.search}${next.hash}`)
    },
    navigate: (path) => navigate(`${path}${window.location.search}`),
    initialMfaChallengeToken: mfaChallengeToken,
    initialProviderId: () => loginPathResolve(location.pathname, loginBasePath)?.providerId,
    initialProviderSubroute: () => loginPathResolve(location.pathname, loginBasePath)?.providerSubroute,
    initialMfaSetupUnavailable: () =>
      loginPathResolve(location.pathname, loginBasePath)?.state === "mfa-setup-unavailable",
    recoveryResetInitialStep: () => ((search().get("token") ?? "").length === 0 ? "invalid-link" : "ready"),
    recoveryToken: () => search().get("token") ?? "",
    screen: () => loginPathResolve(location.pathname, loginBasePath)?.screen ?? "unsupported",
    verificationToken: () => search().get("token") ?? "",
  })
  const seededChallengeToken = mfaChallengeToken()
  if (seededChallengeToken !== undefined) adapter.mfaChallengeTokenSet?.(seededChallengeToken)
  if (search().get("mfa_challenge") !== null) {
    // The challenge token is seeded into page state above, so drop it from the URL immediately.
    // Keeping a bearer MFA token in history, logs, or later navigations would only widen exposure.
    const next = new URL(window.location.href)
    next.searchParams.delete("mfa_challenge")
    window.history.replaceState(window.history.state, "", `${next.pathname}${next.search}${next.hash}`)
  }
  return page
}
