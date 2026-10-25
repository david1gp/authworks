import { describe, expect, mock, test } from "bun:test"

let currentObserver: (() => void) | null = null

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => {
    fn()
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    const subscribers = new Set<() => void>()
    const get = () => {
      if (currentObserver !== null) subscribers.add(currentObserver)
      return value
    }
    const set = (next: T | ((prev: T) => T)) => {
      value = typeof next === "function" ? (next as (prev: T) => T)(value) : next
      for (const subscriber of [...subscribers]) subscriber()
      return value
    }
    return [get, set] as const
  },
  on: (deps: () => unknown, fn: () => void) => {
    return () => {
      let prevKey: unknown = Symbol("initial")
      const checkAndRun = () => {
        currentObserver = checkAndRun
        const currentKey = deps()
        currentObserver = null
        if (currentKey !== prevKey) {
          prevKey = currentKey
          fn()
        }
      }
      checkAndRun()
    }
  },
}))

const { organizationAdminPasswordPolicyValidate } = await import(
  "../../src/features/organizations/ui/organizationAdminPasswordPolicyValidate.js"
)
const { organizationAdminDemoAdapterCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"
)
const { organizationAdminPageStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminPageStateCreate.js"
)
const { passwordPolicyDefaults } = await import("../../src/features/passwords/domain/passwordPolicyDefaults.js")

describe("organization administration password policy validation", () => {
  test("accepts the default realm password policy", () => {
    expect(organizationAdminPasswordPolicyValidate({ ...passwordPolicyDefaults })).toBeUndefined()
  })

  test("rejects a minimum length outside 1 to 72 characters", () => {
    expect(organizationAdminPasswordPolicyValidate({ ...passwordPolicyDefaults, minimumLength: 0 })).toBe(
      "admin.organizations.passwordPolicy.validation.minimumLength",
    )
    expect(organizationAdminPasswordPolicyValidate({ ...passwordPolicyDefaults, minimumLength: 73 })).toBe(
      "admin.organizations.passwordPolicy.validation.minimumLength",
    )
  })

  test("rejects an attempt limit outside 1 to 100 attempts", () => {
    expect(organizationAdminPasswordPolicyValidate({ ...passwordPolicyDefaults, maximumAttempts: 0 })).toBe(
      "admin.organizations.passwordPolicy.validation.maximumAttempts",
    )
    expect(organizationAdminPasswordPolicyValidate({ ...passwordPolicyDefaults, maximumAttempts: 101 })).toBe(
      "admin.organizations.passwordPolicy.validation.maximumAttempts",
    )
  })

  test("rejects a lockout shorter than one second", () => {
    expect(organizationAdminPasswordPolicyValidate({ ...passwordPolicyDefaults, lockoutDurationMs: 500 })).toBe(
      "admin.organizations.passwordPolicy.validation.lockout",
    )
  })
})

describe("organization administration password policy fixtures and state", () => {
  test("round-trips the realm password policy through the demo adapter", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const initial = await adapter.passwordPolicyGet()
    expect(initial.success).toBe(true)
    expect(initial.success ? initial.data.policy.minimumLength : undefined).toBe(passwordPolicyDefaults.minimumLength)

    const updated = await adapter.passwordPolicySet({
      ...passwordPolicyDefaults,
      minimumLength: 14,
      requireLowercase: true,
    })
    expect(updated.success).toBe(true)

    const reloaded = await adapter.passwordPolicyGet()
    expect(reloaded.success ? reloaded.data.policy.minimumLength : undefined).toBe(14)
    expect(reloaded.success ? reloaded.data.policy.requireLowercase : undefined).toBe(true)
  })

  test("loads the realm password policy and saves edits from the login-policy page state", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      organizationId: () => "",
      screen: () => "login-policy",
    })

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(page.status()).toBe("ready")
    expect(page.passwordPolicy().minimumLength).toBe(passwordPolicyDefaults.minimumLength)

    const saved = await page.passwordPolicySave({
      ...passwordPolicyDefaults,
      lockoutDurationMs: 30 * 60_000,
      maximumAttempts: 3,
      minimumLength: 14,
      requireUppercase: true,
    })
    expect(saved).toBe(true)
    expect(page.passwordPolicy().minimumLength).toBe(14)
    expect(page.passwordPolicy().maximumAttempts).toBe(3)
    expect(page.passwordPolicy().requireUppercase).toBe(true)
    expect(page.notice()).toBe("password-policy-saved")
  })
})
