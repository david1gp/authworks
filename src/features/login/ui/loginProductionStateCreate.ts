import { useLocation, useNavigate } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { loginChallengeTokenSelect } from "../model/loginChallengeTokenSelect.js"
import { loginInteractionHandleSelect } from "../model/loginInteractionHandleSelect.js"
import { loginPathResolve } from "../model/loginPathResolve.js"
import { loginPostAuthDestinationResolve } from "../model/loginPostAuthDestinationResolve.js"
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
  const explicitReturn = () => search().get("return_to")
  const hasExplicitReturn = () => {
    const candidate = explicitReturn()
    return candidate !== null && candidate.length > 0
  }
  // After the session cookie exists, resolve the role-aware landing page. Explicit
  // `return_to` always wins, so this lookup only runs when no explicit target was given.
  // The lookup starts lazily on first post-auth navigation (not on page load, where no
  // session exists yet) and stays cached per login page so the session cookie is read
  // only after sign-in.
  const defaultDestinationPending = createSignalObject(false)
  const defaultDestinationLoaded = createSignalObject(false)
  const defaultDestination = createSignalObject("/account")
  const defaultDestinationLoad = () => {
    if (hasExplicitReturn() || defaultDestinationPending.get() || defaultDestinationLoaded.get()) return
    const realmId = discovery.get()?.organization.realmId
    if (realmId === undefined) return
    defaultDestinationPending.set(true)
    void loginPostAuthDestinationResolve({
      api,
      organizationId: discovery.get()?.organization.id,
      realmId,
    }).then((resolved) => {
      if (resolved !== undefined) defaultDestination.set(resolved)
      defaultDestinationLoaded.set(true)
      defaultDestinationPending.set(false)
    })
  }
  const returnPathAsync = async () => {
    // Kick off the role lookup now (post-auth the session cookie exists) and wait for it;
    // slow or failed lookups keep the safe `/account` default instead of blocking sign-in.
    defaultDestinationLoad()
    if (!defaultDestinationLoaded.get() && !hasExplicitReturn()) {
      const realmId = discovery.get()?.organization.realmId
      if (realmId !== undefined) {
        const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1_500))
        const resolved = await Promise.race([
          loginPostAuthDestinationResolve({
            api,
            organizationId: discovery.get()?.organization.id,
            realmId,
          }),
          timeout,
        ])
        if (resolved !== undefined) {
          defaultDestination.set(resolved)
          defaultDestinationLoaded.set(true)
          defaultDestinationPending.set(false)
        }
      }
    }
    return hasExplicitReturn() ? loginReturnPathSelect(explicitReturn(), "/account") : defaultDestination.get()
  }

  const adapter = loginProductionAdapterCreate({
    api,
    discovery: discovery.get,
    discoverySet: discovery.set,
    domain: window.location.hostname,
    interactionHandle,
    interactionResume: () => {
      const handle = interactionHandle()
      if (handle === undefined) {
        void returnPathAsync().then((destination) => window.location.assign(destination))
        return
      }
      void returnPathAsync().then((destination) =>
        window.location.assign(
          `/oauth2/authorize?interaction=${encodeURIComponent(handle)}&return_to=${encodeURIComponent(destination)}`,
        ),
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
