import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { demoLoginScenarioSchema } from "./demoLoginScenarioSchema.js"

describe("demoLoginScenarioSchema", () => {
  test("accepts login directory and scenario paths only", () => {
    expect(v.safeParse(demoLoginScenarioSchema, "/demo/login").success).toBe(true)
    expect(v.safeParse(demoLoginScenarioSchema, "/demo/login/password/error").success).toBe(true)
    expect(v.safeParse(demoLoginScenarioSchema, "/demo/password").success).toBe(false)
  })
})
