import { useLocation } from "@solidjs/router"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoAdminScenarioMessageKeyGet } from "../../demo/public/demoAdminScenarioMessageKeyGet.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { projectAdminDemoAdapterCreate } from "./projectAdminDemoAdapterCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"
import { projectAdminScreenStateCreate } from "./projectAdminScreenStateCreate.js"

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
    projectId: options.projectId,
    screen: options.screen,
  })

  // The demo header is translated through the scenario catalog rather than the fixture group metadata.
  const scenarioMessage = (kind: "description" | "title") => {
    const key = scenario()?.key
    return key === undefined ? undefined : demoAdminScenarioMessageKeyGet(key, kind)
  }

  return {
    ...screenState,
    fixtureState,
    scenarioDescription: () => {
      const key = scenarioMessage("description")
      return key === undefined ? messageTranslate("demo.admin.eyebrow") : messageTranslate(key)
    },
    scenarioTitle: () => {
      const key = scenarioMessage("title")
      return key === undefined ? messageTranslate("admin.projects.list.title") : messageTranslate(key)
    },
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((state) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, state),
        label: demoFixtureStateLabel(state),
        selected: state === fixtureState(),
      })),
  }
}
