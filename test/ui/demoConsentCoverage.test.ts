import { describe, expect, test } from "bun:test"
import { demoConsentScenarioGroups } from "../../src/features/demo/demoConsentScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../src/features/demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../src/features/demo/demoFixtureStateSelect.js"

describe("standalone consent demo coverage", () => {
  test("exposes the production consent interaction as a URL-selectable fixture scenario", () => {
    const scenario = demoFixtureScenarioSelect("/demo/consent", demoConsentScenarioGroups)

    expect(scenario).toMatchObject({
      availability: "available",
      key: "consent",
      path: "/demo/consent",
      states: ["success", "loading", "error", "expired"],
    })
  })

  test("falls back to the successful consent fixture for unsupported state URLs", () => {
    const scenario = demoFixtureScenarioSelect("/demo/consent", demoConsentScenarioGroups)

    expect(demoFixtureStateSelect("?state=unknown", scenario?.states ?? [])).toBe("success")
    expect(demoFixtureStateSelect("?state=expired", scenario?.states ?? [])).toBe("expired")
  })
})
