import { useLocation, useNavigate } from "@solidjs/router"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { loginPathResolve } from "../model/loginPathResolve.js"
import { loginDemoAdapterCreate } from "./loginDemoAdapterCreate.js"
import { loginPageStateCreate } from "./loginPageStateCreate.js"

export const loginDemoBasePath = "/demo/login"

export const loginDemoStates: readonly DemoFixtureState[] = [
  "success",
  "error",
  "loading",
  "empty",
  "expired",
  "permission-denied",
]

/**
 * Fixture-backed login state. The fixture outcome comes from `?state=`, and legacy demo paths that
 * encoded an outcome in the URL still resolve to the same state without a query parameter.
 */
export function loginDemoStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const resolved = () => loginPathResolve(location.pathname, loginDemoBasePath)
  const fixtureState = () => resolved()?.state ?? demoFixtureStateSelect(location.search, loginDemoStates)
  const page = loginPageStateCreate({
    adapter: loginDemoAdapterCreate({ fixtureState, onResume: () => navigate(`${loginDemoBasePath}/signed-in`) }),
    basePath: loginDemoBasePath,
    navigate: (path) => navigate(`${path}${location.search}`),
    recoveryToken: () => "demo-recovery-token-abcdefghijklmnopqrstuvwxyz",
    screen: () => resolved()?.screen ?? "unsupported",
    verificationToken: () => "demo-verification-token-abcdefghijklmnopqrstuvw",
  })

  return { fixtureState, page, path: () => location.pathname }
}
