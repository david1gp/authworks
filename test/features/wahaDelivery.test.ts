import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { wahaChatIdCreate } from "../../src/features/waha/domain/wahaChatIdCreate.js"
import { wahaHealthCandidateRepositoryCreate } from "../../src/features/waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaConfiguration } from "../../src/features/waha/server/wahaConfiguration.js"
import { wahaDeliveryPortCreate } from "../../src/features/waha/server/wahaDeliveryPortCreate.js"
import { wahaHealthRegistryCreate } from "../../src/features/waha/server/wahaHealthRegistryCreate.js"
import { wahaTextDeliveryCreate } from "../../src/features/waha/server/wahaTextDeliveryCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

const configuration: WahaConfiguration = {
  endpoints: [
    {
      client: { apiKey: "server-only-secret", baseUrl: "https://primary.example.test", session: "configured" },
      id: "primary",
    },
    {
      client: { apiKey: "server-only-secret-2", baseUrl: "https://secondary.example.test", session: "configured" },
      id: "secondary",
    },
  ],
  freshnessTtlMs: 60_000,
  refreshIntervalMs: 30_000,
}

test("WAHA chat IDs require canonical E.164 and append @c.us", () => {
  expect(wahaChatIdCreate("+14155552671")).toEqual({ data: "14155552671@c.us", success: true })
  expect(wahaChatIdCreate("14155552671").success).toBe(false)
  expect(wahaChatIdCreate("+1 415 555 2671").success).toBe(false)
  expect(wahaChatIdCreate("+1234567890123456").success).toBe(false)
})

test("WAHA delivery resolves the endpoint credential and explicitly selected session", async () => {
  const originalFetch = globalThis.fetch
  let request: { readonly body: string; readonly headers: Headers; readonly url: string } | undefined
  globalThis.fetch = (async (input, init) => {
    request = {
      body: String(init?.body),
      headers: new Headers(init?.headers),
      url: input.toString(),
    }
    return Response.json({ id: "message-1" })
  }) as typeof fetch

  try {
    const delivery = wahaDeliveryPortCreate({ configuration })
    const sent = await delivery.sendText({
      chatId: "14155552671@c.us",
      endpointId: "primary",
      sessionName: "selected-session",
      text: "Your code is 123456.",
    })
    expect(sent).toEqual({ data: undefined, success: true })
    expect(request).toMatchObject({
      url: "https://primary.example.test/api/sendText",
    })
    expect(JSON.parse(request?.body ?? "{}")).toEqual({
      chatId: "14155552671@c.us",
      session: "selected-session",
      text: "Your code is 123456.",
    })
    expect(request?.headers.get("X-Api-Key")).toBe("server-only-secret")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("WAHA delivery rejects an unknown endpoint with a typed error", async () => {
  const originalFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = (async () => {
    requests += 1
    return Response.json({ id: "unexpected" })
  }) as unknown as typeof fetch

  try {
    const sent = await wahaDeliveryPortCreate({ configuration }).sendText({
      chatId: "14155552671@c.us",
      endpointId: "missing",
      sessionName: "default",
      text: "Your code is 123456.",
    })
    expect(sent).toMatchObject({ code: "waha.not-found", op: "wahaDeliveryPortSendText", success: false })
    expect(requests).toBe(0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("WAHA delivery maps a waha-client failure result to a typed delivery error", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })) as unknown as typeof fetch

  try {
    const sent = await wahaDeliveryPortCreate({ configuration }).sendText({
      chatId: "14155552671@c.us",
      endpointId: "primary",
      sessionName: "default",
      text: "Your code is 123456.",
    })
    expect(sent).toMatchObject({ code: "waha.delivery-failed", op: "wahaDeliveryPortSendText", success: false })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("WAHA delivery maps a thrown client request to a typed delivery error", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (() => {
    throw new Error("network unavailable")
  }) as unknown as typeof fetch

  try {
    const sent = await wahaDeliveryPortCreate({ configuration }).sendText({
      chatId: "14155552671@c.us",
      endpointId: "primary",
      sessionName: "default",
      text: "Your code is 123456.",
    })
    expect(sent).toMatchObject({ code: "waha.delivery-failed", op: "wahaDeliveryPortSendText", success: false })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("WAHA delivery marks a failed candidate and retries one different candidate", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("secondary", now))).toMatchObject({ success: true })

    const originalFetch = globalThis.fetch
    const requests: string[] = []
    globalThis.fetch = (async (input) => {
      requests.push(input.toString())
      if (requests.length === 1) return new Response("unavailable", { status: 503 })
      return Response.json({ id: "message-2" })
    }) as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration,
        healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
        repository,
        runtime: { now: () => now },
      })
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration }),
        healthRegistry: registry,
        repository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })).toEqual({
        data: undefined,
        success: true,
      })
      expect(requests).toEqual([
        "https://primary.example.test/api/sendText",
        "https://secondary.example.test/api/sendText",
      ])
      expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
        success: true,
        data: { failureCode: "waha.delivery-failed", status: "unhealthy" },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA delivery retries at most once and does not retry a single candidate", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })

    const originalFetch = globalThis.fetch
    let requests = 0
    globalThis.fetch = (async () => {
      requests += 1
      return new Response("unavailable", { status: 503 })
    }) as unknown as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration,
        healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
        repository,
        runtime: { now: () => now },
      })
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration }),
        healthRegistry: registry,
        repository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      const sent = await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })
      expect(sent).toMatchObject({ code: "waha.delivery-failed", success: false })
      expect(requests).toBe(1)
      expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
        success: true,
        data: { failureCode: "waha.delivery-failed", status: "unhealthy" },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA delivery retries failure marking after a CAS race that refreshes a candidate", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("secondary", now))).toMatchObject({ success: true })

    let markCalls = 0
    const racedRepository = {
      ...repository,
      wahaHealthCandidateMarkUnhealthy: (
        endpointId: string,
        sessionName: string,
        input: Parameters<typeof repository.wahaHealthCandidateMarkUnhealthy>[2],
      ) => {
        markCalls += 1
        if (markCalls === 1) {
          expect(
            repository.wahaHealthCandidateUpdate(endpointId, sessionName, input.expectedVersion, {
              checkedAt: now,
              expiresAt: now + 60_000,
              status: "healthy",
              updatedAt: now,
            }),
          ).toMatchObject({ success: true })
        }
        return repository.wahaHealthCandidateMarkUnhealthy(endpointId, sessionName, input)
      },
    }

    const originalFetch = globalThis.fetch
    let requests = 0
    globalThis.fetch = (async () => {
      requests += 1
      if (requests === 1) return new Response("unavailable", { status: 503 })
      return Response.json({ id: "message-2" })
    }) as unknown as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration,
        healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
        repository: racedRepository,
        runtime: { now: () => now },
      })
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration }),
        healthRegistry: registry,
        repository: racedRepository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })).toEqual({
        data: undefined,
        success: true,
      })
      expect(markCalls).toBe(2)
      expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
        success: true,
        data: { failureCode: "waha.delivery-failed", status: "unhealthy", version: 3 },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA delivery keeps a concurrent unhealthy state and does not mask the fallback result", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("secondary", now))).toMatchObject({ success: true })

    let markCalls = 0
    const racedRepository = {
      ...repository,
      wahaHealthCandidateMarkUnhealthy: (
        endpointId: string,
        sessionName: string,
        input: Parameters<typeof repository.wahaHealthCandidateMarkUnhealthy>[2],
      ) => {
        markCalls += 1
        if (markCalls === 1) {
          expect(
            repository.wahaHealthCandidateMarkUnhealthy(endpointId, sessionName, {
              ...input,
              expectedVersion: input.expectedVersion,
            }),
          ).toMatchObject({ success: true })
        }
        return repository.wahaHealthCandidateMarkUnhealthy(endpointId, sessionName, input)
      },
    }

    const originalFetch = globalThis.fetch
    let requests = 0
    globalThis.fetch = (async () => {
      requests += 1
      if (requests === 1) return new Response("unavailable", { status: 503 })
      return Response.json({ id: "message-2" })
    }) as unknown as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration,
        healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
        repository: racedRepository,
        runtime: { now: () => now },
      })
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration }),
        healthRegistry: registry,
        repository: racedRepository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })).toEqual({
        data: undefined,
        success: true,
      })
      expect(markCalls).toBe(1)
      expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
        success: true,
        data: { failureCode: "waha.delivery-failed", status: "unhealthy", version: 2 },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA delivery leaves a newer state in place after bounded CAS contention", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("secondary", now))).toMatchObject({ success: true })

    let markCalls = 0
    const racedRepository = {
      ...repository,
      wahaHealthCandidateMarkUnhealthy: (
        endpointId: string,
        sessionName: string,
        input: Parameters<typeof repository.wahaHealthCandidateMarkUnhealthy>[2],
      ) => {
        markCalls += 1
        expect(
          repository.wahaHealthCandidateUpdate(endpointId, sessionName, input.expectedVersion, {
            checkedAt: now,
            expiresAt: now + 60_000,
            status: "healthy",
            updatedAt: now,
          }),
        ).toMatchObject({ success: true })
        return repository.wahaHealthCandidateMarkUnhealthy(endpointId, sessionName, input)
      },
    }

    const originalFetch = globalThis.fetch
    let requests = 0
    globalThis.fetch = (async () => {
      requests += 1
      if (requests === 1) return new Response("unavailable", { status: 503 })
      return Response.json({ id: "message-2" })
    }) as unknown as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration,
        healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
        repository: racedRepository,
        runtime: { now: () => now },
      })
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration }),
        healthRegistry: registry,
        repository: racedRepository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      expect(await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })).toEqual({
        data: undefined,
        success: true,
      })
      expect(markCalls).toBe(2)
      expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
        success: true,
        data: { status: "healthy", version: 3 },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA delivery does not replace a failed send with a failure-mark write error", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("secondary", now))).toMatchObject({ success: true })

    const originalFetch = globalThis.fetch
    let requests = 0
    globalThis.fetch = (async () => {
      requests += 1
      return new Response(`unavailable-${requests}`, { status: 503 })
    }) as unknown as typeof fetch

    try {
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration }),
        healthRegistry: {
          markUnhealthy: () =>
            resultErrorCodedCreate(
              "wahaHealthCandidateMarkUnhealthy",
              "The WAHA health candidate could not be marked unhealthy.",
              "waha.write-failed",
            ),
        },
        repository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      const sent = await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })
      expect(sent).toMatchObject({ code: "waha.delivery-failed", success: false })
      expect(requests).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA delivery returns the fallback failure when both candidates fail", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("secondary", now))).toMatchObject({ success: true })

    const originalFetch = globalThis.fetch
    let requests = 0
    globalThis.fetch = (async () => {
      requests += 1
      return new Response(`unavailable-${requests}`, { status: 503 })
    }) as unknown as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration,
        healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
        repository,
        runtime: { now: () => now },
      })
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration }),
        healthRegistry: registry,
        repository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      const sent = await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })
      expect(sent).toMatchObject({ code: "waha.delivery-failed", success: false })
      if (sent.success) return
      expect(sent.errorMessage).toContain("could not be delivered")
      expect(requests).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test("WAHA delivery attempts no third candidate after a failed fallback", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(repository.wahaHealthCandidateCreate(candidateCreate("primary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("secondary", now))).toMatchObject({ success: true })
    expect(repository.wahaHealthCandidateCreate(candidateCreate("tertiary", now))).toMatchObject({ success: true })
    const threeEndpointConfiguration: WahaConfiguration = {
      ...configuration,
      endpoints: [
        ...configuration.endpoints,
        {
          client: { apiKey: "server-only-secret-3", baseUrl: "https://tertiary.example.test", session: "configured" },
          id: "tertiary",
        },
      ],
    }

    const originalFetch = globalThis.fetch
    const requests: string[] = []
    globalThis.fetch = (async (input) => {
      requests.push(input.toString())
      return new Response("unavailable", { status: 503 })
    }) as typeof fetch

    try {
      const registry = wahaHealthRegistryCreate({
        configuration: threeEndpointConfiguration,
        healthPort: { check: async () => resultCreate({ sessions: [], status: "ok" }) },
        repository,
        runtime: { now: () => now },
      })
      const delivery = wahaTextDeliveryCreate({
        deliveryPort: wahaDeliveryPortCreate({ configuration: threeEndpointConfiguration }),
        healthRegistry: registry,
        repository,
        runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
      })

      const sent = await delivery.sendText({ phoneNumber: "+14155552671", text: "Your code is 123456." })
      expect(sent).toMatchObject({ code: "waha.delivery-failed", success: false })
      expect(requests).toEqual([
        "https://primary.example.test/api/sendText",
        "https://secondary.example.test/api/sendText",
      ])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

function candidateCreate(endpointId: string, now: number) {
  return {
    checkedAt: now,
    createdAt: now,
    endpointId,
    expiresAt: now + 60_000,
    failureAt: null,
    failureCode: null,
    failureMessage: null,
    sessionName: "default",
    status: "healthy" as const,
    updatedAt: now,
    version: 1,
  }
}

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-delivery-"))
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
