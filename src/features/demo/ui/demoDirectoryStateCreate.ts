import type { Accessor } from "solid-js"
import type { DemoFixtureScenarioGroup } from "../demoFixtureScenarioGroupSchema.js"

export function demoDirectoryStateCreate(groups: Accessor<readonly DemoFixtureScenarioGroup[]>) {
  return {
    availableCount: () =>
      groups()
        .flatMap((group) => group.scenarios)
        .filter((scenario) => scenario.availability === "available").length,
    plannedCount: () =>
      groups()
        .flatMap((group) => group.scenarios)
        .filter((scenario) => scenario.availability === "planned").length,
  }
}
