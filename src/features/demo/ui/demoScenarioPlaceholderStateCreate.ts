import { useLocation } from "@solidjs/router"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"
import { demoFixtureScenarioHrefBuild } from "../demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../demoFixtureStateSelect.js"

export function demoScenarioPlaceholderStateCreate(groups: () => readonly DemoFixtureScenarioGroup[]) {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, groups())
  const selectedState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])

  return {
    scenario,
    selectedState,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((fixtureState) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, fixtureState),
        label: fixtureState,
        selected: fixtureState === selectedState(),
      })),
  }
}
