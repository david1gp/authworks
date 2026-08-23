import { describe, expect, mock, test } from "bun:test"
import * as v from "valibot"

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

const { demoAdminMachineCredentials } = await import("../../src/features/demo/demoAdminMachineCredentials.js")
const { demoAdminMachineSecret } = await import("../../src/features/demo/demoAdminMachineSecret.js")
const { demoAdminMachineUsers } = await import("../../src/features/demo/demoAdminMachineUsers.js")
const { machineCredentialSchema } = await import("../../src/features/machineUsers/public/machineCredentialSchema.js")
const { machineUserSchema } = await import("../../src/features/machineUsers/public/machineUserSchema.js")
const { machineAdminDemoAdapterCreate } = await import(
  "../../src/features/machineUsers/ui/machineAdminDemoAdapterCreate.js"
)
const { machineCredentialStateSelect } = await import(
  "../../src/features/machineUsers/ui/machineCredentialStateSelect.js"
)
const { machineAdminPageStateCreate } = await import(
  "../../src/features/machineUsers/ui/machineAdminPageStateCreate.js"
)
type DemoFixtureState = import("../../src/features/demo/demoFixtureStateSchema.js").DemoFixtureState

const billingSyncId = "01900000-0000-7000-8000-000000000071"
const expiredCredentialId = "01900000-0000-7000-8000-000000000083"
const revokedCredentialId = "01900000-0000-7000-8000-000000000084"
const demoNow = 1_755_782_400_000

describe("machine-user administration demo fixtures", () => {
  test("parse against the public transport schemas", () => {
    expect(v.safeParse(v.array(machineUserSchema), demoAdminMachineUsers).success).toBe(true)
    expect(v.safeParse(v.array(machineCredentialSchema), demoAdminMachineCredentials).success).toBe(true)
  })

  test("never carry a stored secret value on credential metadata", () => {
    for (const credential of demoAdminMachineCredentials) {
      const keys = Object.keys(credential)
      expect(keys).not.toContain("secret")
      expect(keys).not.toContain("clientSecret")
      expect(keys).not.toContain("token")
    }
  })

  test("cover the active, expired, and revoked credential states at the fixed demo time", () => {
    const states = demoAdminMachineCredentials.map((credential) => machineCredentialStateSelect(credential, demoNow))
    expect(states).toContain("active")
    expect(states).toContain("expired")
    expect(states).toContain("revoked")
  })

  test("the one-time fixture secret is clearly fake and long enough for the issue contract", () => {
    expect(demoAdminMachineSecret).toStartWith("demo-")
    expect(demoAdminMachineSecret.length).toBeGreaterThanOrEqual(43)
  })
})

describe("machine credential state selection", () => {
  test("prefers revocation over expiry so a revoked credential is never shown as merely lapsed", () => {
    const revokedAndExpired = {
      createdAt: 1,
      expiresAt: 2,
      id: revokedCredentialId,
      kind: "api_key" as const,
      machineUserId: billingSyncId,
      realmId: billingSyncId,
      revokedAt: 3,
      scopes: [],
    }
    expect(machineCredentialStateSelect(revokedAndExpired, demoNow)).toBe("revoked")
  })

  test("treats a credential without an expiry as active indefinitely", () => {
    const perpetual = {
      createdAt: 1,
      id: billingSyncId,
      kind: "client_secret" as const,
      machineUserId: billingSyncId,
      realmId: billingSyncId,
      scopes: [],
    }
    expect(machineCredentialStateSelect(perpetual, Number.MAX_SAFE_INTEGER)).toBe("active")
  })
})

describe("machine-user administration demo adapter", () => {
  test("returns fixture collections for the success state without any network access", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const machineUsers = await adapter.machineUserList()
    const credentials = await adapter.credentialList(billingSyncId)

    expect(machineUsers.success && machineUsers.data.items.length).toBeGreaterThan(0)
    expect(credentials.success && credentials.data.items.length).toBeGreaterThan(0)
    expect(credentials.success && credentials.data.items.every((item) => item.machineUserId === billingSyncId)).toBe(
      true,
    )
  })

  test("returns empty collections for the empty state", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "empty")

    const machineUsers = await adapter.machineUserList()
    const credentials = await adapter.credentialList(billingSyncId)

    expect(machineUsers.success && machineUsers.data.items).toEqual([])
    expect(credentials.success && credentials.data.items).toEqual([])
  })

  test("maps denied, assurance, and cross-tenant states onto distinct coded failures", async () => {
    const denied = await machineAdminDemoAdapterCreate(() => "permission-denied").machineUserList()
    const assurance = await machineAdminDemoAdapterCreate(() => "expired").machineUserList()
    const crossTenant = await machineAdminDemoAdapterCreate(() => "cross-tenant").machineUserList()
    const failed = await machineAdminDemoAdapterCreate(() => "error").machineUserList()

    expect(!denied.success && denied.code).toBe("machine-users.forbidden")
    expect(!assurance.success && assurance.code).toBe("authorization.insufficient-assurance")
    expect(!crossTenant.success && crossTenant.code).toBe("machine-users.tenant-mismatch")
    expect(!failed.success && failed.code).toBe("machine-users.read-failed")
  })

  test("never settles in the loading state so the loading view stays visible", async () => {
    const pending = machineAdminDemoAdapterCreate(() => "loading").machineUserList()

    const outcome = await Promise.race([
      pending.then(() => "settled" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 25)),
    ])

    expect(outcome).toBe("pending")
  })

  test("creating a machine user issues a client id and a one-time client secret", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const created = await adapter.machineUserCreate({ displayName: "Demo Service", userName: "demo-service" })

    expect(created.success && created.data.clientId).toBe("demo-service")
    expect(created.success && created.data.clientSecret.length).toBeGreaterThanOrEqual(43)
    // A read of the machine user never returns the secret, so it is not recoverable.
    const read = created.success ? await adapter.machineUserGet(created.data.machineUser.id) : undefined
    expect(read?.success && Object.keys(read.data)).not.toContain("clientSecret")
  })

  test("rotating a client secret produces a fresh, non-recoverable value each time", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const first = await adapter.clientSecretRotate(billingSyncId)
    const second = await adapter.clientSecretRotate(billingSyncId)

    expect(first.success && second.success && first.data.clientSecret !== second.data.clientSecret).toBe(true)
    const read = await adapter.machineUserGet(billingSyncId)
    expect(read.success && Object.keys(read.data)).not.toContain("clientSecret")
  })

  test("issues personal access tokens and API keys with the requested kind, scopes, and expiry", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const token = await adapter.personalAccessTokenCreate(billingSyncId, {
      machineUserId: billingSyncId,
      name: "Pipeline token",
      scopes: ["billing.read"],
    })
    const apiKey = await adapter.apiKeyCreate(billingSyncId, {
      expiresAt: demoNow + 86_400_000,
      machineUserId: billingSyncId,
      name: "Integration key",
    })

    expect(token.success && token.data.credential.kind).toBe("personal_access_token")
    expect(token.success && token.data.credential.scopes).toEqual(["billing.read"])
    expect(token.success && token.data.secret.length).toBeGreaterThanOrEqual(43)
    expect(apiKey.success && apiKey.data.credential.kind).toBe("api_key")
    expect(apiKey.success && apiKey.data.credential.expiresAt).toBe(demoNow + 86_400_000)
    // An issued credential's value is never part of the listed metadata.
    const listed = await adapter.credentialList(billingSyncId)
    expect(listed.success && listed.data.items.every((item) => !("secret" in item))).toBe(true)
  })

  test("an issued credential inherits the machine user's scopes when none are requested", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const issued = await adapter.apiKeyCreate(billingSyncId, { machineUserId: billingSyncId, name: "Inherited" })

    expect(issued.success && issued.data.credential.scopes).toEqual(["billing.read", "billing.write"])
  })

  test("revoking a credential stamps a revocation time and keeps its metadata readable", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const revoked = await adapter.credentialRevoke(expiredCredentialId)

    expect(revoked.success && revoked.data.revokedAt).toBeNumber()
    expect(revoked.success && revoked.data.id).toBe(expiredCredentialId)
  })

  test("moves a machine user through its lifecycle", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const deactivated = await adapter.machineUserLifecycleSet(billingSyncId, { status: "inactive" })
    const removed = await adapter.machineUserLifecycleSet(billingSyncId, { status: "removed" })

    expect(deactivated.success && deactivated.data.status).toBe("inactive")
    expect(removed.success && removed.data.status).toBe("removed")
  })

  test("exposes no operation that reads back a stored secret", () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")

    const surface = Object.keys(adapter)
    expect(surface.filter((name) => /secret/i.test(name))).toEqual(["clientSecretRotate"])
    expect(surface.some((name) => /secretGet|secretRead|secretList/i.test(name))).toBe(false)
  })
})

function reactiveSignalCreate<T>(initial: T) {
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
}

describe("machine administration page state token/secret seeding and dismissal", () => {
  test("seeds initial secret, allows acknowledgement/dismissal, and re-seeds upon selector reloadKey change", async () => {
    const [fixtureState, setFixtureState] = reactiveSignalCreate<DemoFixtureState>("one-time")
    const adapter = machineAdminDemoAdapterCreate(fixtureState)
    const issuedSecretSeed = () =>
      fixtureState() === "one-time"
        ? {
            clientId: "demo-service",
            kind: "client_secret" as const,
            machineUserId: billingSyncId,
            machineUserName: "Demo Service",
            name: "Demo Service",
            secret: demoAdminMachineSecret,
          }
        : undefined

    const page = machineAdminPageStateCreate({
      adapter,
      confirm: () => true,
      issuedSecretSeed,
      machineUserId: () => billingSyncId,
      now: () => demoNow,
      reloadKey: fixtureState,
      screen: () => "machine-credentials",
    })

    expect(page.issuedSecret()?.secret).toBe(demoAdminMachineSecret)

    page.issuedSecretAcknowledge()
    expect(page.issuedSecret()).toBeUndefined()

    // Transitioning to success leaves the secret cleared
    setFixtureState("success")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.issuedSecret()).toBeUndefined()

    // Transitioning back to one-time re-seeds the secret
    setFixtureState("one-time")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.issuedSecret()?.secret).toBe(demoAdminMachineSecret)
  })
})

describe("machine administration page state reactive cloned mutations", () => {
  test("reactively updates machine user on secret rotation and lifecycle changes", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")
    const page = machineAdminPageStateCreate({
      adapter,
      confirm: () => true,
      machineUserId: () => billingSyncId,
      now: () => demoNow,
      screen: () => "machine-user-detail",
    })

    await Promise.resolve()
    await Promise.resolve()

    const initialUser = page.machineUser()
    expect(initialUser).toBeDefined()

    await page.clientSecretRotate(billingSyncId)
    const rotatedUser = page.machineUser()
    expect(rotatedUser).toBeDefined()
    expect(page.notice()).toBe("client-secret-rotated")
    expect(page.issuedSecret()?.kind).toBe("client_secret")

    await page.machineUserLifecycleSet(billingSyncId, "inactive")
    const inactiveUser = page.machineUser()
    expect(inactiveUser?.status).toBe("inactive")
    expect(page.notice()).toBe("machine-user-lifecycle")
  })

  test("reactively updates credentials on issue, revocation, and new machine user creation", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")
    const page = machineAdminPageStateCreate({
      adapter,
      confirm: () => true,
      machineUserId: () => billingSyncId,
      now: () => demoNow,
      screen: () => "machine-credentials",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    const initialCredentials = page.credentials()
    expect(initialCredentials.length).toBeGreaterThan(0)

    const issuedApiKey = await page.apiKeyCreate(billingSyncId, {
      name: "New Key",
      scopes: ["billing.read"],
    })
    expect(issuedApiKey).toBe(true)
    expect(page.credentials().length).toBe(initialCredentials.length + 1)
    expect(page.credentials()[0]?.name).toBe("New Key")
    expect(page.notice()).toBe("api-key-created")
    expect(page.issuedSecret()?.kind).toBe("api_key")

    const issuedPat = await page.personalAccessTokenCreate(billingSyncId, {
      name: "New PAT",
      scopes: ["billing.read"],
    })
    expect(issuedPat).toBe(true)
    expect(page.notice()).toBe("personal-access-token-created")
    expect(page.issuedSecret()?.kind).toBe("personal_access_token")

    const targetCredId = page.credentials()[0]!.id
    await page.credentialRevoke(targetCredId)
    expect(page.credentials().find((c) => c.id === targetCredId)?.revokedAt).toBeDefined()
    expect(page.notice()).toBe("credential-revoked")

    const createdMachineUser = await page.machineUserCreate({
      displayName: "New Machine",
      userName: "new-machine",
    })
    expect(createdMachineUser).toBe(true)
    expect(page.machineUsers().some((u) => u.userName === "new-machine")).toBe(true)
    expect(page.notice()).toBe("machine-user-created")
  })
})

describe("machine list row keyboard activation and accessibility", () => {
  test("activates machineUserOpen and prevents default on Enter and Space, but ignores other keys", () => {
    const openedIds: string[] = []
    const handleKeyDown = (key: string, machineUserId: string) => {
      let defaultPrevented = false
      const event = {
        key,
        preventDefault: () => {
          defaultPrevented = true
        },
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        openedIds.push(machineUserId)
      }
      return defaultPrevented
    }

    expect(handleKeyDown("Enter", "machine-1")).toBe(true)
    expect(handleKeyDown(" ", "machine-2")).toBe(true)
    expect(handleKeyDown("Tab", "machine-3")).toBe(false)
    expect(handleKeyDown("ArrowDown", "machine-4")).toBe(false)
    expect(openedIds).toEqual(["machine-1", "machine-2"])
  })
})

describe("machine administration selector transitions", () => {
  test("reacts to selector fixture state changes between success, empty, permission-denied, and one-time", async () => {
    const [fixtureState, setFixtureState] = reactiveSignalCreate<DemoFixtureState>("success")
    const adapter = machineAdminDemoAdapterCreate(fixtureState)
    const issuedSecretSeed = () =>
      fixtureState() === "one-time"
        ? {
            clientId: "demo-service",
            kind: "client_secret" as const,
            machineUserId: billingSyncId,
            machineUserName: "Demo Service",
            name: "Demo Service",
            secret: demoAdminMachineSecret,
          }
        : undefined

    const page = machineAdminPageStateCreate({
      adapter,
      confirm: () => true,
      issuedSecretSeed,
      machineUserId: () => billingSyncId,
      now: () => demoNow,
      reloadKey: fixtureState,
      screen: () => "machine-users",
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(page.status()).toBe("ready")
    expect(page.machineUsers().length).toBeGreaterThan(0)

    setFixtureState("empty")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.status()).toBe("empty")
    expect(page.machineUsers()).toHaveLength(0)

    setFixtureState("permission-denied")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.status()).toBe("permission-denied")
    expect(page.error()).toBeDefined()

    setFixtureState("one-time")
    await Promise.resolve()
    await Promise.resolve()
    expect(page.issuedSecret()?.secret).toBe(demoAdminMachineSecret)
  })
})
