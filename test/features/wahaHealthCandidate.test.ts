import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { wahaHealthCandidateRepositoryCreate } from "../../src/features/waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-health-"))
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

async function withDatabasePair<T>(
  operation: (first: StorageDatabase, second: StorageDatabase) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-health-concurrent-"))
  const path = join(directory, "authworks.sqlite")
  const first = storageDatabaseOpen(path)
  expect(first.success).toBe(true)
  if (!first.success) throw new Error(first.errorMessage)
  const second = storageDatabaseOpen(path)
  expect(second.success).toBe(true)
  if (!second.success) {
    first.data.close()
    throw new Error(second.errorMessage)
  }
  try {
    return await operation(first.data, second.data)
  } finally {
    first.data.close()
    second.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

test("WAHA health candidates persist state, failures, freshness, and optimistic versions", async () => {
  await withDatabase(async (database) => {
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const created = repository.wahaHealthCandidateCreate({
      checkedAt: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      endpointId: "primary",
      expiresAt: 1_700_000_060_000,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "default",
      status: "healthy",
      updatedAt: 1_700_000_000_000,
      version: 1,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.version).toBe(1)

    const fresh = repository.wahaHealthCandidateListFreshHealthy(1_700_000_030_000)
    expect(fresh).toMatchObject({ success: true, data: [{ endpointId: "primary", sessionName: "default" }] })
    expect(repository.wahaHealthCandidateListFreshHealthy(1_700_000_060_000)).toMatchObject({
      success: true,
      data: [],
    })

    const updated = repository.wahaHealthCandidateUpdate("primary", "default", 1, {
      checkedAt: 1_700_000_060_000,
      expiresAt: 1_700_000_120_000,
      failureAt: 1_700_000_060_000,
      failureCode: "waha.delivery-failed",
      failureMessage: "The message could not be delivered.",
      status: "unhealthy",
      updatedAt: 1_700_000_060_000,
    })
    expect(updated).toMatchObject({
      success: true,
      data: {
        failureCode: "waha.delivery-failed",
        failureMessage: "The message could not be delivered.",
        status: "unhealthy",
        version: 2,
      },
    })
    expect(repository.wahaHealthCandidateUpdate("primary", "default", 1, { status: "healthy" })).toEqual({
      code: "waha.conflict",
      errorMessage: "The WAHA health candidate was changed by another operation.",
      op: "wahaHealthCandidateUpdate",
      success: false,
    })
  })
})

test("WAHA unhealthy marking rejects a stale version without overwriting a refresh", async () => {
  await withDatabase(async (database) => {
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const created = repository.wahaHealthCandidateCreate({
      checkedAt: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      endpointId: "primary",
      expiresAt: 1_700_000_060_000,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "default",
      status: "healthy",
      updatedAt: 1_700_000_000_000,
      version: 1,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const refreshed = repository.wahaHealthCandidateUpdate("primary", "default", created.data.version, {
      checkedAt: 1_700_000_001_000,
      expiresAt: 1_700_060_001_000,
      status: "healthy",
      updatedAt: 1_700_000_001_000,
    })
    expect(refreshed.success).toBe(true)
    expect(
      repository.wahaHealthCandidateMarkUnhealthy("primary", "default", {
        expectedVersion: created.data.version,
        failureAt: 1_700_000_002_000,
        failureCode: "waha.delivery-failed",
        failureMessage: "The WhatsApp message could not be delivered.",
        updatedAt: 1_700_000_002_000,
      }),
    ).toEqual({
      code: "waha.conflict",
      errorMessage: "The WAHA health candidate was changed by another operation.",
      op: "wahaHealthCandidateMarkUnhealthy",
      success: false,
    })
    expect(repository.wahaHealthCandidateGet("primary", "default")).toMatchObject({
      success: true,
      data: { status: "healthy", version: 2 },
    })
  })
})

test("WAHA health candidates preserve unknown discovery state until a health result is available", async () => {
  await withDatabase(async (database) => {
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const unknown = repository.wahaHealthCandidateCreateOrUpdate({
      checkedAt: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      endpointId: "primary",
      expiresAt: 1_700_000_060_000,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "default",
      status: "unknown",
      updatedAt: 1_700_000_000_000,
      version: 1,
    })

    expect(unknown).toMatchObject({ success: true, data: { status: "unknown", version: 1 } })
    expect(repository.wahaHealthCandidateListFreshHealthy(1_700_000_030_000)).toEqual({ success: true, data: [] })
  })
})

test("WAHA health candidate discovery atomically creates or updates duplicate keys", async () => {
  await withDatabase(async (database) => {
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const input = {
      checkedAt: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      endpointId: "primary",
      expiresAt: 1_700_000_060_000,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "default",
      status: "unknown" as const,
      updatedAt: 1_700_000_000_000,
      version: 1,
    }

    const first = repository.wahaHealthCandidateCreateOrUpdate(input)
    const second = repository.wahaHealthCandidateCreateOrUpdate({
      ...input,
      checkedAt: 1_700_000_001_000,
      status: "healthy",
      updatedAt: 1_700_000_001_000,
    })

    expect(first.success).toBe(true)
    expect(second).toMatchObject({ success: true, data: { status: "healthy", version: 2 } })
    expect(repository.wahaHealthCandidateList()).toMatchObject({
      success: true,
      data: [
        { createdAt: 1_700_000_000_000, endpointId: "primary", sessionName: "default", status: "healthy", version: 2 },
      ],
    })
  })
})

test("WAHA health candidate discovery serializes duplicate keys across concurrent database handles", async () => {
  await withDatabasePair(async (first, second) => {
    const firstRepository = wahaHealthCandidateRepositoryCreate(first.db)
    const secondRepository = wahaHealthCandidateRepositoryCreate(second.db)
    const input = {
      checkedAt: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      endpointId: "primary",
      expiresAt: 1_700_000_060_000,
      failureAt: null,
      failureCode: null,
      failureMessage: null,
      sessionName: "default",
      status: "unknown" as const,
      updatedAt: 1_700_000_000_000,
      version: 1,
    }

    const discoveries = await Promise.all([
      new Promise<ReturnType<typeof firstRepository.wahaHealthCandidateCreateOrUpdate>>((resolve) =>
        setTimeout(() => resolve(firstRepository.wahaHealthCandidateCreateOrUpdate(input)), 0),
      ),
      new Promise<ReturnType<typeof secondRepository.wahaHealthCandidateCreateOrUpdate>>((resolve) =>
        setTimeout(
          () =>
            resolve(
              secondRepository.wahaHealthCandidateCreateOrUpdate({
                ...input,
                status: "healthy",
              }),
            ),
          0,
        ),
      ),
    ])

    expect(discoveries.every((discovery) => discovery.success)).toBe(true)
    const candidates = firstRepository.wahaHealthCandidateList()
    expect(candidates).toMatchObject({
      success: true,
      data: [{ endpointId: "primary", sessionName: "default", version: 2 }],
    })
  })
})

test("WAHA health candidate storage has no credential columns and enforces its status values", async () => {
  await withDatabase(async (database) => {
    const columns = database.sqlite.query("PRAGMA table_info(waha_health_candidates)").all() as Array<{ name: string }>
    expect(columns.map(({ name }) => name)).not.toContain("api_key")
    expect(() =>
      database.sqlite.run(
        "INSERT INTO waha_health_candidates (endpoint_id, session_name, status, checked_at, expires_at, created_at, updated_at, version) VALUES ('primary', 'default', 'working', 0, 0, 0, 0, 1)",
      ),
    ).toThrow()
  })
})
