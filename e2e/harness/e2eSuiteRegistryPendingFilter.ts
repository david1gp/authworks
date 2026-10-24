import type { E2eSuite } from "./e2eSuiteRegistryList.js"

export function e2eSuiteRegistryPendingFilter(
  suites: readonly E2eSuite[],
  completedSuites: readonly string[],
): E2eSuite[] {
  const completed = new Set(completedSuites)
  return suites.filter((suite) => !completed.has(suite.name))
}
