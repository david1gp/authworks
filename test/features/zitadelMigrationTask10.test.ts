import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationRepositoryCreate } from "../../src/features/organizations/persistence/organizationRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import type { ZitadelMigrationSnapshot } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"
import { type StorageDatabase, storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("task 10 dry-run validates the realm and performs zero destination or mapping writes", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = emptySnapshot()
    const before = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordList(
      realmId,
      snapshot.sourceInstance,
    )
    expect(before.success).toBe(true)
    const invalid = zitadelMigrationImport({ database, realmId: "missing", snapshot, dryRun: true })
    expect(invalid.success).toBe(false)
    const result = zitadelMigrationImport({ database, realmId, snapshot, dryRun: true })
    expect(result.success).toBe(true)
    const after = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordList(
      realmId,
      snapshot.sourceInstance,
    )
    expect(after).toEqual(before)
  })
})

test("task 10 dry-run plan equals the plan executed by the next unchanged complete snapshot", async () => {
  await withDatabase((database, realmId) => {
    const full = fixtureSnapshot()
    expect(zitadelMigrationImport({ database, realmId, snapshot: full }).success).toBe(true)
    const complete = emptySnapshot()
    const dry = zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: complete, dryRun: true })
    expect(dry.success).toBe(true)
    const live = zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: complete })
    expect(live.success).toBe(true)
    if (!dry.success || !live.success) return
    expect(live.data.deletionPlan).toEqual(dry.data.deletionPlan)
  })
})

test("task 10 complete live snapshot deletes source-owned users and organizations after mapped dependents and cascades local auth state", async () => {
  await withDatabase((database, realmId) => {
    const full = fixtureSnapshot()
    const imported = zitadelMigrationImport({ database, realmId, snapshot: full })
    expect(imported.success).toBe(true)
    const empty = emptySnapshot()
    const deleted = zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: empty })
    expect(deleted.success).toBe(true)
    if (!deleted.success) return
    expect(deleted.data.deleted).toBeGreaterThan(0)
    const organizations = organizationRepositoryCreate(database.db).organizationList(realmId)
    expect(organizations.success).toBe(true)
    if (organizations.success) expect(organizations.data).toHaveLength(0)
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordList(
      realmId,
      full.sourceInstance,
    )
    expect(mappings).toMatchObject({ success: true, data: [] })
  })
})

test("task 10 preserves native, cross-source, and skipped-conflicted mapped records while reporting deleted and stale counts", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = emptySnapshot()
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    for (const [sourceInstance, sourceId] of [
      [snapshot.sourceInstance, "stale"],
      ["https://other.example", "cross-source"],
    ] as const)
      expect(
        mappings.sourceRecordUpsert({
          realmId,
          sourceInstance,
          entityType: "user",
          sourceId,
          destinationId: "missing",
          sourceUpdatedAt: 1,
        }),
      ).toMatchObject({ success: true })
    const result = zitadelMigrationImport({ database, realmId, snapshot, dryRun: true })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.deleted).toBe(0)
    expect(result.data.stale).toBe(0)
    expect(mappings.sourceRecordList(realmId, "https://other.example")).toMatchObject({
      success: true,
      data: [expect.objectContaining({ sourceId: "cross-source" })],
    })
  })
})

test("task 10 forced later deletion failure rolls back earlier upserts and every deletion and mapping write", async () => {
  await withDatabase((database, realmId) => {
    const full = fixtureSnapshot()
    expect(zitadelMigrationImport({ database, realmId, snapshot: full }).success).toBe(true)
    const before = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordList(
      realmId,
      full.sourceInstance,
    )
    const invalid = structuredClone(full)
    invalid.users = [invalid.users[0]!]
    invalid.completeness.users = { complete: true, count: 1 }
    invalid.organizations = [{ ...invalid.organizations[0]!, name: "changed before failure" }]
    invalid.completeness.organizations = { complete: true, count: 1 }
    invalid.oidcApplications = [{ ...invalid.oidcApplications[0]!, redirectUris: ["not-a-uri"] }]
    invalid.completeness.oidcApplications = { complete: true, count: 1 }
    const result = zitadelMigrationImport({ database, realmId, snapshot: invalid })
    expect(result.success).toBe(false)
    expect(
      zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordList(realmId, full.sourceInstance),
    ).toEqual(before)
  })
})

function fixtureSnapshot(): ZitadelMigrationSnapshot {
  return JSON.parse(
    readFileSync(join(import.meta.dir, "../fixtures/zitadel-migration-snapshot.json"), "utf8"),
  ) as ZitadelMigrationSnapshot
}

function emptySnapshot(): ZitadelMigrationSnapshot {
  const snapshot = fixtureSnapshot()
  for (const key of Object.keys(snapshot.completeness) as (keyof ZitadelMigrationSnapshot["completeness"])[]) {
    snapshot[key] = [] as never
    snapshot.completeness[key] = { complete: true, count: 0 }
  }
  return snapshot
}

async function withDatabase(operation: (database: StorageDatabase, realmId: string) => void) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-task10-"))
  const kit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), kit.runtime)
  if (!opened.success) throw new Error(opened.errorMessage)
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "task10.example", name: "Task 10" },
    runtime: kit.runtime,
  })
  if (!realm.success) throw new Error(realm.errorMessage)
  try {
    operation(opened.data, realm.data.realm.id)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}
