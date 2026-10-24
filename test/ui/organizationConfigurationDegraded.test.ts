import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (effect: () => void) => {
    effect()
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_source: unknown, effect: () => void) => effect,
}))

const { organizationAdminDemoAdapterCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"
)
const { organizationAdminPageStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminPageStateCreate.js"
)
const { resultErrorCodedCreate } = await import("../../src/platform/errors/resultErrorCodedCreate.js")

const organizationId = "01900000-0000-7000-8000-000000000011"

function pageStateCreate(
  adapter: ReturnType<typeof organizationAdminDemoAdapterCreate>,
  organization: () => string = () => organizationId,
) {
  return organizationAdminPageStateCreate({
    adapter,
    confirm: () => true,
    organizationId: organization,
    screen: () => "configuration",
  })
}

function forbiddenResult(op: string) {
  const failure = resultErrorCodedCreate(op, "The actor is not authorized.", "organizations.forbidden")
  failure.statusCode = 403
  return failure
}

describe("organization configuration degraded reads", () => {
  test("a failed realm default policy or provider listing keeps the page ready with a notice", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const page = pageStateCreate({
      ...adapter,
      loginPolicyGet: (id: string) =>
        id.length === 0
          ? Promise.resolve(forbiddenResult("organizationAdminLoginPolicyGet"))
          : adapter.loginPolicyGet(id),
      providerList: () => Promise.resolve(forbiddenResult("organizationAdminProviderList")),
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(page.status()).toBe("ready")
    expect(page.error()).toBeUndefined()
    expect(page.organization()).toBeDefined()
    expect(page.providers()).toEqual([])
    expect(page.notice()).toBe("configuration-partial")
  })

  test("a failed provider listing keeps the realm default policy intact", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const before = adapter.loginPolicyGet("")
    const page = pageStateCreate({
      ...adapter,
      providerList: () => Promise.resolve(forbiddenResult("organizationAdminProviderList")),
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(page.status()).toBe("ready")
    expect(page.providers()).toEqual([])
    expect(page.notice()).toBe("configuration-partial")
    const expected = await before
    expect(expected.success).toBe(true)
  })

  test("essential organization, branding, policy, or domain failures still fail the page", async () => {
    for (const essential of ["organizationGet", "brandingGet", "loginPolicyGet", "domainList"] as const) {
      const adapter = organizationAdminDemoAdapterCreate(() => "success")
      const page = pageStateCreate({
        ...adapter,
        ...(essential === "loginPolicyGet"
          ? {
              loginPolicyGet: (id: string) =>
                id.length === 0
                  ? adapter.loginPolicyGet(id)
                  : Promise.resolve(forbiddenResult("organizationAdminLoginPolicyGet")),
            }
          : {
              [essential]: () => Promise.resolve(forbiddenResult("organizationAdminEssentialGet")),
            }),
      })
      await Promise.resolve()
      await Promise.resolve()

      expect(page.status()).not.toBe("ready")
      expect(page.status()).not.toBe("loading")
      expect(page.error()).toBeDefined()
    }
  })
})
