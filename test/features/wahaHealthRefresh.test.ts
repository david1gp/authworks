import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { wahaHealthCandidateRepositoryCreate } from "../../src/features/waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import { wahaHealthPortCreate } from "../../src/features/waha/server/wahaHealthPortCreate.js"
import { wahaHealthRefreshLifecycleCreate } from "../../src/features/waha/server/wahaHealthRefreshLifecycleCreate.js"
import { wahaHealthRegistryCreate } from "../../src/features/waha/server/wahaHealthRegistryCreate.js"
import type { WahaConfiguration } from "../../src/features/waha/server/wahaConfiguration.js"

const client = {
  baseUrl: "https://waha.example.test",
  apiKey: "server-only-key",
} as const

const configuration: WahaConfiguration = {
  endpoints: [{ client, id: "primary" }],
  freshnessTtlMs: 60_000,
  refreshIntervalMs: 30_000,
}

const multiEndpointConfiguration: WahaConfiguration = {
  endpoints: [
    {
      client: { apiKey: "primary-server-only-key", baseUrl: "https://primary.example.test" },
      id: "primary",
    },
    {
      client: { apiKey: "secondary-server-only-key", baseUrl: "https://secondary.example.test" },
      id: "secondary",
    },
  ],
  freshnessTtlMs: 60_000,
  refreshIntervalMs: 30_000,
}

test("WAHA health adapter checks server health before listing sessions", async () => {
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = (async (input) => {
    const url = input.toString()
    requests.push(url)
    if (url.endsWith("/health")) return Response.json({ status: "ok" })
    return Response.json([
      {
        name: "default",
        presence: null,
        status: "WORKING",
        timestamps: { activity: null },
      },
      {
        name: "stopped",
        presence: null,
        status: "STOPPED",
        timestamps: { activity: null },
      },
    ])
  }) as typeof fetch

  try {
    const checked = await wahaHealthPortCreate({ configuration }).check({ endpointId: "primary" })
    expect(checked).toMatchObject({
      success: true,
      data: {
        sessions: [
          { name: "default", status: "WORKING" },
          { name: "stopped", status: "STOPPED" },
        ],
        status: "ok",
      },
    })
    expect(requests).toEqual(["https://waha.example.test/health", "https://waha.example.test/api/sessions?all=true"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("WAHA health adapter filters session results to configured sender sessions", async () => {
  const originalFetch = globalThis.fetch
  const endpointConfiguration: WahaConfiguration = {
    ...configuration,
    endpoints: [{ ...configuration.endpoints[0]!, senderSessions: ["sender-working", "sender-stopped"] }],
  }
  globalThis.fetch = (async (input) => {
    if (input.toString().endsWith("/health")) return Response.json({ status: "ok" })
    return Response.json([
      { name: "sender-working", status: "WORKING" },
      { name: "sender-stopped", status: "STOPPED" },
      { name: "recipient", status: "WORKING" },
    ])
  }) as typeof fetch

  try {
    const checked = await wahaHealthPortCreate({ configuration: endpointConfiguration }).check({
      endpointId: "primary",
    })
    expect(checked).toEqual({
      data: {
        sessions: [
          { name: "sender-working", status: "WORKING" },
          { name: "sender-stopped", status: "STOPPED" },
        ],
        status: "ok",
      },
      success: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("WAHA health refresh immediately expires persisted candidates when health or session listing fails", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const failureConfiguration: WahaConfiguration = {
      endpoints: [
        { client: { baseUrl: "https://health-failure.example.test" }, id: "health-failure" },
        { client: { baseUrl: "https://list-failure.example.test" }, id: "list-failure" },
      ],
      freshnessTtlMs: 60_000,
      refreshIntervalMs: 30_000,
    }
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    for (const endpointId of ["health-failure", "list-failure"]) {
      expect(
        repository.wahaHealthCandidateCreate({
          checkedAt: now,
          createdAt: now,
          endpointId,
          expiresAt: now + 60_000,
          failureAt: null,
          failureCode: null,
          failureMessage: null,
          sessionName: "default",
          status: "healthy",
          updatedAt: now,
          version: 1,
        }),
      ).toMatchObject({ success: true })
    }

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input) => {
      const url = input.toString()
      if (url === "https://health-failure.example.test/health") return new Response("unavailable", { status: 503 })
      if (url === "https://list-failure.example.test/health") return Response.json({ status: "ok" })
      return new Response("unavailable", { status: 503 })
    }) as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration: failureConfiguration,
        healthPort: wahaHealthPortCreate({ configuration: failureConfiguration }),
        repository,
        runtime: { now: () => now },
      })
      expect(await registry.refresh()).toEqual({ success: true, data: undefined })
      expect(repository.wahaHealthCandidateList()).toMatchObject({
        success: true,
        data: [
          { endpointId: "health-failure", expiresAt: now, status: "unhealthy" },
          { endpointId: "list-failure", expiresAt: now, status: "unhealthy" },
        ],
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA health refresh scans every endpoint and persists only working sessions", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    for (const endpointId of ["primary", "retired"]) {
      expect(
        repository.wahaHealthCandidateCreate({
          checkedAt: now,
          createdAt: now,
          endpointId,
          expiresAt: now + 60_000,
          failureAt: null,
          failureCode: null,
          failureMessage: null,
          sessionName: endpointId === "primary" ? "removed-session" : "default",
          status: "healthy",
          updatedAt: now,
          version: 1,
        }),
      ).toMatchObject({ success: true })
    }

    const originalFetch = globalThis.fetch
    const requests: Array<{ readonly apiKey: string | null; readonly url: string }> = []
    globalThis.fetch = (async (input, init) => {
      const url = input.toString()
      requests.push({ apiKey: new Headers(init?.headers).get("X-Api-Key"), url })
      if (url.endsWith("/health")) return Response.json({ status: "ok" })
      if (url.startsWith("https://primary.example.test"))
        return Response.json([
          { name: "primary-backup", status: "WORKING" },
          { name: "primary-stopped", status: "STOPPED" },
          { name: "primary-working", status: "WORKING" },
        ])
      return Response.json([
        { name: "secondary-failed", status: "FAILED" },
        { name: "secondary-working", status: "WORKING" },
      ])
    }) as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration: multiEndpointConfiguration,
        healthPort: wahaHealthPortCreate({ configuration: multiEndpointConfiguration }),
        repository,
        runtime: { now: () => now },
      })

      expect(await registry.refresh()).toEqual({ success: true, data: undefined })
      expect(requests).toEqual([
        { apiKey: "primary-server-only-key", url: "https://primary.example.test/health" },
        { apiKey: "primary-server-only-key", url: "https://primary.example.test/api/sessions?all=true" },
        { apiKey: "secondary-server-only-key", url: "https://secondary.example.test/health" },
        { apiKey: "secondary-server-only-key", url: "https://secondary.example.test/api/sessions?all=true" },
      ])
      expect(repository.wahaHealthCandidateListFreshHealthy(now)).toMatchObject({
        success: true,
        data: [
          { endpointId: "primary", sessionName: "primary-backup", status: "healthy" },
          { endpointId: "primary", sessionName: "primary-working", status: "healthy" },
          { endpointId: "secondary", sessionName: "secondary-working", status: "healthy" },
        ],
      })
      expect(repository.wahaHealthCandidateList()).toMatchObject({
        success: true,
        data: [
          { endpointId: "primary", expiresAt: now + 60_000, sessionName: "primary-backup", status: "healthy" },
          { endpointId: "primary", expiresAt: now + 60_000, sessionName: "primary-stopped", status: "unhealthy" },
          { endpointId: "primary", expiresAt: now + 60_000, sessionName: "primary-working", status: "healthy" },
          { endpointId: "primary", expiresAt: now, sessionName: "removed-session", status: "unhealthy" },
          { endpointId: "retired", expiresAt: now, sessionName: "default", status: "unhealthy" },
          { endpointId: "secondary", expiresAt: now + 60_000, sessionName: "secondary-failed", status: "unhealthy" },
          { endpointId: "secondary", expiresAt: now + 60_000, sessionName: "secondary-working", status: "healthy" },
        ],
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA health refresh expires persisted disallowed sessions and keeps non-working allowed sessions unavailable", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const endpointConfiguration: WahaConfiguration = {
      ...configuration,
      endpoints: [
        { ...configuration.endpoints[0]!, senderSessions: ["sender-working", "sender-stopped", "sender-missing"] },
      ],
    }
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    for (const sessionName of ["recipient", "sender-missing"]) {
      expect(
        repository.wahaHealthCandidateCreate({
          checkedAt: now,
          createdAt: now,
          endpointId: "primary",
          expiresAt: now + 60_000,
          failureAt: null,
          failureCode: null,
          failureMessage: null,
          sessionName,
          status: "healthy",
          updatedAt: now,
          version: 1,
        }),
      ).toMatchObject({ success: true })
    }

    const registry = wahaHealthRegistryCreate({
      configuration: endpointConfiguration,
      healthPort: {
        check: async () =>
          resultCreate({
            sessions: [
              { name: "sender-working", status: "WORKING" },
              { name: "sender-stopped", status: "STOPPED" },
              { name: "recipient", status: "WORKING" },
            ],
            status: "ok",
          }),
      },
      repository,
      runtime: { now: () => now },
    })

    expect(await registry.refresh()).toEqual({ success: true, data: undefined })
    expect(repository.wahaHealthCandidateListFreshHealthy(now)).toMatchObject({
      success: true,
      data: [{ endpointId: "primary", sessionName: "sender-working", status: "healthy" }],
    })
    expect(repository.wahaHealthCandidateList()).toMatchObject({
      success: true,
      data: [
        { endpointId: "primary", expiresAt: now, sessionName: "recipient", status: "unhealthy" },
        { endpointId: "primary", expiresAt: now, sessionName: "sender-missing", status: "unhealthy" },
        { endpointId: "primary", expiresAt: now + 60_000, sessionName: "sender-stopped", status: "unhealthy" },
        { endpointId: "primary", expiresAt: now + 60_000, sessionName: "sender-working", status: "healthy" },
      ],
    })
  })
})

test("WAHA health adapter keeps client failures secret-safe", async () => {
  const originalFetch = globalThis.fetch
  const endpointConfiguration: WahaConfiguration = {
    ...multiEndpointConfiguration,
    endpoints: [multiEndpointConfiguration.endpoints[0]!],
  }

  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "primary-server-only-key" }), { status: 503 })) as unknown as typeof fetch
    const healthFailure = await wahaHealthPortCreate({ configuration: endpointConfiguration }).check({
      endpointId: "primary",
    })
    expect(healthFailure).toMatchObject({ code: "waha.health-failed", success: false })
    expect(JSON.stringify(healthFailure)).not.toContain("primary-server-only-key")

    globalThis.fetch = (async (input) => {
      if (input.toString().endsWith("/health")) return Response.json({ status: "ok" })
      return new Response(JSON.stringify({ error: "primary-server-only-key" }), { status: 503 })
    }) as typeof fetch
    const sessionFailure = await wahaHealthPortCreate({ configuration: endpointConfiguration }).check({
      endpointId: "primary",
    })
    expect(sessionFailure).toMatchObject({ code: "waha.health-failed", success: false })
    expect(JSON.stringify(sessionFailure)).not.toContain("primary-server-only-key")

    globalThis.fetch = (() => {
      throw new Error("network failed for primary-server-only-key")
    }) as unknown as typeof fetch
    const thrownFailure = await wahaHealthPortCreate({ configuration: endpointConfiguration }).check({
      endpointId: "primary",
    })
    expect(thrownFailure).toMatchObject({ code: "waha.health-failed", success: false })
    expect(JSON.stringify(thrownFailure)).not.toContain("primary-server-only-key")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("WAHA health refresh persists fresh candidates and expires stale rows", async () => {
  await withDatabase(async (database) => {
    let now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const registry = wahaHealthRegistryCreate({
      configuration,
      healthPort: {
        check: async () => resultCreate({ sessions: [{ name: "default", status: "WORKING" }], status: "ok" }),
      },
      repository,
      runtime: { now: () => now },
    })

    expect(await registry.refresh()).toEqual({ success: true, data: undefined })
    expect(repository.wahaHealthCandidateListFreshHealthy(now)).toMatchObject({
      success: true,
      data: [{ endpointId: "primary", sessionName: "default", status: "healthy" }],
    })

    const current = repository.wahaHealthCandidateGet("primary", "default")
    expect(current.success).toBe(true)
    if (!current.success || current.data === null) return
    const marked = registry.markUnhealthy({
      endpointId: "primary",
      expectedVersion: current.data.version,
      sessionName: "default",
    })
    expect(marked).toMatchObject({ success: true, data: { status: "unhealthy", failureCode: "waha.delivery-failed" } })
    expect(repository.wahaHealthCandidateListFreshHealthy(now)).toMatchObject({ success: true, data: [] })

    const stale = repository.wahaHealthCandidateCreateOrUpdate({
      checkedAt: now,
      createdAt: now,
      endpointId: "stale",
      expiresAt: now + 1,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "default",
      status: "healthy",
      updatedAt: now,
      version: 1,
    })
    expect(stale.success).toBe(true)
    now += 1
    const expired = await wahaHealthRegistryCreate({
      configuration: { ...configuration, endpoints: [] },
      healthPort: {
        check: async () => resultCreate({ sessions: [], status: "error" }),
      },
      repository,
      runtime: { now: () => now },
    }).refresh()
    expect(expired).toEqual({ success: true, data: undefined })
    expect(repository.wahaHealthCandidateGet("stale", "default")).toMatchObject({
      success: true,
      data: { status: "unhealthy", failureCode: "waha.health-failed" },
    })
  })
})

test("WAHA health refresh skips overlapping scans", async () => {
  await withDatabase(async (database) => {
    let release: (() => void) | undefined
    let checks = 0
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const registry = wahaHealthRegistryCreate({
      configuration,
      healthPort: {
        check: async () => {
          checks += 1
          await new Promise<void>((resolve) => {
            release = resolve
          })
          return resultCreate({ sessions: [{ name: "default", status: "WORKING" }], status: "ok" })
        },
      },
      repository,
      runtime: { now: () => 1_700_000_000_000 },
    })

    const first = registry.refresh()
    const second = registry.refresh()
    await Promise.resolve()
    expect(checks).toBe(1)
    release?.()
    expect(await first).toEqual({ success: true, data: undefined })
    expect(await second).toEqual({ success: true, data: undefined })
  })
})

test("WAHA health refresh expires removed endpoints across candidate statuses", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const candidates = [
      { endpointId: "removed-healthy", status: "healthy" as const },
      { endpointId: "removed-unknown", status: "unknown" as const },
      {
        endpointId: "removed-old-unhealthy",
        failureAt: now - 1_000,
        failureCode: "waha.health-failed",
        failureMessage: "The previous WAHA health check failed.",
        status: "unhealthy" as const,
      },
      {
        endpointId: "removed-delivery",
        failureAt: now + 1_000,
        failureCode: "waha.delivery-failed",
        failureMessage: "The WhatsApp message could not be delivered.",
        status: "unhealthy" as const,
      },
    ]
    for (const candidate of candidates) {
      expect(
        repository.wahaHealthCandidateCreate({
          checkedAt: now,
          createdAt: now,
          endpointId: candidate.endpointId,
          expiresAt: now + 60_000,
          failureAt: candidate.failureAt ?? null,
          failureCode: candidate.failureCode ?? null,
          failureMessage: candidate.failureMessage ?? null,
          sessionName: "default",
          status: candidate.status,
          updatedAt: now,
          version: 1,
        }),
      ).toMatchObject({ success: true })
    }

    const refreshed = await wahaHealthRegistryCreate({
      configuration,
      healthPort: {
        check: async () => resultCreate({ sessions: [], status: "ok" }),
      },
      repository,
      runtime: { now: () => now },
    }).refresh()

    expect(refreshed).toEqual({ success: true, data: undefined })
    expect(repository.wahaHealthCandidateList()).toMatchObject({
      success: true,
      data: [
        { endpointId: "removed-delivery", expiresAt: now, failureCode: "waha.delivery-failed", status: "unhealthy" },
        { endpointId: "removed-healthy", expiresAt: now, failureCode: "waha.health-failed", status: "unhealthy" },
        {
          endpointId: "removed-old-unhealthy",
          expiresAt: now,
          failureCode: "waha.health-failed",
          status: "unhealthy",
        },
        { endpointId: "removed-unknown", expiresAt: now, failureCode: "waha.health-failed", status: "unhealthy" },
      ],
    })
    expect(repository.wahaHealthCandidateGet("removed-delivery", "default")).toMatchObject({
      success: true,
      data: {
        failureAt: now + 1_000,
        failureMessage: "The WhatsApp message could not be delivered.",
      },
    })
  })
})

test("WAHA health refresh expires disappeared sessions across candidate statuses", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const candidates = [
      { sessionName: "gone-healthy", status: "healthy" as const },
      { sessionName: "gone-unknown", status: "unknown" as const },
      {
        sessionName: "gone-old-unhealthy",
        failureAt: now - 1_000,
        failureCode: "waha.health-failed",
        failureMessage: "The previous WAHA health check failed.",
        status: "unhealthy" as const,
      },
      {
        sessionName: "gone-delivery",
        failureAt: now + 1_000,
        failureCode: "waha.delivery-failed",
        failureMessage: "The WhatsApp message could not be delivered.",
        status: "unhealthy" as const,
      },
      { sessionName: "present", status: "healthy" as const },
    ]
    for (const candidate of candidates) {
      expect(
        repository.wahaHealthCandidateCreate({
          checkedAt: now,
          createdAt: now,
          endpointId: "primary",
          expiresAt: now + 60_000,
          failureAt: candidate.failureAt ?? null,
          failureCode: candidate.failureCode ?? null,
          failureMessage: candidate.failureMessage ?? null,
          sessionName: candidate.sessionName,
          status: candidate.status,
          updatedAt: now,
          version: 1,
        }),
      ).toMatchObject({ success: true })
    }

    const refreshed = await wahaHealthRegistryCreate({
      configuration,
      healthPort: {
        check: async () => resultCreate({ sessions: [{ name: "present", status: "WORKING" }], status: "ok" }),
      },
      repository,
      runtime: { now: () => now },
    }).refresh()

    expect(refreshed).toEqual({ success: true, data: undefined })
    expect(repository.wahaHealthCandidateList()).toMatchObject({
      success: true,
      data: [
        { endpointId: "primary", expiresAt: now, sessionName: "gone-delivery", status: "unhealthy" },
        { endpointId: "primary", expiresAt: now, sessionName: "gone-healthy", status: "unhealthy" },
        { endpointId: "primary", expiresAt: now, sessionName: "gone-old-unhealthy", status: "unhealthy" },
        { endpointId: "primary", expiresAt: now, sessionName: "gone-unknown", status: "unhealthy" },
        {
          endpointId: "primary",
          expiresAt: now + configuration.freshnessTtlMs,
          sessionName: "present",
          status: "healthy",
        },
      ],
    })
    expect(repository.wahaHealthCandidateGet("primary", "gone-delivery")).toMatchObject({
      success: true,
      data: { failureAt: now + 1_000, failureCode: "waha.delivery-failed" },
    })
  })
})

test("WAHA health refresh does not overwrite a concurrent delivery failure", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const created = repository.wahaHealthCandidateCreate({
      checkedAt: now,
      createdAt: now,
      endpointId: "primary",
      expiresAt: now + 60_000,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "default",
      status: "healthy",
      updatedAt: now,
      version: 1,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const deliveryRegistry = wahaHealthRegistryCreate({
      configuration,
      healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
      repository,
      runtime: { now: () => now + 1_000 },
    })
    let listCalls = 0
    let marked: ReturnType<typeof deliveryRegistry.markUnhealthy> | undefined
    const refreshRepository = {
      ...repository,
      wahaHealthCandidateList: () => {
        const rows = repository.wahaHealthCandidateList()
        listCalls += 1
        if (listCalls === 2 && rows.success) {
          marked = deliveryRegistry.markUnhealthy({
            endpointId: "primary",
            expectedVersion: rows.data[0]?.version ?? 0,
            sessionName: "default",
          })
        }
        return rows
      },
    }
    const refreshing = wahaHealthRegistryCreate({
      configuration,
      healthPort: {
        check: async () => resultCreate({ sessions: [{ name: "default", status: "WORKING" }], status: "ok" }),
      },
      repository: refreshRepository,
      runtime: { now: () => now },
    }).refresh()

    expect(await refreshing).toEqual({ success: true, data: undefined })
    expect(marked).toMatchObject({ success: true, data: { status: "unhealthy", failureCode: "waha.delivery-failed" } })
    expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
      success: true,
      data: { failureCode: "waha.delivery-failed", status: "unhealthy", version: 2 },
    })
  })
})

test("WAHA health lifecycle starts immediately, refreshes periodically, and stops cleanly", async () => {
  let refreshes = 0
  let timerHandler: (() => void) | undefined
  let cleared = 0
  const lifecycle = wahaHealthRefreshLifecycleCreate({
    clearInterval: () => {
      cleared += 1
    },
    intervalMs: 100,
    refresh: async () => {
      refreshes += 1
      return resultCreate(undefined)
    },
    setInterval: (handler) => {
      timerHandler = handler
      return 1
    },
  })

  await lifecycle.start()
  expect(refreshes).toBe(1)
  timerHandler?.()
  await Promise.resolve()
  expect(refreshes).toBe(2)
  lifecycle.stop()
  lifecycle.stop()
  timerHandler?.()
  expect(cleared).toBe(1)
  expect(refreshes).toBe(2)
})

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-refresh-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"))
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}
