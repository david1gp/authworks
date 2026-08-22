import { describe, expect, test } from "bun:test"
import { adminDemoAdapterCreate } from "../../src/features/admin/ui/adminDemoAdapterCreate.js"
import type { DemoFixtureState } from "../../src/features/demo/demoFixtureStateSchema.js"

const adapterFor = (fixtureState: DemoFixtureState) =>
  adminDemoAdapterCreate(() => fixtureState, { signedInInitially: true })

describe("admin demo adapter", () => {
  test("serves a deterministic realm and administrator session for the success state", async () => {
    const adapter = adapterFor("success")

    const realm = await adapter.realmGet()
    const session = await adapter.sessionCurrent()

    expect(realm.success && realm.data.realm.name).toBe("Northwind customer identity")
    expect(realm.success && realm.data.realm.status).toBe("active")
    expect(session.success && session.data.subjectType).toBe("bootstrap_admin")
  })

  test("applies settings and lifecycle mutations to its local fixture", async () => {
    const adapter = adapterFor("success")

    const renamed = await adapter.realmUpdate({ domains: ["one.example", "two.example"], name: "Renamed realm" })
    const disabled = await adapter.realmUpdate({ status: "disabled" })

    expect(renamed.success && renamed.data.realm.domain).toBe("one.example")
    expect(renamed.success && renamed.data.realm.name).toBe("Renamed realm")
    expect(disabled.success && disabled.data.realm.status).toBe("disabled")
    expect(disabled.success && disabled.data.realm.name).toBe("Renamed realm")
  })

  test("starts the sign-in screen without an administrator session", async () => {
    const adapter = adminDemoAdapterCreate(() => "success")

    expect((await adapter.sessionCurrent()).success).toBe(false)
    expect((await adapter.adminSignIn("c".repeat(40))).success).toBe(true)
    expect((await adapter.sessionCurrent()).success).toBe(true)
  })

  test("rejects short bootstrap credentials and accepts complete ones", async () => {
    const adapter = adapterFor("success")

    expect((await adapter.adminSignIn("too-short")).success).toBe(false)
    expect((await adapter.adminSignIn("b".repeat(40))).success).toBe(true)
  })

  test("exposes error, expiry, and permission fixture states", async () => {
    const failing = await adapterFor("error").realmGet()
    const expired = await adapterFor("expired").sessionCurrent()
    const denied = await adapterFor("permission-denied").realmUpdate({ name: "Nope" })
    const readable = await adapterFor("permission-denied").realmGet()

    expect(failing.success).toBe(false)
    expect(!expired.success && expired.code).toBe("sessions.unauthorized")
    expect(!denied.success && denied.code).toBe("realms.forbidden")
    expect(readable.success).toBe(true)
  })

  test("ends an administrator session without any network access", async () => {
    const result = await adapterFor("success").adminSignOut()

    expect(result.success && result.data.revoked).toBe(true)
  })

  test("serves safe user-security metadata and revokes a fixture session", async () => {
    const adapter = adapterFor("success")

    const methods = await adapter.userAuthenticationMethodsGet("01900000-0000-7000-8000-000000000021")
    const sessions = await adapter.userSessionsList("01900000-0000-7000-8000-000000000021")

    expect(methods.success && methods.data.passkeys.credentials).toHaveLength(1)
    expect(methods.success && JSON.stringify(methods.data)).not.toMatch(/secret|privateKey|recoveryCodes.*codes/i)
    expect(sessions.success && sessions.data.items.map((session) => session.device.description)).toEqual([
      "Firefox on Linux",
      "Safari on iPhone",
    ])

    const sessionId = sessions.success ? sessions.data.items[0]?.id : undefined
    expect(sessionId).toBeDefined()
    if (sessionId === undefined) return
    expect((await adapter.userSessionRevoke("01900000-0000-7000-8000-000000000021", sessionId)).success).toBe(true)
    const remaining = await adapter.userSessionsList("01900000-0000-7000-8000-000000000021")
    expect(remaining.success && remaining.data.items.some((session) => session.id === sessionId)).toBe(false)
  })

  test("provides empty user-security fixtures", async () => {
    const adapter = adapterFor("empty")

    const methods = await adapter.userAuthenticationMethodsGet("user")
    const sessions = await adapter.userSessionsList("user")

    expect(methods.success && methods.data.passkeys.credentials).toEqual([])
    expect(methods.success && methods.data.totp.enrolled).toBe(false)
    expect(sessions.success && sessions.data.items).toEqual([])
  })
})
