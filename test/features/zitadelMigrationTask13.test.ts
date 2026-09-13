import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("task 13 migration conformance: convergence, authoritative matrix, redaction, and atomic invalid input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-zitadel-task13-"))
  const kit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), kit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) return
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "task13.example", name: "Task 13" },
    runtime: kit.runtime,
  })
  expect(realm.success).toBe(true)
  if (!realm.success) return
  try {
    const snapshot = JSON.parse(
      await readFile(join(import.meta.dir, "../fixtures/zitadel-migration-snapshot.json"), "utf8"),
    ) as Record<string, any>
    const first = zitadelMigrationImport({ database: opened.data, realmId: realm.data.realm.id, snapshot })
    expect(first.success).toBe(true)
    if (!first.success) return
    const second = zitadelMigrationImport({ database: opened.data, realmId: realm.data.realm.id, snapshot })
    expect(second).toMatchObject({ success: true, data: { deleted: 0, stale: 0 } })
    expect(JSON.stringify(first.data)).not.toMatch(/clientSecret|credentialSecret|accessToken|refreshToken/i)

    const incomplete = structuredClone(snapshot)
    incomplete.users = []
    incomplete.completeness.users = { complete: false, count: 0 }
    const preserved = zitadelMigrationImport({
      database: opened.data,
      realmId: realm.data.realm.id,
      snapshot: incomplete,
    })
    expect(preserved.success).toBe(true)
    expect(preserved.success && preserved.data.deleted).toBe(0)

    const nonAuthoritative = structuredClone(snapshot)
    nonAuthoritative.users = []
    nonAuthoritative.organizations = []
    nonAuthoritative.completeness.users = { complete: true, count: 0 }
    nonAuthoritative.completeness.organizations = { complete: true, count: 0 }
    expect(
      zitadelMigrationImport({
        database: opened.data,
        realmId: realm.data.realm.id,
        snapshot: nonAuthoritative,
        authoritative: false,
      }),
    ).toMatchObject({ success: true, data: { deleted: 0 } })
    const authoritative = zitadelMigrationImport({
      authoritative: true,
      database: opened.data,
      realmId: realm.data.realm.id,
      snapshot: nonAuthoritative,
    })
    expect(authoritative.success).toBe(true)
    expect(
      zitadelMigrationSourceRecordRepositoryCreate(opened.data.db).sourceRecordList(
        realm.data.realm.id,
        snapshot.sourceInstance,
      ),
    ).toMatchObject({ success: true })
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
})
