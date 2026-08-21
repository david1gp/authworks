import { useLocation } from "@solidjs/router"
import { demoAdminImpersonationNow } from "../../demo/demoAdminImpersonationNow.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { impersonationAdminDemoAdapterCreate } from "./impersonationAdminDemoAdapterCreate.js"
import { impersonationAdminPageStateCreate } from "./impersonationAdminPageStateCreate.js"

export function impersonationAdminDemoStateCreate() {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])

  const page = impersonationAdminPageStateCreate({
    adapter: impersonationAdminDemoAdapterCreate(fixtureState),
    // Demo destinations stay network-free and non-blocking, so confirmations auto-accept.
    confirm: () => true,
    // The ended state is reachable straight from a URL, so it seeds its confirmation.
    endedSeed: () => fixtureState() === "ended",
    now: () => demoAdminImpersonationNow,
    reloadKey: fixtureState,
  })

  return {
    ...page,
    fixtureState,
    scenario,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: state,
        selected: state === fixtureState(),
      })),
  }
}
