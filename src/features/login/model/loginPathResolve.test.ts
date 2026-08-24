import { describe, expect, test } from "bun:test"
import { loginPathResolve } from "./loginPathResolve.js"
import { loginScreenPathGet } from "./loginScreenPathGet.js"
import { loginScreenSchema } from "./loginScreenSchema.js"

describe("hosted login path resolution", () => {
  test("resolves the base path and every named screen under both base paths", () => {
    expect(loginPathResolve("/login", "/login")).toEqual({ screen: "chooser" })
    expect(loginPathResolve("/demo/login", "/demo/login")).toEqual({ screen: "chooser" })
    expect(loginPathResolve("/login/password", "/login")).toEqual({ screen: "password" })
    expect(loginPathResolve("/demo/login/mfa/recovery-code", "/demo/login")).toEqual({ screen: "mfa-recovery-code" })
  })

  test("legacy outcome paths resolve to a screen plus the fixture state they encoded", () => {
    expect(loginPathResolve("/demo/login/password/error", "/demo/login")).toEqual({
      screen: "password",
      state: "error",
    })
    expect(loginPathResolve("/demo/login/passkey/unsupported", "/demo/login")).toEqual({
      screen: "passkey",
      state: "permission-denied",
    })
    expect(loginPathResolve("/demo/login/idp/failure", "/demo/login")).toEqual({ screen: "provider", state: "error" })
  })

  test("unknown and foreign paths do not resolve", () => {
    expect(loginPathResolve("/login/does-not-exist", "/login")).toBeUndefined()
    expect(loginPathResolve("/account/profile", "/login")).toBeUndefined()
    expect(loginPathResolve("/login/../admin", "/login")).toBeUndefined()
  })

  test("every screen has a round-trippable path under each base path", () => {
    for (const screen of loginScreenSchema.options) {
      for (const basePath of ["/login", "/demo/login"]) {
        const path = loginScreenPathGet(screen, basePath)
        expect(path.startsWith(basePath)).toBe(true)
        expect(loginPathResolve(path, basePath)?.screen).toBe(screen)
      }
    }
  })

  test("trailing slashes resolve to the same screen", () => {
    expect(loginPathResolve("/login/password/", "/login")).toEqual({ screen: "password" })
    expect(loginPathResolve("/login/", "/login")).toEqual({ screen: "chooser" })
  })
})
