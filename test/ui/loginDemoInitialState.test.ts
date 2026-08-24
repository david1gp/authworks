import { describe, expect, test } from "bun:test"
import { demoLoginBootstrap } from "../../src/features/demo/demoLoginBootstrap.js"
import { loginDemoInitialStateResolve } from "../../src/features/login/ui/loginDemoInitialStateResolve.js"

describe("login demo initial state", () => {
  test("keeps direct terminal routes renderable with the bootstrap discovery", () => {
    for (const screen of ["recovery-sent", "register-done"] as const) {
      expect(loginDemoInitialStateResolve(screen, "success")).toEqual({
        discovery: demoLoginBootstrap,
        status: "ready",
      })
    }
  })

  test("does not turn lifecycle fixtures into a ready state without discovery", () => {
    expect(loginDemoInitialStateResolve("recovery-sent", "loading")).toEqual({
      discovery: undefined,
      status: undefined,
    })
    expect(loginDemoInitialStateResolve("loading", "success")).toEqual({
      discovery: undefined,
      status: undefined,
    })
    expect(loginDemoInitialStateResolve("register-done", "continuing")).toEqual({
      discovery: undefined,
      status: "continuing",
    })
  })

  test("initializes each direct passkey variant with its intended status", () => {
    expect(loginDemoInitialStateResolve("passkey", "passkey-unsupported")).toMatchObject({
      discovery: demoLoginBootstrap,
      passkeyStatus: "unsupported",
      status: "ready",
    })
    expect(loginDemoInitialStateResolve("passkey", "passkey-permission-denied")).toMatchObject({
      passkeyStatus: "permission-denied",
    })
    expect(loginDemoInitialStateResolve("passkey", "passkey-ceremony-failure")).toMatchObject({
      passkeyStatus: "ceremony-failure",
    })
    expect(loginDemoInitialStateResolve("passkey", "passkey-pending")).toMatchObject({
      passkeyStatus: "pending",
    })
  })

  test("keeps provider demo aliases on the configured discovery provider", () => {
    const initial = loginDemoInitialStateResolve("provider", "success")

    expect(initial.discovery?.providers).toHaveLength(1)
    expect(initial.discovery?.providers[0]?.id).toBe("provider-google")
    expect(initial.status).toBe("ready")
  })
})
