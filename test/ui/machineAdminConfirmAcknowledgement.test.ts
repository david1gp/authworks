import { beforeEach, describe, expect, mock, test } from "bun:test"

/** A real storage implementation so acknowledgement is exercised through the browser API. */
const sessionStorageCreate = (): Storage => {
  const entries = new Map<string, string>()
  return {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size
    },
    removeItem: (key: string) => void entries.delete(key),
    setItem: (key: string, value: string) => void entries.set(key, value),
  } as Storage
}

const sessionStorage = sessionStorageCreate()

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_deps: unknown, fn: () => void) => fn,
}))

const [{ confirmStateCreate }, { machineAdminSecretAcknowledgementStore }, { machineAdminPageStateCreate }] =
  await Promise.all([
    import("../../src/ui/confirm/confirmStateCreate.js"),
    import("../../src/features/machineUsers/ui/machineAdminSecretAcknowledgementStore.js"),
    import("../../src/features/machineUsers/ui/machineAdminPageStateCreate.js"),
  ])

// A real storage is injected rather than a global `window`, which would make unrelated
// modules treat this process as a browser and change their locale resolution.
beforeEach(() => {
  sessionStorage.clear()
  machineAdminSecretAcknowledgementStore.storageSet(sessionStorage)
})

const machineUserId = "01900000-0000-7000-8000-000000000071"

const adapterCreate = (calls: string[]) =>
  ({
    apiKeyCreate: async () => ({ success: false as const, code: "unused", errorMessage: "unused" }),
    clientSecretRotate: async () => {
      calls.push("clientSecretRotate")
      return { success: false as const, code: "unused", errorMessage: "unused" }
    },
    credentialList: async () => ({ success: true as const, data: { items: [] } }),
    credentialRevoke: async () => {
      calls.push("credentialRevoke")
      return { success: false as const, code: "unused", errorMessage: "unused" }
    },
    machineUserCreate: async () => ({ success: false as const, code: "unused", errorMessage: "unused" }),
    machineUserGet: async () => ({ success: false as const, code: "unused", errorMessage: "unused" }),
    machineUserLifecycleSet: async () => {
      calls.push("machineUserLifecycleSet")
      return { success: false as const, code: "unused", errorMessage: "unused" }
    },
    machineUserList: async () => ({ success: true as const, data: { items: [] } }),
    personalAccessTokenCreate: async () => ({ success: false as const, code: "unused", errorMessage: "unused" }),
    // The adapter surface is exercised only for confirmation gating here.
  }) as unknown as Parameters<typeof machineAdminPageStateCreate>[0]["adapter"]

const pageCreate = (confirm: (message: string) => boolean | Promise<boolean>, calls: string[]) =>
  machineAdminPageStateCreate({
    adapter: adapterCreate(calls),
    confirm,
    machineUserId: () => machineUserId,
    now: () => 1_755_782_400_000,
    screen: () => "machine-user-detail",
  })

describe("destructive machine-user confirmations", () => {
  test("cancelling leaves the credential, secret, and machine user untouched", async () => {
    const calls: string[] = []
    const page = pageCreate(() => false, calls)

    await page.clientSecretRotate(machineUserId)
    await page.credentialRevoke("credential-1")
    await page.machineUserLifecycleSet(machineUserId, "removed")

    expect(calls).toEqual([])
  })

  test("accepting runs the action, and a non-destructive lifecycle change is never gated", async () => {
    const calls: string[] = []
    const page = pageCreate(() => true, calls)

    await page.clientSecretRotate(machineUserId)
    await page.credentialRevoke("credential-1")
    await page.machineUserLifecycleSet(machineUserId, "removed")
    await page.machineUserLifecycleSet(machineUserId, "inactive")

    expect(calls).toEqual([
      "clientSecretRotate",
      "credentialRevoke",
      "machineUserLifecycleSet",
      "machineUserLifecycleSet",
    ])
  })

  test("waits for the visible prompt instead of a native confirm, and a cancel declines", async () => {
    const calls: string[] = []
    const confirmState = confirmStateCreate()
    const page = pageCreate(confirmState.confirm, calls)

    const pending = page.credentialRevoke("credential-1")
    expect(confirmState.open()).toBe(true)
    expect(confirmState.message()).toBeString()
    confirmState.cancel()
    await pending

    expect(calls).toEqual([])
    expect(confirmState.open()).toBe(false)
  })
})

describe("acknowledged one-time machine secrets", () => {
  test("build a marker that carries no secret material and is isolated per machine user and kind", () => {
    const marker = machineAdminSecretAcknowledgementStore.markerBuild(machineUserId, "client_secret")

    expect(marker).not.toContain("secret-")
    expect(machineAdminSecretAcknowledgementStore.acknowledged(marker)).toBe(false)
    machineAdminSecretAcknowledgementStore.acknowledge(marker)
    expect(machineAdminSecretAcknowledgementStore.acknowledged(marker)).toBe(true)
    expect(
      machineAdminSecretAcknowledgementStore.acknowledged(
        machineAdminSecretAcknowledgementStore.markerBuild(machineUserId, "api_key"),
      ),
    ).toBe(false)
    expect(
      machineAdminSecretAcknowledgementStore.acknowledged(
        machineAdminSecretAcknowledgementStore.markerBuild("other-machine-user", "client_secret"),
      ),
    ).toBe(false)
  })

  test("write only a non-secret marker into the browser session storage", () => {
    machineAdminSecretAcknowledgementStore.acknowledge(
      machineAdminSecretAcknowledgementStore.markerBuild(machineUserId, "client_secret"),
    )

    const raw = sessionStorage.getItem("authworks.machine-users.acknowledged-secrets") ?? ""
    expect(JSON.parse(raw)).toEqual([`${machineUserId}:client_secret`])
    expect(raw).not.toContain("demo-secret")
  })

  test("acknowledging a seeded secret records it so a reload does not show it again", () => {
    const acknowledged: string[] = []
    const seed = {
      clientId: "billing-sync",
      kind: "client_secret" as const,
      machineUserId,
      machineUserName: "Billing sync",
      name: "Billing sync",
      secret: "demo-secret-value",
    }
    const page = machineAdminPageStateCreate({
      adapter: adapterCreate([]),
      confirm: () => true,
      issuedSecretSeed: () => (acknowledged.includes(`${seed.machineUserId}:${seed.kind}`) ? undefined : seed),
      machineUserId: () => machineUserId,
      now: () => 1_755_782_400_000,
      onIssuedSecretAcknowledge: (issued) => acknowledged.push(`${issued.machineUserId}:${issued.kind}`),
      screen: () => "machine-user-detail",
    })

    expect(page.issuedSecret()?.secret).toBe("demo-secret-value")
    page.issuedSecretAcknowledge()

    expect(acknowledged).toEqual([`${machineUserId}:client_secret`])
    expect(page.issuedSecret()).toBeUndefined()
  })
})
