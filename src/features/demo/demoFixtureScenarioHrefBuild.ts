import type { DemoFixtureState } from "./demoFixtureStateSchema.js"

export function demoFixtureScenarioHrefBuild(path: string, state: DemoFixtureState): string {
  const search = new URLSearchParams({ state })
  return `${path}?${search.toString()}`
}
