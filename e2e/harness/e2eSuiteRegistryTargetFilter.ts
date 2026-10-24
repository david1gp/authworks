import type { E2eSuite } from "./e2eSuiteRegistryList.js"
import type { E2eTarget } from "./e2eTargetSchema.js"

export function e2eSuiteRegistryTargetFilter(suites: readonly E2eSuite[], target: E2eTarget): E2eSuite[] {
  return suites.filter((suite) => suite.targets.includes(target))
}
