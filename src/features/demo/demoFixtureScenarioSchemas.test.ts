import { describe, expect, mock, test } from "bun:test"
import * as v from "valibot"

mock.module("solid-js", () => ({
  createEffect: (compute: () => unknown, apply: (next: unknown) => unknown, options?: { defer?: boolean }) => {
    const next = compute()
    if (!options?.defer) apply(next)
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    const get = () => value
    const set = (next: T | ((previous: T) => T)) => {
      value = typeof next === "function" ? (next as (previous: T) => T)(value) : next
      return value
    }
    return [get, set] as const
  },
  untrack: <T>(read: () => T) => read(),
}))

const [
  { demoFixtureScenarioGroupSchema },
  { demoFixtureScenarioHrefBuild },
  { demoFixtureStateLabel },
  { demoFixtureStateSchema },
  { demoFixtureStateSelect },
] = await Promise.all([
  import("./demoFixtureScenarioGroupSchema.js"),
  import("./demoFixtureScenarioHrefBuild.js"),
  import("./demoFixtureStateLabel.js"),
  import("./demoFixtureStateSchema.js"),
  import("./demoFixtureStateSelect.js"),
])

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

  test("maps every exposed fixture state through typed labels", () => {
    for (const state of demoFixtureStateSchema.options) {
      const label = demoFixtureStateLabel(state)
      expect(label).toBeTruthy()
      expect(typeof label).toBe("string")
    }
    expect(demoFixtureStateLabel("permission-denied")).toBe("permission denied")
    expect(demoFixtureStateLabel("one-time")).toBe("one-time")
    expect(demoFixtureStateLabel("cross-tenant")).toBe("cross-tenant")
    expect(demoFixtureStateLabel("nested-rejected")).toBe("nested rejected")
    expect(demoFixtureStateLabel("assurance-required")).toBe("assurance required")
    expect(demoFixtureStateLabel("expiring")).toBe("expiring")
    expect(demoFixtureStateLabel("ended")).toBe("ended")
    expect(demoFixtureStateLabel("active")).toBe("active")
    expect(demoFixtureStateLabel("redacted")).toBe("redacted")
    expect(demoFixtureStateLabel("replayed")).toBe("replayed")
    expect(demoFixtureStateLabel("accepted")).toBe("accepted")
    expect(demoFixtureStateLabel("declined")).toBe("declined")
  })
})
