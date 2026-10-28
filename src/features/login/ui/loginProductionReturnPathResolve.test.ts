import { describe, expect, test } from "bun:test"
import { loginProductionReturnPathResolve } from "./loginProductionReturnPathResolve.js"

describe("loginProductionReturnPathResolve", () => {
  test("preserves safe explicit destinations and rejects external ones without looking up roles", async () => {
    let calls = 0
    const destinationResolve = async () => {
      calls += 1
      return "/admin/users"
    }
    expect(
      await loginProductionReturnPathResolve({ destinationResolve, returnTo: "/account?tab=security#details" }),
    ).toBe("/account?tab=security#details")
    expect(await loginProductionReturnPathResolve({ destinationResolve, returnTo: "//evil.example" })).toBe("/account")
    expect(calls).toBe(0)
  })

  test("uses role-aware destinations and falls back on failure", async () => {
    for (const destination of ["/admin/users", "/account", undefined]) {
      expect(
        await loginProductionReturnPathResolve({ destinationResolve: async () => destination, returnTo: null }),
      ).toBe(destination ?? "/account")
    }
  })

  test("a timed-out lookup falls back without preventing a later attempt", async () => {
    let calls = 0
    const destinationResolve = () => {
      calls += 1
      return calls === 1 ? new Promise<string | undefined>(() => {}) : Promise.resolve("/admin/users")
    }
    expect(await loginProductionReturnPathResolve({ destinationResolve, returnTo: null, timeoutMs: 1 })).toBe(
      "/account",
    )
    expect(await loginProductionReturnPathResolve({ destinationResolve, returnTo: null, timeoutMs: 1 })).toBe(
      "/admin/users",
    )
    expect(calls).toBe(2)
  })
})
