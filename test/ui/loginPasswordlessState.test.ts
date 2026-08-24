import { describe, expect, test } from "bun:test"
import type { DemoFixtureState } from "../../src/features/demo/demoFixtureStateSchema.js"
import { loginDemoAdapterCreate } from "../../src/features/login/ui/loginDemoAdapterCreate.js"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"

describe("demo passwordless login states", () => {
  test("keeps provider start failures safe and retryable", async () => {
    const adapter = loginDemoAdapterCreate({ fixtureState: () => "error", onResume: () => {} })

    const result = await adapter.providerStart("provider-from-discovery")

    expect(result).toMatchObject({
      success: false,
      errorMessage: "Sign-in with this provider could not be started.",
    })
  })

  test("keeps provider outcome copy source-equivalent, provider-specific, and non-disclosing", () => {
    expect(englishCatalog["login.provider.title"]).toBe("Sign in with {provider}")
    expect(englishCatalog["login.provider.failureDescription"]).toBe(
      "Sign in with {provider} was not completed. Please try again.",
    )
    expect(englishCatalog["login.provider.accountNotFoundTitle"]).toBe("No account linked")
    expect(englishCatalog["login.provider.accountNotFoundDescription"]).toBe(
      "No Authworks account is linked to this {provider} account. Account linking and self-service registration are not enabled yet.",
    )
    expect(englishCatalog["login.provider.linkingFailedTitle"]).toBe("Could not link account")
    expect(englishCatalog["login.provider.linkingFailedDescription"]).toBe(
      "Account linking could not be completed. Please try another sign-in method.",
    )
  })

  test("exposes pending, permission-denied, ceremony-failure, and MFA continuation statuses", async () => {
    let fixture: DemoFixtureState = "passkey-pending"
    const statuses: string[] = []
    const adapter = loginDemoAdapterCreate({ fixtureState: () => fixture, onResume: () => {} })

    const pending = adapter.passkeyAuthenticate({ statusSet: (status) => statuses.push(status) })
    expect(statuses).toEqual(["pending"])
    await pending
    expect(statuses).toEqual(["pending", "ready"])

    fixture = "passkey-permission-denied"
    statuses.length = 0
    const denied = await adapter.passkeyAuthenticate({ statusSet: (status) => statuses.push(status) })
    expect(denied.success).toBe(false)
    expect(statuses).toEqual(["pending", "permission-denied"])

    fixture = "passkey-ceremony-failure"
    statuses.length = 0
    const failed = await adapter.passkeyAuthenticate({ statusSet: (status) => statuses.push(status) })
    expect(failed.success).toBe(false)
    expect(statuses).toEqual(["pending", "ceremony-failure"])

    fixture = "mfa-continuation"
    statuses.length = 0
    const continued = await adapter.passkeyAuthenticate({ statusSet: (status) => statuses.push(status) })
    expect(continued.success).toBe(true)
    expect(statuses).toEqual(["pending", "mfa-continuation"])
    if (continued.success) expect(continued.data.challenge?.challenge.requiredAssurance).toBe("multi_factor")
  })
})
