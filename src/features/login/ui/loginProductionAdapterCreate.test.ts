import { describe, expect, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { demoLoginBootstrap } from "../../demo/demoLoginBootstrap.js"
import type { LoginDiscovery } from "./loginAdapter.js"
import { loginProductionAdapterCreate } from "./loginProductionAdapterCreate.js"

type ProductionAdapterOptions = Parameters<typeof loginProductionAdapterCreate>[0]

function adapterCreate(api: Record<string, (...args: never[]) => unknown>) {
  let discovery: LoginDiscovery = demoLoginBootstrap
  const calls: { args: readonly unknown[]; method: string }[] = []
  const recording = new Proxy(api, {
    get(target, property) {
      const method = target[property as string]
      if (typeof method !== "function") return method
      return (...args: never[]) => {
        calls.push({ args, method: String(property) })
        return (method as (...callArgs: never[]) => unknown)(...args)
      }
    },
  })
  const adapter = loginProductionAdapterCreate({
    api: recording as unknown as ProductionAdapterOptions["api"],
    discovery: () => discovery,
    discoverySet: (next) => {
      discovery = next
    },
    domain: "acme.example",
    interactionHandle: () => undefined,
    interactionResume: () => {},
  })
  return { adapter, calls, realmId: demoLoginBootstrap.organization.realmId }
}

const loginChallenge = (token: string) => ({
  challenge: {
    expiresAt: 2,
    id: "challenge-1",
    purpose: "login" as const,
    requiredAssurance: "multi_factor" as const,
  },
  token,
})

const authentication = { authenticatedAt: 1, realmId: demoLoginBootstrap.organization.realmId, userId: "user-1" }

describe("loginProductionAdapterCreate login-MFA transports", () => {
  test("second factors report a missing challenge instead of posting", async () => {
    const { adapter, calls } = adapterCreate({})
    const statuses: string[] = []

    expect((await adapter.mfaEmailOtpStart?.())?.success).toBe(false)
    expect((await adapter.mfaEmailOtpVerify?.("challenge-1", "123456"))?.success).toBe(false)
    const passkey = await adapter.mfaPasskeyAuthenticate?.({
      statusSet: (status) => {
        statuses.push(status)
      },
    })
    expect(passkey?.success).toBe(false)
    expect(statuses).toEqual(["failure"])
    expect(calls).toEqual([])
  })

  test("email code start and verify use the seeded login challenge token", async () => {
    const seed = "s".repeat(43)
    const { adapter, calls, realmId } = adapterCreate({
      mfaChallengeComplete: async (_realm: string, token: string, code: string) => {
        expect(token).toBe(seed)
        expect(code).toBe("123456")
        return resultCreate({ authentication })
      },
      mfaEmailOtpChallengeStart: async (_realm: string, token: string) => {
        expect(token).toBe(seed)
        return resultCreate({ accepted: true as const, challengeId: "mfa-email-1", expiresAt: 2, retryAt: 0 })
      },
    })
    adapter.mfaChallengeTokenSet?.(seed)

    const started = await adapter.mfaEmailOtpStart?.()
    expect(started?.success).toBe(true)
    const resent = await adapter.mfaEmailOtpResend?.("mfa-email-1")
    expect(resent?.success).toBe(true)
    const verified = await adapter.mfaEmailOtpVerify?.("mfa-email-1", "123456")
    expect(verified).toMatchObject({ data: { userId: "user-1" }, success: true })
    expect(calls.map((call) => [call.method, call.args[0]])).toEqual([
      ["mfaEmailOtpChallengeStart", realmId],
      ["mfaEmailOtpChallengeStart", realmId],
      ["mfaChallengeComplete", realmId],
    ])
  })

  test("a primary login challenge is recorded for later second factors", async () => {
    const primaryToken = "p".repeat(43)
    const { adapter, calls, realmId } = adapterCreate({
      mfaChallengeComplete: async (_realm: string, token: string, _code: string) => {
        expect(token).toBe(primaryToken)
        return resultCreate({ authentication })
      },
      passwordLogin: async () => resultCreate({ authentication, challenge: loginChallenge(primaryToken) }),
    })

    const login = await adapter.passwordLogin("alex@acme.example", "correct-horse")
    expect(login.success).toBe(true)
    const verified = await adapter.mfaEmailOtpVerify?.("mfa-email-1", "654321")
    expect(verified?.success).toBe(true)
    expect(calls.map((call) => call.method)).toEqual(["passwordLogin", "mfaChallengeComplete"])
    expect(realmId).toBeString()
  })
})
