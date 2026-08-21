import { useLocation, useNavigate } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
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

  return loginPageStateCreate({
    adapter,
    basePath: loginBasePath,
    navigate: (path) => navigate(`${path}${location.search}`),
    recoveryToken: () => search().get("token") ?? "",
    screen: () => loginPathResolve(location.pathname, loginBasePath)?.screen ?? "unsupported",
    verificationToken: () => search().get("token") ?? "",
  })
}
