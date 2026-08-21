import type { DemoFixtureScenarioGroup } from "./demoFixtureScenarioGroupSchema.js"
import type { DemoFixtureScenario } from "./demoFixtureScenarioSchema.js"

export function demoFixtureScenarioSelect(
  pathname: string,
  groups: readonly DemoFixtureScenarioGroup[],
): DemoFixtureScenario | undefined {
  return groups.flatMap((group) => group.scenarios).find((scenario) => scenario.path === pathname)
}
