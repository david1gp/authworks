import { useLocation } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { demoAdminImpersonationNow } from "../../demo/demoAdminImpersonationNow.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { impersonationAdminDemoAdapterCreate } from "./impersonationAdminDemoAdapterCreate.js"
import { impersonationAdminPageStateCreate } from "./impersonationAdminPageStateCreate.js"

export function impersonationAdminDemoStateCreate() {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])

  const confirmState = confirmStateCreate()
  const page = impersonationAdminPageStateCreate({
    adapter: impersonationAdminDemoAdapterCreate(fixtureState),
    // Destructive impersonation changes are answered by the visible, cancelable dialog.
    confirm: confirmState.confirm,
    // The ended state is reachable straight from a URL, so it seeds its confirmation.
    endedSeed: () => fixtureState() === "ended",
    now: () => demoAdminImpersonationNow,
    reloadKey: fixtureState,
  })

  return {
    ...page,
    confirmState,
    fixtureState,
    scenario,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: demoFixtureStateLabel(state),
        selected: state === fixtureState(),
      })),
  }
}
