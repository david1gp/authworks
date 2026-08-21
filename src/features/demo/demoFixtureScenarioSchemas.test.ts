import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { demoFixtureScenarioGroupSchema } from "./demoFixtureScenarioGroupSchema.js"
import { demoFixtureScenarioHrefBuild } from "./demoFixtureScenarioHrefBuild.js"
import { demoFixtureStateSelect } from "./demoFixtureStateSelect.js"

describe("demo fixture scenario conventions", () => {
  test("validate a grouped, network-free page scenario", () => {
    const result = v.safeParse(demoFixtureScenarioGroupSchema, {
      description: "Account security fixtures",
      key: "security",
      scenarios: [
        {
          availability: "planned",
          description: "Review signed-in devices.",
          key: "sessions",
          path: "/demo/account/sessions",
          states: ["success", "empty", "loading", "error"],
          title: "Sessions",
        },
      ],
      title: "Security",
    })

    expect(result.success).toBe(true)
  })

  test("selects only states supported by the scenario", () => {
    expect(demoFixtureStateSelect("?state=loading", ["success", "loading"])).toBe("loading")
    expect(demoFixtureStateSelect("?state=empty", ["success", "loading"])).toBe("success")
    expect(demoFixtureStateSelect("?state=unknown", ["error"])).toBe("error")
  })

  test("builds shareable state URLs", () => {
    expect(demoFixtureScenarioHrefBuild("/demo/account/sessions", "empty")).toBe("/demo/account/sessions?state=empty")
  })
})
