import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { zitadelMigrationDeletionExecute } from "../../src/features/zitadelMigration/actions/zitadelMigrationDeletionExecute.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"
import { realmTable } from "../../src/features/realms/persistence/realmTable.js"

const types = [
  "externalIdentityLink",
  "identityProvider",
  "machineUser",
  "projectGrant",
  "projectRole",
  "oidcClient",
  "projectApplication",
  "organizationMembership",
  "domain",
  "loginPolicy",
  "project",
  "user",
  "organization",
] as const

test("deletion execute dispatches every entity in canonical order and purges stale mappings", async () => {
  await withDatabase((database) => {
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    const entries = [...types].reverse().map((entityType) => {
      const sourceId = `source-${entityType}`
      mappings.sourceRecordUpsert({
        realmId: "realm",
        sourceInstance: "HTTPS://EXAMPLE.test/",
        entityType,
        sourceId,
        destinationId: `destination-${entityType}`,
        sourceVersion: null,
        sourceUpdatedAt: null,
      })
      return {
        entityType,
        sourceId,
        destinationId: `destination-${entityType}`,
        reason: "absent-from-complete-collection" as const,
      }
    })
    const result = zitadelMigrationDeletionExecute(
      { entries, omissions: [] },
      database,
      "realm",
      "https://example.test",
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.stale).toBe(types.length)
    expect(mappingCount(mappings.sourceRecordList("realm", "https://example.test"))).toBe(0)
  })
})

test("deletion execute rejects malformed plans without writes and isolates mismatches", async () => {
  await withDatabase((database) => {
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    mappings.sourceRecordUpsert({
      realmId: "other",
      sourceInstance: "https://example.test",
      entityType: "project",
      sourceId: "p",
      destinationId: "d",
      sourceVersion: null,
      sourceUpdatedAt: null,
    })
    const malformed = zitadelMigrationDeletionExecute(
      {
        entries: [
          { entityType: "project", sourceId: "", destinationId: "d", reason: "absent-from-complete-collection" },
        ],
        omissions: [],
      },
      database,
      "realm",
      "https://example.test",
    )
    expect(malformed.success).toBe(false)
    expect(mappingCount(mappings.sourceRecordList("other", "https://example.test"))).toBe(1)
    const wrongRealm = zitadelMigrationDeletionExecute(
      {
        entries: [
          { entityType: "project", sourceId: "p", destinationId: "d", reason: "absent-from-complete-collection" },
        ],
        omissions: [],
      },
      database,
      "realm",
      "https://example.test",
    )
    expect(wrongRealm.success).toBe(false)
    expect(mappingCount(mappings.sourceRecordList("other", "https://example.test"))).toBe(1)
  })
})

test("deletion execute rolls back mapping cleanup when a later dispatch fails", async () => {
  await withDatabase((database) => {
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    mappings.sourceRecordUpsert({
      realmId: "realm",
      sourceInstance: "https://example.test",
      entityType: "project",
      sourceId: "first",
      destinationId: "first",
      sourceVersion: null,
      sourceUpdatedAt: null,
    })
    mappings.sourceRecordUpsert({
      realmId: "realm",
      sourceInstance: "https://example.test",
      entityType: "organization",
      sourceId: "second",
      destinationId: "second",
      sourceVersion: null,
      sourceUpdatedAt: null,
    })
    const result = zitadelMigrationDeletionExecute(
      {
        entries: [
          {
            entityType: "project",
            sourceId: "first",
            destinationId: "first",
            reason: "absent-from-complete-collection",
          },
          {
            entityType: "organization",
            sourceId: "second",
            destinationId: "wrong",
            reason: "absent-from-complete-collection",
          },
        ],
        omissions: [],
      },
      database,
      "realm",
      "https://example.test",
    )
    expect(result.success).toBe(false)
    expect(mappingCount(mappings.sourceRecordList("realm", "https://example.test"))).toBe(2)
  })
})

async function withDatabase(run: (database: StorageDatabase) => void) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-zitadel-delete-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  if (!opened.success) throw new Error("database open failed")
  const database = (opened as { success: true; data: StorageDatabase }).data
  database.db
    .insert(realmTable)
    .values({
      id: "realm",
      name: "Realm",
      primaryDomain: "realm.example",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
      version: 1,
      bootstrapAdminId: null,
      bootstrapCompletedAt: null,
    })
    .run()
  database.db
    .insert(realmTable)
    .values({
      id: "other",
      name: "Other",
      primaryDomain: "other.example",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
      version: 1,
      bootstrapAdminId: null,
      bootstrapCompletedAt: null,
    })
    .run()
  try {
    run(database)
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
}

function mappingCount(
  result: ReturnType<ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>["sourceRecordList"]>,
): number {
  return result.success ? result.data.length : -1
}
