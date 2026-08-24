import { describe, expect, test } from "bun:test"
import { loginPathResolve } from "./loginPathResolve.js"
import { loginProviderPathGet } from "./loginProviderPathGet.js"
import { loginScreenPathGet } from "./loginScreenPathGet.js"
import { loginScreenSchema } from "./loginScreenSchema.js"

describe("hosted login path resolution", () => {
  test("resolves the base path and every named screen under both base paths", () => {
    expect(loginPathResolve("/login", "/login")).toEqual({ screen: "chooser" })
    expect(loginPathResolve("/demo/login", "/demo/login")).toEqual({ screen: "chooser" })
    expect(loginPathResolve("/demo/login/chooser/recent-accounts", "/demo/login")).toEqual({
      screen: "recent-accounts",
    })
    expect(loginPathResolve("/login/chooser/recent-accounts", "/login")).toEqual({ screen: "recent-accounts" })
    expect(loginPathResolve("/login/password", "/login")).toEqual({ screen: "password" })
    expect(loginPathResolve("/demo/login/mfa/recovery-code", "/demo/login")).toEqual({ screen: "mfa-recovery-code" })
    expect(loginPathResolve("/demo/login/mfa/passkey", "/demo/login")).toEqual({ screen: "mfa-passkey" })
    expect(loginPathResolve("/demo/login/mfa/email-otp/code", "/demo/login")).toEqual({
      screen: "mfa-email-otp-code",
    })
  })

  test("requires an exact base path or a child path boundary", () => {
    for (const basePath of ["/login", "/demo/login"]) {
      expect(loginPathResolve(basePath, basePath)).toEqual({ screen: "chooser" })
      expect(loginPathResolve(`${basePath}/password`, basePath)).toEqual({ screen: "password" })
      expect(loginPathResolve(`${basePath}-elevated`, basePath)).toBeUndefined()
      expect(loginPathResolve(`${basePath}-elevated/password`, basePath)).toBeUndefined()
    }
  })

  test("legacy outcome paths resolve to a screen plus the fixture state they encoded", () => {
    expect(loginPathResolve("/demo/login/password/error", "/demo/login")).toEqual({
      screen: "password",
      state: "error",
    })
    expect(loginPathResolve("/demo/login/passkey/unsupported", "/demo/login")).toEqual({
      screen: "passkey",
      state: "passkey-unsupported",
    })
    expect(loginPathResolve("/demo/login/idp/failure", "/demo/login")).toEqual({
      providerSubroute: "failure",
      screen: "provider",
      state: "error",
    })
    expect(loginPathResolve("/demo/login/idp/account-not-found", "/demo/login")).toEqual({
      providerSubroute: "account-not-found",
      screen: "provider",
    })
    expect(loginPathResolve("/demo/login/idp/linking-failed", "/demo/login")).toEqual({
      providerSubroute: "linking-failed",
      screen: "provider",
    })
    expect(loginPathResolve("/demo/login/idp/registration-failed", "/demo/login")).toEqual({
      providerSubroute: "registration-failed",
      screen: "provider",
    })
    expect(loginPathResolve("/login/idp/provider-runtime/failure", "/login")).toEqual({
      providerId: "provider-runtime",
      providerSubroute: "failure",
      screen: "provider",
      state: "error",
    })
    expect(loginPathResolve("/demo/login/continuing", "/demo/login")).toEqual({
      screen: "loading",
      state: "continuing",
    })
    expect(loginPathResolve("/demo/login/fatal", "/demo/login")).toEqual({ screen: "loading", state: "fatal" })
    expect(loginPathResolve("/demo/login/passkey/permission-denied", "/demo/login")).toEqual({
      screen: "passkey",
      state: "passkey-permission-denied",
    })
    expect(loginPathResolve("/demo/login/passkey/ceremony-failure", "/demo/login")).toEqual({
      screen: "passkey",
      state: "passkey-ceremony-failure",
    })
    expect(loginPathResolve("/demo/login/passkey/pending", "/demo/login")).toEqual({
      screen: "passkey",
      state: "passkey-pending",
    })
    expect(loginPathResolve("/demo/login/password/change-required/expired", "/demo/login")).toEqual({
      screen: "password-change-required",
      state: "password-change-expired",
    })
    expect(loginPathResolve("/demo/login/password/forgot/unavailable", "/demo/login")).toEqual({
      screen: "recovery-request",
      state: "recovery-fatal",
    })
    expect(loginPathResolve("/demo/login/password/reset/invalid", "/demo/login")).toEqual({
      screen: "recovery-reset",
      state: "reset-invalid",
    })
  })

  test("keeps recovery request, loading, and sent URLs on their dedicated screens", () => {
    expect(loginPathResolve("/demo/login/password/forgot", "/demo/login")).toEqual({
      screen: "recovery-request",
    })
    expect(loginPathResolve("/demo/login/password/forgot/loading", "/demo/login")).toEqual({
      screen: "recovery-request",
      state: "recovery-loading",
    })
    expect(loginPathResolve("/demo/login/password/forgot/sent", "/demo/login")).toEqual({
      screen: "recovery-sent",
    })
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

  test("keeps chooser returns inside the active login namespace", () => {
    expect(loginScreenPathGet("chooser", "/login")).toBe("/login/chooser")
    expect(loginScreenPathGet("chooser", "/demo/login")).toBe("/demo/login/chooser")
    expect(loginPathResolve("/demo/login/chooser", "/demo/login")).toEqual({ screen: "chooser" })
  })

  test("builds and resolves provider-specific paths from discovered identifiers", () => {
    const path = loginProviderPathGet("provider/runtime", "/demo/login")
    expect(path).toBe("/demo/login/idp/provider%2Fruntime")
    expect(loginPathResolve(path, "/demo/login")).toEqual({
      providerId: "provider/runtime",
      screen: "provider",
    })
  })

  test("keeps provider outcome routes discovery-driven while rejecting unsafe identifiers", () => {
    for (const outcome of ["failure", "account-not-found", "linking-failed", "registration-failed"] as const) {
      expect(loginPathResolve(`/demo/login/idp/provider%2Fruntime/${outcome}`, "/demo/login")).toEqual({
        providerId: "provider/runtime",
        providerSubroute: outcome,
        ...(outcome === "failure" ? { state: "error" as const } : {}),
        screen: "provider",
      })
    }
    expect(loginPathResolve("/demo/login/idp/%E0%A4%A/failure", "/demo/login")).toBeUndefined()
    expect(loginPathResolve("/demo/login/idp//failure", "/demo/login")).toBeUndefined()
  })

  test("trailing slashes resolve to the same screen", () => {
    expect(loginPathResolve("/login/password/", "/login")).toEqual({ screen: "password" })
    expect(loginPathResolve("/login/", "/login")).toEqual({ screen: "chooser" })
  })
})
