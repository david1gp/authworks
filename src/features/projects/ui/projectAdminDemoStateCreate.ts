import { useLocation } from "@solidjs/router"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { projectAdminDemoAdapterCreate } from "./projectAdminDemoAdapterCreate.js"
import { projectAdminScreenStateCreate } from "./projectAdminScreenStateCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"

export function projectAdminDemoStateCreate(options: {
  readonly projectId: () => string | undefined
  readonly screen: () => ProjectAdminScreen
}) {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])

  const screenState = projectAdminScreenStateCreate({
    adapter: projectAdminDemoAdapterCreate(fixtureState),
    basePath: "/demo/admin",
    // Demo destinations stay network-free and non-blocking, so confirmations auto-accept.
    confirm: () => true,
    projectId: options.projectId,
    screen: options.screen,
  })

  return {
    ...screenState,
    fixtureState,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: state,
        selected: state === fixtureState(),
      })),
  }
}
