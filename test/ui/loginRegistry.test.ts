import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { demoLoginScenarioGroups } from "../../src/features/demo/demoLoginScenarioGroups.js"
import { demoLoginScenarioSchema } from "../../src/features/demo/demoLoginScenarioSchema.js"
import { externalIdentityLoginStatusSchema } from "../../src/features/externalIdentities/public/externalIdentityLoginStatusSchema.js"
import { loginPathResolve } from "../../src/features/login/model/loginPathResolve.js"
import { loginScreenPathGet } from "../../src/features/login/model/loginScreenPathGet.js"
import { loginScreenSchema } from "../../src/features/login/model/loginScreenSchema.js"
import { loginDemoInitialStateResolve } from "../../src/features/login/ui/loginDemoInitialStateResolve.js"
import { loginDemoStates } from "../../src/features/login/ui/loginDemoStates.js"
import { loginViewStatusSchema } from "../../src/features/login/ui/loginViewStatusSchema.js"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"

const scenarios = demoLoginScenarioGroups.flatMap((group) => group.scenarios)

describe("login demo registry parity", () => {
  test("every registered destination is a stable, resolvable login route", () => {
    const paths = new Set<string>()
    for (const scenario of scenarios) {
      expect(v.safeParse(demoLoginScenarioSchema, scenario.path).success).toBe(true)
      expect(scenario.availability).toBe("available")
      expect(paths.has(scenario.path), scenario.path).toBe(false)
      paths.add(scenario.path)

      const resolution = loginPathResolve(scenario.path, "/demo/login")
      expect(resolution, scenario.path).toBeDefined()
      expect(
        resolution === undefined ? false : loginScreenSchema.options.includes(resolution.screen),
        scenario.path,
      ).toBe(true)
    }
  })

  test("every supported screen and provider outcome has a registry destination", () => {
    for (const screen of loginScreenSchema.options) {
      const path = loginScreenPathGet(screen, "/demo/login")
      expect(
        scenarios.some((scenario) => loginPathResolve(scenario.path, "/demo/login")?.screen === screen),
        screen,
      ).toBe(true)
      expect(loginPathResolve(path, "/demo/login")?.screen).toBe(screen)
    }

    for (const subroute of ["failure", "account-not-found", "linking-failed", "registration-failed"] as const) {
      expect(
        scenarios.some((scenario) => loginPathResolve(scenario.path, "/demo/login")?.providerSubroute === subroute),
        subroute,
      ).toBe(true)
    }

    for (const status of externalIdentityLoginStatusSchema.options) {
      const route = status === "ready" || status === "pending" ? "/demo/login/idp" : `/demo/login/idp/${status}`
      expect(loginPathResolve(route, "/demo/login"), status).toBeDefined()
    }
  })

  test("every selector state is represented by an available login scenario", () => {
    const usedStates = new Set(scenarios.flatMap((scenario) => scenario.states))
    for (const state of loginDemoStates) expect(usedStates.has(state), state).toBe(true)
  })

  test("lifecycle statuses resolve to their intended demo entry behavior", () => {
    expect(v.safeParse(loginViewStatusSchema, "loading").success).toBe(true)
    expect(v.safeParse(loginViewStatusSchema, "continuing").success).toBe(true)
    expect(v.safeParse(loginViewStatusSchema, "fatal").success).toBe(true)
    expect(v.safeParse(loginViewStatusSchema, "unavailable").success).toBe(true)
    expect(v.safeParse(loginViewStatusSchema, "verified").success).toBe(true)

    expect(loginDemoInitialStateResolve("chooser", "success").status).toBe("ready")
    expect(loginDemoInitialStateResolve("loading", "loading")).toEqual({
      discovery: undefined,
      status: undefined,
    })
    expect(loginDemoInitialStateResolve("loading", "continuing").status).toBe("continuing")
    expect(loginDemoInitialStateResolve("loading", "fatal")).toEqual({
      discovery: undefined,
      status: undefined,
    })
    expect(loginPathResolve("/demo/login/unsupported", "/demo/login")?.screen).toBe("unsupported")
  })

  test("all registry labels have English catalog source text", () => {
    const englishValues = new Set(Object.values(englishCatalog))
    for (const scenario of scenarios) {
      expect(englishValues.has(scenario.title), `${scenario.path} title`).toBe(true)
      expect(englishValues.has(scenario.description), `${scenario.path} description`).toBe(true)
      expect(scenario.title.includes("{"), `${scenario.path} title placeholder`).toBe(false)
      expect(scenario.description.includes("{"), `${scenario.path} description placeholder`).toBe(false)
    }
  })
})
