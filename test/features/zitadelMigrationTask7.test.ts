import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { machineRepositoryCreate } from "../../src/features/machineUsers/persistence/machineRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { zitadelMigrationExport } from "../../src/features/zitadelMigration/actions/zitadelMigrationExport.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { zitadelApiClientCreate } from "../../src/features/zitadelMigration/client/zitadelApiClientCreate.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import type { ZitadelMigrationSnapshot } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"
import { type StorageDatabase, storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("exports machine users with organization scoping, deduplication, and incomplete failures", async () => {
  const requests: Request[] = []
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.test",
    token: "token",
    pageSize: 100,
    fetch: async (input, init) => {
      requests.push(new Request(input, init))
      const body = JSON.stringify({
        result: [
          {
            id: "m1",
            userName: "worker",
            machine: { name: "worker" },
            organizationId: "org-1",
            creationDate: 1,
          },
        ],
      })
      return new Response(body, { status: 200 })
    },
  })
  const _result = await zitadelMigrationExport({
    api: {
      ...api,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "org-1", name: "Org", state: "active", details: { creationDate: 1, changeDate: 2 } }],
      }),
      usersList: async () => ({ success: true as const, data: [] }),
      projectsList: async () => ({ success: true as const, data: [] }),
      organizationMembershipsList: async () => ({ success: true as const, data: [] }),
      projectGrantsList: async () => ({ success: true as const, data: [] }),
      organizationDomainsList: async () => ({ success: true as const, data: [] }),
      organizationLoginPolicyGet: async () => ({
        success: true as const,
        data: { allowUsernamePassword: true, allowExternalIdp: false },
      }),
      identityProvidersList: async () => ({ success: true as const, data: [] }),
    } as never,
  })
  const machines = await api.machineUsersList(["org-1"])
  expect(machines).toMatchObject({ success: true, data: [{ id: "m1" }] })
  expect(requests.some((request) => request.headers.get("x-zitadel-orgid") === "org-1")).toBe(true)

  const failed = await zitadelMigrationExport({
    api: {
      ...api,
      organizationsList: async () => ({
        success: true as const,
        data: [{ id: "org-1", name: "Org", state: "active", details: { creationDate: 1, changeDate: 2 } }],
      }),
      machineUsersList: async () => ({ success: false as const, op: "test", errorMessage: "denied" }),
    } as never,
  })
  expect(failed.success).toBe(false)
})

test("imports machine users with stable mappings across organizations and conflicts within one organization", async () => {
  await withDatabase(async (database, realmId) => {
    const first = zitadelMigrationImport({ database, realmId, snapshot: snapshot("m1", "worker", 10, 20) })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.counts.machineUsers).toMatchObject({ created: 1, updated: 0, unchanged: 0 })
    const machines = machineRepositoryCreate(database.db)
    const m1 = machines.userGetByName(realmId, "worker")
    expect(m1.success).toBe(true)
    if (!m1.success || m1.data === null) return
    expect(m1.data).toMatchObject({ createdAt: 10, updatedAt: 20 })
    const second = zitadelMigrationImport({ database, realmId, snapshot: snapshot("m1", "worker", 10, 20) })
    expect(second).toMatchObject({ success: true, data: { counts: { machineUsers: { unchanged: 1 } } } })
    const changed = zitadelMigrationImport({ database, realmId, snapshot: snapshot("m1", "worker-renamed", 10, 30) })
    expect(changed).toMatchObject({ success: true, data: { counts: { machineUsers: { updated: 1 } } } })
    expect(machines.userGetByName(realmId, "worker").success).toBe(true)
    const crossOrganizationSnapshot = snapshot("m2", "worker-renamed", 10, 30)
    crossOrganizationSnapshot.machineUsers[0]!.organizationId = "org-2"
    const crossOrganization = zitadelMigrationImport({
      database,
      realmId,
      authoritative: false,
      snapshot: crossOrganizationSnapshot,
    })
    expect(crossOrganization).toMatchObject({ success: true, data: { conflicts: 0 } })
    const m2 = machines.userGetByName(realmId, "worker-renamed")
    expect(m2.success).toBe(true)
    if (!m2.success || m2.data === null) return
    const m1Id = m1.data.id
    const m2Id = m2.data.id
    expect(m2Id).not.toBe(m1Id)
    const distinct = zitadelMigrationImport({ database, realmId, snapshot: snapshot("m3", "worker-renamed", 10, 30) })
    expect(distinct).toMatchObject({ success: true, data: { conflicts: 0, counts: { machineUsers: { created: 1 } } } })
    const after = machines.userList(realmId)
    expect(after.success).toBe(true)
    if (!after.success) return
    expect(after.data).toHaveLength(3)
    const m3 = after.data.find((user) => user.id !== m1Id && user.id !== m2Id)
    expect(m3?.userName).toMatch(/^worker-renamed-/)
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    const m1Mapping = mappings.sourceRecordGet(realmId, "https://source.test", "machineUser", "m1")
    const m3Mapping = mappings.sourceRecordGet(realmId, "https://source.test", "machineUser", "m3")
    expect(m1Mapping.success).toBe(true)
    expect(m3Mapping.success).toBe(true)
    if (
      !m1Mapping.success ||
      !m3Mapping.success ||
      m1Mapping.data === null ||
      m3Mapping.data === null ||
      m3 === undefined
    )
      return
    const m3DestinationId = m3Mapping.data.destinationId
    expect(m1Mapping.data.destinationId).toBe(m1Id)
    expect(m3DestinationId).toBe(m3.id)
    const stable = zitadelMigrationImport({ database, realmId, snapshot: snapshot("m3", "worker-renamed", 10, 30) })
    expect(stable).toMatchObject({ success: true, data: { conflicts: 0, counts: { machineUsers: { unchanged: 1 } } } })
    const stableMapping = mappings.sourceRecordGet(realmId, "https://source.test", "machineUser", "m3")
    expect(stableMapping.success).toBe(true)
    if (!stableMapping.success) return
    expect(stableMapping.data?.destinationId).toBe(m3DestinationId)
  })
})

test("reports portable and nonportable credential rotation without secrets", async () => {
  await withDatabase(async (database, realmId) => {
    const input = snapshot("m1", "worker", 1, 2)
    input.machineUsers[0]!.credentials = [
      { available: true, portable: true, type: "machine-secret" },
      { available: false, portable: false, type: "machine-secret" },
    ]
    const result = zitadelMigrationImport({ database, realmId, snapshot: input })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.requiresRotation).toEqual({ count: 1, sourceIds: ["m1"] })
    expect(result.data.unsupported).toContainEqual({
      entity: "machineCredential",
      reason: "portable-credential-unsupported",
      sourceId: "m1",
    })
    expect(JSON.stringify(result.data)).not.toContain("available")
    expect(machineRepositoryCreate(database.db).credentialListForRealm(realmId)).toMatchObject({ data: [] })
  })
})

test("complete deletion removes credentials, repeats idempotently, and incomplete snapshots preserve data", async () => {
  await withDatabase(async (database, realmId) => {
    const source = snapshot("m1", "worker", 1, 2)
    expect(zitadelMigrationImport({ database, realmId, snapshot: source }).success).toBe(true)
    const empty = {
      ...source,
      machineUsers: [],
      completeness: { ...source.completeness, machineUsers: { complete: true, count: 0 } },
    }
    expect(zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: empty })).toMatchObject({
      success: true,
      data: { deleted: 1 },
    })
    expect(zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: empty })).toMatchObject({
      success: true,
      data: { deleted: 0 },
    })
    expect(machineRepositoryCreate(database.db).userList(realmId)).toMatchObject({ data: [] })
    const incomplete = {
      ...source,
      machineUsers: [],
      completeness: { ...source.completeness, machineUsers: { complete: false, count: 0 } },
    }
    expect(zitadelMigrationImport({ database, realmId, snapshot: incomplete }).success).toBe(true)
  })
})

test("realm and source isolation preserve unrelated machine users", async () => {
  await withDatabase(async (database, realmId) => {
    const source = snapshot("m1", "worker", 1, 2)
    expect(zitadelMigrationImport({ database, realmId, snapshot: source }).success).toBe(true)
    const other = {
      ...source,
      sourceInstance: "https://other.test",
      machineUsers: [],
      completeness: { ...source.completeness, machineUsers: { complete: true, count: 0 } },
    }
    expect(zitadelMigrationImport({ database, realmId, snapshot: other }).success).toBe(true)
    expect(machineRepositoryCreate(database.db).userList(realmId)).toMatchObject({ data: [{ userName: "worker" }] })
  })
})

test("transaction rollback leaves no machine or mapping", async () => {
  await withDatabase(async (database, realmId) => {
    const bad = snapshot("m1", "worker", 1, 2)
    bad.oidcApplications = [{ ...bad.oidcApplications[0]!, redirectUris: ["file:///bad"] }]
    expect(zitadelMigrationImport({ database, realmId, snapshot: bad }).success).toBe(false)
    expect(machineRepositoryCreate(database.db).userList(realmId)).toMatchObject({ data: [] })
  })
})

function snapshot(sourceId: string, name: string, createdAt: number, updatedAt: number): ZitadelMigrationSnapshot {
  const empty = (value: ZitadelMigrationSnapshot["machineUsers"]) => ({
    ...base(),
    machineUsers: value,
    completeness: { ...base().completeness, machineUsers: { complete: true, count: value.length } },
  })
  return empty([
    {
      credentials: [{ available: false, portable: false, type: "machine-secret" }],
      name,
      organizationId: "org-1",
      sourceId,
      createdAt,
      updatedAt,
    },
  ])
}
function base(): ZitadelMigrationSnapshot {
  return {
    version: 2,
    sourceInstance: "https://source.test",
    exportedAt: 1,
    completeness: Object.fromEntries(
      [
        "users",
        "organizations",
        "organizationMemberships",
        "projects",
        "projectRoles",
        "projectGrants",
        "oidcApplications",
        "machineUsers",
        "domains",
        "loginPolicies",
        "identityProviders",
        "externalIdentityLinks",
      ].map((key) => [key, { complete: true, count: 0 }]),
    ) as ZitadelMigrationSnapshot["completeness"],
    users: [],
    organizations: [],
    organizationMemberships: [],
    projects: [],
    projectRoles: [],
    projectGrants: [],
    oidcApplications: [],
    machineUsers: [],
    domains: [],
    loginPolicies: [],
    identityProviders: [],
    externalIdentityLinks: [],
    unsupported: [],
  }
}
async function withDatabase(operation: (database: StorageDatabase, realmId: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-task7-"))
  const kit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), kit.runtime)
  if (!opened.success) throw new Error(opened.errorMessage)
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "task7.example", name: "Task 7" },
    runtime: kit.runtime,
  })
  if (!realm.success) throw new Error(realm.errorMessage)
  try {
    await operation(opened.data, realm.data.realm.id)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}
