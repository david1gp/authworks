import { describe, expect, test } from "bun:test"
import type { DemoFixtureState } from "../../src/features/demo/demoFixtureStateSchema.js"
import { loginDemoAdapterCreate } from "../../src/features/login/ui/loginDemoAdapterCreate.js"

const adapterCreate = (state: DemoFixtureState, onResume = () => undefined) =>
  loginDemoAdapterCreate({ fixtureState: () => state, onResume })

describe("deterministic login demo adapter", () => {
  test("the success fixture authenticates every primary method without a network request", async () => {
    const adapter = adapterCreate("success")

    for (const outcome of [
      await adapter.passwordLogin("alex@acme.example", "demo-password"),
      await adapter.emailOtpVerify("demo-email-challenge", "123456"),
      await adapter.passkeyAuthenticate(),
    ]) {
      expect(outcome.success).toBe(true)
      if (!outcome.success) continue
      expect(outcome.data.userId).toBe("demo-user")
      expect(outcome.data.challenge).toBeUndefined()
    }
  })

  test("the expired fixture returns a second-factor challenge instead of completing sign-in", async () => {
    const outcome = await adapterCreate("expired").passwordLogin("alex@acme.example", "demo-password")

    expect(outcome.success).toBe(true)
    if (!outcome.success) return
    expect(outcome.data.challenge?.challenge.requiredAssurance).toBe("multi_factor")
    expect(outcome.data.challenge?.token.length).toBeGreaterThanOrEqual(43)
  })

  test("the error fixture fails every submission with a safe, non-disclosing message", async () => {
    const adapter = adapterCreate("error")

    for (const result of [
      await adapter.passwordLogin("alex@acme.example", "wrong"),
      await adapter.emailOtpVerify("demo-email-challenge", "000000"),
      await adapter.mfaComplete("t".repeat(43), "000000"),
      await adapter.register({
        displayName: "Alex",
        email: "alex@acme.example",
        password: "demo-password",
        userName: "alex",
      }),
      await adapter.recoveryRequest("alex@acme.example"),
      await adapter.verifyEmail("token"),
      await adapter.logout(),
    ]) {
      expect(result.success).toBe(false)
      if (result.success) continue
      expect(result.errorMessage).not.toContain("demo-user")
      expect(result.errorMessage.length).toBeGreaterThan(0)
    }
  })

  test("realm discovery stays available so form errors render in place", async () => {
    const discovered = await adapterCreate("error").discover()

    expect(discovered.success).toBe(true)
    if (!discovered.success) return
    expect(discovered.data.organization.realmId).toBe("realm-acme")
    expect(discovered.data.policy.allowPassword).toBe(true)
  })

  test("the empty fixture returns no recent accounts and success returns remembered ones", async () => {
    const empty = await adapterCreate("empty").recentAccounts()
    const success = await adapterCreate("success").recentAccounts()

    expect(empty.success && empty.data).toEqual([])
    expect(success.success && success.data.length).toBe(2)
  })

  test("the loading fixture never settles discovery so the loading state stays visible", async () => {
    const settled = await Promise.race([
      adapterCreate("loading")
        .discover()
        .then(() => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 25)),
    ])

    expect(settled).toBe("pending")
  })

  test("passkey support reflects the fixture and the provider start never leaves the demo", async () => {
    expect(adapterCreate("permission-denied").passkeySupported()).toBe(false)
    expect(adapterCreate("success").passkeySupported()).toBe(true)

    const started = await adapterCreate("success").providerStart("provider-google")
    expect(started.success && started.data.authorizationUrl).toBe("https://accounts.example/authorize?demo=1")
  })

  test("interaction resume is delegated to the caller rather than performed by the adapter", () => {
    let resumed = 0
    adapterCreate("success", () => {
      resumed += 1
    }).interactionResume()

    expect(resumed).toBe(1)
  })

  test("the authenticator enrollment fixture exposes its setup key exactly once per start", async () => {
    const started = await adapterCreate("success").mfaTotpEnrollStart()

    expect(started.success).toBe(true)
    if (!started.success) return
    expect(started.data.secret).toBe("JBSWY3DPEHPK3PXP")
    expect(started.data.enrollment.status).toBe("pending")
  })
})
