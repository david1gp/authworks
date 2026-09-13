import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcRepositoryCreate } from "../../src/features/oidc/persistence/oidcRepositoryCreate.js"
import { projectRepositoryCreate } from "../../src/features/projects/persistence/projectRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import type { ZitadelMigrationSnapshot } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

type Snapshot = ZitadelMigrationSnapshot

test("task 6 imports OIDC applications, converges, overwrites, and reports rotation without secrets", async () => {
  await withDatabase(async (database, realmId) => {
    const snapshot = applicationSnapshot()
    const first = zitadelMigrationImport({ database, realmId, snapshot })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.counts.oidcApplications).toMatchObject({ created: 2, unchanged: 0 })
    expect(first.data.requiresRotation).toEqual({ count: 1, sourceIds: ["client-confidential"] })
    expect(JSON.stringify(first.data)).not.toContain("secret")

    const projects = projectRepositoryCreate(database.db)
    const projectMapping = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordGet(
      realmId,
      snapshot.sourceInstance,
      "project",
      "project-1",
    )
    expect(projectMapping.success).toBe(true)
    if (!projectMapping.success || projectMapping.data === null) return
    const applications = projects.projectApplicationList(projectMapping.data.destinationId)
    expect(applications.success).toBe(true)
    if (!applications.success) return
    expect(applications.data).toHaveLength(2)
    const oidc = oidcRepositoryCreate(database.db)
    const clients = oidc.clientList(realmId)
    expect(clients.success).toBe(true)
    if (!clients.success) return
    expect(clients.data).toHaveLength(2)
    const publicClient = clients.data.find((client) => client.name === "Public")
    expect(publicClient?.secretHash).toBeNull()
    expect(publicClient).toMatchObject({
      accessTokenRoleAssertion: 1,
      additionalOrigins: JSON.stringify(["https://origin.example"]),
      allowedScopes: JSON.stringify(["openid", "profile"]),
      idTokenUserinfoAssertion: 1,
      requireConsent: 0,
      trusted: 1,
    })

    const nativeProjectId = projectMapping.data.destinationId
    expect(
      projects.projectApplicationCreate({
        applicationType: "oidc",
        createdAt: 1,
        id: "native-app",
        name: "Native",
        projectId: nativeProjectId,
        realmId,
        status: "active",
        updatedAt: 1,
        version: 1,
      }).success,
    ).toBe(true)
    expect(
      oidc.clientCreate({
        accessTokenRoleAssertion: 1,
        additionalOrigins: JSON.stringify(["https://native.example"]),
        allowedScopes: JSON.stringify(["openid"]),
        applicationId: "native-app",
        clientType: "public",
        createdAt: 1,
        id: "native-client",
        idTokenUserinfoAssertion: 1,
        name: "Native",
        postLogoutRedirectUris: "[]",
        projectId: nativeProjectId,
        realmId,
        redirectUris: JSON.stringify(["https://native.example/callback"]),
        requireConsent: 1,
        secretHash: null,
        status: "active",
        trusted: 1,
        updatedAt: 1,
        version: 1,
      }).success,
    ).toBe(true)

    const second = zitadelMigrationImport({ database, realmId, snapshot })
    expect(second.success).toBe(true)
    if (second.success) expect(second.data.counts.oidcApplications).toMatchObject({ unchanged: 2, created: 0 })

    const changed = structuredClone(snapshot)
    changed.oidcApplications[0]!.name = "Authoritative name"
    changed.oidcApplications[0]!.accessTokenRoleAssertion = false
    changed.oidcApplications[0]!.additionalOrigins = []
    changed.oidcApplications[0]!.idTokenUserinfoAssertion = false
    const overwritten = zitadelMigrationImport({ database, realmId, snapshot: changed })
    expect(overwritten.success).toBe(true)
    const applicationMapping = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordGet(
      realmId,
      snapshot.sourceInstance,
      "projectApplication",
      "app-public",
    )
    expect(applicationMapping.success).toBe(true)
    if (applicationMapping.success && applicationMapping.data !== null)
      expect(projects.projectApplicationGet(applicationMapping.data.destinationId)).toMatchObject({
        data: { name: "Authoritative name" },
      })
    const updatedClients = oidc.clientList(realmId)
    expect(updatedClients.success).toBe(true)
    if (!updatedClients.success) return
    const updatedClient = updatedClients.data.find((client) => client.name === "Authoritative name")
    expect(updatedClient).toMatchObject({
      accessTokenRoleAssertion: 0,
      additionalOrigins: "[]",
      idTokenUserinfoAssertion: 0,
    })
    expect(oidc.clientGet(realmId, "native-client")).toMatchObject({
      data: {
        accessTokenRoleAssertion: 1,
        additionalOrigins: JSON.stringify(["https://native.example"]),
        idTokenUserinfoAssertion: 1,
      },
    })
  })
})

test("task 6 rejects invalid URIs before writing and preserves native conflicts", async () => {
  await withDatabase(async (database, realmId) => {
    const projects = projectRepositoryCreate(database.db)
    expect(zitadelMigrationImport({ database, realmId, snapshot: applicationSnapshot() }).success).toBe(true)
    const invalid = applicationSnapshot()
    invalid.oidcApplications[0]!.redirectUris = ["file:///not-valid"]
    expect(zitadelMigrationImport({ database, realmId, snapshot: invalid }).success).toBe(false)
    expect(projects.projectApplicationList("project-1")).toMatchObject({ data: { length: 0 } })
  })
})

test("old snapshots default OIDC compatibility settings to disabled and empty", async () => {
  await withDatabase(async (database, realmId) => {
    const oldSnapshot = structuredClone(applicationSnapshot())
    for (const application of oldSnapshot.oidcApplications) {
      const record = application as unknown as Record<string, unknown>
      delete record.accessTokenRoleAssertion
      delete record.additionalOrigins
      delete record.idTokenUserinfoAssertion
    }
    const imported = zitadelMigrationImport({ database, realmId, snapshot: oldSnapshot })
    expect(imported.success).toBe(true)
    if (!imported.success) return
    const clients = oidcRepositoryCreate(database.db).clientList(realmId)
    expect(clients.success).toBe(true)
    if (!clients.success) return
    expect(clients.data).toContainEqual(
      expect.objectContaining({
        accessTokenRoleAssertion: 0,
        additionalOrigins: "[]",
        idTokenUserinfoAssertion: 0,
      }),
    )
  })
})

test("task 6 deletes only complete source-owned applications and preserves incomplete and other-source records", async () => {
  await withDatabase(async (database, realmId) => {
    const snapshot = applicationSnapshot()
    expect(zitadelMigrationImport({ database, realmId, snapshot }).success).toBe(true)
    const empty = structuredClone(snapshot)
    empty.oidcApplications = []
    empty.completeness.oidcApplications = { complete: true, count: 0 }
    expect(zitadelMigrationImport({ authoritative: true, database, realmId, snapshot: empty }).success).toBe(true)
    expect(projectRepositoryCreate(database.db).projectApplicationGet("app-public")).toMatchObject({ data: null })
    expect(projectRepositoryCreate(database.db).projectApplicationGet("app-confidential")).toMatchObject({ data: null })
    const incomplete = structuredClone(snapshot)
    incomplete.oidcApplications = []
    incomplete.completeness.oidcApplications = { complete: false, count: 0 }
    expect(zitadelMigrationImport({ database, realmId, snapshot: incomplete }).success).toBe(true)
  })
})

function applicationSnapshot(): Snapshot {
  const base = JSON.parse(
    readFileSync(join(import.meta.dir, "../fixtures/zitadel-migration-snapshot.json"), "utf8"),
  ) as Snapshot
  base.projects = [{ ...base.projects[0]!, id: "project-1" }]
  base.completeness.projects = { complete: true, count: 1 }
  base.oidcApplications = [
    {
      authorizationEndpoint: null,
      accessTokenRoleAssertion: true,
      allowedScopes: ["openid", "profile"],
      additionalOrigins: ["https://origin.example"],
      clientType: "public",
      credentials: [],
      createdAt: 1,
      name: "Public",
      projectId: "project-1",
      redirectUris: ["https://example.test/callback"],
      postLogoutRedirectUris: [],
      sourceId: "app-public",
      status: "active",
      tokenEndpointAuthMethod: "none",
      idTokenUserinfoAssertion: true,
      requireConsent: false,
      trusted: true,
      updatedAt: 1,
    },
    {
      authorizationEndpoint: null,
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      clientType: "confidential",
      credentials: [{ available: false, portable: false, type: "client-secret" }],
      createdAt: 1,
      name: "Confidential",
      projectId: "project-1",
      redirectUris: ["https://example.test/confidential"],
      postLogoutRedirectUris: [],
      sourceId: "client-confidential",
      status: "active",
      tokenEndpointAuthMethod: "client_secret_basic",
      idTokenUserinfoAssertion: false,
      updatedAt: 1,
    },
  ]
  base.completeness.oidcApplications = { complete: true, count: 2 }
  return base
}

async function withDatabase(operation: (database: StorageDatabase, realmId: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-task6-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  if (!opened.success) throw new Error(opened.errorMessage)
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "task6.example", name: "Task 6" },
    runtime: testkit.runtime,
  })
  if (!realm.success) throw new Error(realm.errorMessage)
  try {
    await operation(opened.data, realm.data.realm.id)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}
