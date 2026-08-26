import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { wahaHealthCandidateRepositoryCreate } from "../../src/features/waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import { wahaHealthCandidateSelectorCreate } from "../../src/features/waha/server/wahaHealthCandidateSelectorCreate.js"
import { wahaHealthRegistryCreate } from "../../src/features/waha/server/wahaHealthRegistryCreate.js"
import type { WahaConfiguration } from "../../src/features/waha/server/wahaConfiguration.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

test("WAHA selection uses only fresh healthy persisted candidates and injected randomness", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    for (const [endpointId, status, expiresAt] of [
      ["alpha", "healthy", now + 60_000],
      ["bravo", "healthy", now + 60_000],
      ["charlie", "healthy", now + 60_000],
      ["expired", "healthy", now],
      ["unhealthy", "unhealthy", now + 60_000],
    ] as const) {
      expect(
        repository.wahaHealthCandidateCreate({
          checkedAt: now,
          createdAt: now,
          endpointId,
          expiresAt,
          failureAt: status === "healthy" ? null : now,
          failureCode: status === "healthy" ? null : "waha.health-failed",
          failureMessage: status === "healthy" ? null : "The health check failed.",
          sessionName: "default",
          status,
          updatedAt: now,
          version: 1,
        }),
      ).toMatchObject({ success: true })
    }

    const randomCalls: number[] = []
    const selector = wahaHealthCandidateSelectorCreate({
      repository,
      runtime: {
        now: () => now,
        randomBytes: (length) => {
          randomCalls.push(length)
          return new Uint8Array([0, 0, 0, 2])
        },
      },
    })

    expect(selector.select()).toMatchObject({
      success: true,
      data: { endpointId: "charlie", sessionName: "default", status: "healthy" },
    })
    expect(randomCalls).toEqual([4])
  })
})

test("WAHA selection excludes the first candidate during fallback by endpoint and session", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    for (const [endpointId, sessionName] of [
      ["alpha", "default"],
      ["alpha", "backup"],
      ["bravo", "default"],
    ] as const) {
      expect(
        repository.wahaHealthCandidateCreate({
          checkedAt: now,
          createdAt: now,
          endpointId,
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

    const selector = wahaHealthCandidateSelectorCreate({
      repository,
      runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
    })

    expect(selector.select([{ endpointId: "alpha", sessionName: "default" }])).toMatchObject({
      success: true,
      data: { endpointId: "alpha", sessionName: "backup", status: "healthy" },
    })
    expect(selector.select([{ endpointId: "alpha", sessionName: "backup" }])).toMatchObject({
      success: true,
      data: { endpointId: "alpha", sessionName: "default", status: "healthy" },
    })
  })
})

test("WAHA selection cannot select a session excluded during health refresh", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const configuration: WahaConfiguration = {
      endpoints: [
        {
          client: { baseUrl: "https://waha.example.test" },
          id: "primary",
          senderSessions: ["sender"],
        },
      ],
      freshnessTtlMs: 60_000,
      refreshIntervalMs: 30_000,
    }
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    expect(
      repository.wahaHealthCandidateCreate({
        checkedAt: now,
        createdAt: now,
        endpointId: "primary",
        expiresAt: now + 60_000,
        failureAt: null,
        failureCode: null,
        failureMessage: null,
        sessionName: "recipient",
        status: "healthy",
        updatedAt: now,
        version: 1,
      }),
    ).toMatchObject({ success: true })

    const registry = wahaHealthRegistryCreate({
      configuration,
      healthPort: {
        check: async () =>
          resultCreate({
            sessions: [
              { name: "sender", status: "WORKING" },
              { name: "recipient", status: "WORKING" },
            ],
            status: "ok",
          }),
      },
      repository,
      runtime: { now: () => now },
    })
    expect(await registry.refresh()).toMatchObject({ success: true })

    const selector = wahaHealthCandidateSelectorCreate({
      repository,
      runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0, 0]) },
    })
    expect(selector.select()).toMatchObject({
      success: true,
      data: { endpointId: "primary", sessionName: "sender", status: "healthy" },
    })
    expect(repository.wahaHealthCandidateGet("primary", "recipient")).toMatchObject({
      success: true,
      data: { expiresAt: now, status: "unhealthy" },
    })
  })
})

test("WAHA selection rejects a biased random tail before choosing an index", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    for (const endpointId of ["alpha", "bravo", "charlie"]) {
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

    const randomValues = [new Uint8Array([255, 255, 255, 255]), new Uint8Array([0, 0, 0, 3])]
    const selector = wahaHealthCandidateSelectorCreate({
      repository,
      runtime: {
        now: () => now,
        randomBytes: () => randomValues.shift() ?? new Uint8Array([0, 0, 0, 0]),
      },
    })

    expect(selector.select()).toMatchObject({
      success: true,
      data: { endpointId: "alpha", sessionName: "default" },
    })
    expect(randomValues).toHaveLength(0)
  })
})

test("WAHA selection returns a typed error for malformed and exhausted random sources", async () => {
  await withDatabase(async (database) => {
    const now = 1_700_000_000_000
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    for (const endpointId of ["alpha", "bravo", "charlie"]) {
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

    const malformed = wahaHealthCandidateSelectorCreate({
      repository,
      runtime: { now: () => now, randomBytes: () => new Uint8Array([0, 0, 0]) },
    })
    expect(malformed.select()).toMatchObject({ code: "waha.internal", success: false })

    const exhausted = wahaHealthCandidateSelectorCreate({
      repository,
      runtime: { now: () => now, randomBytes: () => new Uint8Array([255, 255, 255, 255]) },
    })
    expect(exhausted.select()).toMatchObject({ code: "waha.internal", success: false })
  })
})

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-selection-"))
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
