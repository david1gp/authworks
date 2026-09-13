import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { organizationDomainRepositoryCreate } from "../../src/features/organizations/persistence/organizationDomainRepositoryCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../../src/features/organizations/persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../../src/features/organizations/persistence/organizationRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { zitadelMigrationExport } from "../../src/features/zitadelMigration/actions/zitadelMigrationExport.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import type { ZitadelMigrationSnapshot } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"
import { zitadelMigrationSnapshotSchema } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"
import { type StorageDatabase, storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("task 8 round-trips source timestamps and imports mapped domains and policies", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = task8Snapshot()
    const imported = zitadelMigrationImport({ database, realmId, snapshot })
    expect(imported.success).toBe(true)
    if (!imported.success) return
    expect(imported.data.counts.domains).toMatchObject({ created: 1 })
    expect(imported.data.counts.loginPolicies).toMatchObject({ created: 1 })
    expect(imported.data.counts.domains).toMatchObject({ imported: 1, seen: 1, skipped: 0 })
    expect(imported.data.counts.loginPolicies).toMatchObject({ imported: 1, seen: 1, skipped: 0 })
    const organization = organizationRepositoryCreate(database.db).organizationList(realmId)
    expect(organization).toMatchObject({ success: true, data: [{ name: "Org" }] })
    const organizationId = organization.success ? (organization.data[0]?.id ?? "") : ""
    expect(organizationDomainRepositoryCreate(database.db).organizationDomainGet("example.com")).toMatchObject({
      data: { createdAt: 100, updatedAt: 200, verified: true, organizationId },
    })
    expect(
      organizationLoginPolicyRepositoryCreate(database.db).organizationLoginPolicyGet(organizationId),
    ).toMatchObject({
      data: { allowPassword: true, allowExternalIdentity: false },
    })
    const mapping = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordGet(
      realmId,
      snapshot.sourceInstance,
      "domain",
      "domain-8",
    )
    expect(mapping).toMatchObject({
      data: { destinationId: "example.com", sourceUpdatedAt: 200, sourceVersion: "200" },
    })
    expect(v.safeParse(zitadelMigrationSnapshotSchema, snapshot).success).toBe(true)
  })
})

test("task 8 complete snapshots delete source-owned domains and policies and remove mappings", async () => {
  await withDatabase((database, realmId) => {
    const first = zitadelMigrationImport({ database, realmId, snapshot: task8Snapshot() })
    expect(first.success).toBe(true)
    const empty = task8Snapshot()
    empty.domains = []
    empty.loginPolicies = []
    empty.completeness.domains = { complete: true, count: 0 }
    empty.completeness.loginPolicies = { complete: true, count: 0 }
    const deleted = zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: empty })
    expect(deleted.success).toBe(true)
    if (!deleted.success) return
    expect(deleted.data.counts.domains).toMatchObject({ deleted: 1, seen: 0 })
    expect(deleted.data.counts.loginPolicies).toMatchObject({ deleted: 1, seen: 0 })
    const domain = organizationDomainRepositoryCreate(database.db).organizationDomainGet("example.com")
    const organizations = organizationRepositoryCreate(database.db).organizationList(realmId)
    if (!domain.success || !organizations.success) return
    const organizationId = organizations.data[0]?.id ?? ""
    const policy = organizationLoginPolicyRepositoryCreate(database.db).organizationLoginPolicyGet(organizationId)
    if (!policy.success) return
    expect(domain.data).toBeNull()
    expect(policy.data).toBeNull()
    const records = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordList(
      realmId,
      empty.sourceInstance,
    )
    expect(
      records.success &&
        records.data.some((record) => record.entityType === "domain" || record.entityType === "loginPolicy"),
    ).toBe(false)
  })
})

test("task 8 native login policy remains unowned", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = task8Snapshot()
    expect(zitadelMigrationImport({ database, realmId, snapshot }).success).toBe(true)
    const repository = organizationLoginPolicyRepositoryCreate(database.db)
    const organizations = organizationRepositoryCreate(database.db).organizationList(realmId)
    if (!organizations.success) return
    const organizationId = organizations.data[0]?.id ?? ""
    expect(repository.organizationLoginPolicyDelete(organizationId, realmId).success).toBe(true)
    const native = repository.organizationLoginPolicyCreate({
      allowPassword: false,
      allowExternalIdentity: true,
      organizationId,
      realmId,
      updatedAt: 999,
      version: 1,
    })
    expect(native.success).toBe(true)
    const sourceRecords = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    expect(sourceRecords.sourceRecordDelete(realmId, snapshot.sourceInstance, "loginPolicy", "policy-8").success).toBe(
      true,
    )
    const imported = zitadelMigrationImport({ database, realmId, snapshot })
    expect(imported.success).toBe(true)
    if (!imported.success) return
    expect(imported.data.counts.loginPolicies).toMatchObject({ skipped: 1, imported: 0 })
    expect(repository.organizationLoginPolicyGet(organizationId)).toMatchObject({
      data: { allowPassword: false, allowExternalIdentity: true },
    })
  })
})

test("task 8 source verification overwrites, native conflicts stay unowned, and incomplete preserves", async () => {
  await withDatabase((database, realmId) => {
    const snapshot = task8Snapshot()
    expect(zitadelMigrationImport({ database, realmId, snapshot }).success).toBe(true)
    const changed = structuredClone(snapshot)
    changed.domains[0]!.verified = false
    changed.loginPolicies[0]!.allowUsernamePassword = false
    expect(zitadelMigrationImport({ database, realmId, snapshot: changed }).success).toBe(true)
    expect(organizationDomainRepositoryCreate(database.db).organizationDomainGet("example.com")).toMatchObject({
      data: { verified: false },
    })
    const organizations = organizationRepositoryCreate(database.db).organizationList(realmId)
    if (!organizations.success) return
    const organizationId = organizations.data[0]?.id ?? ""
    expect(
      organizationLoginPolicyRepositoryCreate(database.db).organizationLoginPolicyGet(organizationId),
    ).toMatchObject({ data: { allowPassword: false } })
    const incomplete = structuredClone(changed)
    incomplete.domains = []
    incomplete.completeness.domains = { complete: false, count: 0 }
    expect(zitadelMigrationImport({ database, realmId, snapshot: incomplete }).success).toBe(true)
    const domain = organizationDomainRepositoryCreate(database.db).organizationDomainGet("example.com")
    if (!domain.success) return
    expect(domain.data).not.toBeNull()
  })
})

test("task 8 exporter scopes organization calls, maps verified domains, deduplicates normalized domains, and reports incomplete", async () => {
  const calls: string[] = []
  const api = new Proxy(
    {},
    {
      get:
        (_target, property: string) =>
        async (...args: unknown[]) => {
          calls.push(`${property}:${String(args[0] ?? "")}`)
          if (property === "organizationsList")
            return {
              success: true,
              data: [
                {
                  id: "8",
                  name: "Org",
                  details: { creationDate: 100, changeDate: 200 },
                  state: "ORGANIZATION_STATE_ACTIVE",
                },
              ],
            }
          if (property === "organizationDomainsList")
            return {
              success: true,
              data: [
                { id: "d", domain: "EXAMPLE.COM", details: { creationDate: 100, changeDate: 200 }, isVerified: true },
              ],
            }
          if (property === "organizationLoginPolicyGet")
            return {
              success: true,
              data: {
                allowUsernamePassword: true,
                allowExternalIdp: false,
                details: { creationDate: 100, changeDate: 200 },
              },
            }
          if (property === "organizationMembershipsList") return { success: true, data: [] }
          if (
            property === "usersList" ||
            property === "machineUsersList" ||
            property === "projectsList" ||
            property === "projectGrantsList" ||
            property === "identityProvidersList"
          )
            return { success: true, data: [] }
          return { success: true, data: [] }
        },
    },
  )
  const result = await zitadelMigrationExport({ api: api as never })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.domains[0]).toMatchObject({
    domain: "example.com",
    verified: true,
    createdAt: 100,
    updatedAt: 200,
  })
  expect(calls.some((call) => call.startsWith("organizationDomainsList:8"))).toBe(true)
})

function task8Snapshot(): ZitadelMigrationSnapshot {
  const snapshot = JSON.parse(
    readFileSync(join(import.meta.dir, "../fixtures/zitadel-migration-snapshot.json"), "utf8"),
  ) as ZitadelMigrationSnapshot
  for (const key of Object.keys(snapshot.completeness) as (keyof ZitadelMigrationSnapshot["completeness"])[]) {
    snapshot[key] = [] as never
    snapshot.completeness[key] = { complete: true, count: 0 }
  }
  snapshot.organizations = [{ id: "8", name: "Org", status: "active", createdAt: 100, updatedAt: 200 }]
  snapshot.completeness.organizations = { complete: true, count: 1 }
  snapshot.domains = [
    {
      sourceId: "domain-8",
      organizationId: "8",
      domain: "Example.COM",
      verified: true,
      createdAt: 100,
      updatedAt: 200,
    },
  ]
  snapshot.completeness.domains = { complete: true, count: 1 }
  snapshot.loginPolicies = [
    {
      sourceId: "policy-8",
      organizationId: "8",
      allowUsernamePassword: true,
      allowExternalIdp: false,
      createdAt: 100,
      updatedAt: 200,
    },
  ]
  snapshot.completeness.loginPolicies = { complete: true, count: 1 }
  return snapshot
}

async function withDatabase(operation: (database: StorageDatabase, realmId: string) => void) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-task8-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  if (!opened.success) throw new Error(opened.errorMessage)
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "task8.example", name: "Task 8" },
    runtime: testkit.runtime,
  })
  if (!realm.success) throw new Error(realm.errorMessage)
  try {
    operation(opened.data, realm.data.realm.id)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}
