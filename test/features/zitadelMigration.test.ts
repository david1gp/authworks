import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { organizationRolesDecode } from "../../src/features/organizations/domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../../src/features/organizations/persistence/organizationRepositoryCreate.js"
import { projectRepositoryCreate } from "../../src/features/projects/persistence/projectRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { userList } from "../../src/features/users/actions/userList.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { userListResponseSchema } from "../../src/features/users/public/userListResponseSchema.js"
import { userResponseSchema } from "../../src/features/users/public/userResponseSchema.js"
import { zitadelMigrationExport } from "../../src/features/zitadelMigration/actions/zitadelMigrationExport.js"
import { zitadelMigrationImport } from "../../src/features/zitadelMigration/actions/zitadelMigrationImport.js"
import { zitadelApiClientCreate } from "../../src/features/zitadelMigration/client/zitadelApiClientCreate.js"
import { zitadelMigrationOrganizationRolesMap } from "../../src/features/zitadelMigration/domain/zitadelMigrationOrganizationRolesMap.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

type JsonRecord = Readonly<Record<string, unknown>>

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(import.meta.dir, "../fixtures", name), "utf8")) as unknown
}

async function withDatabase<T>(operation: (database: StorageDatabase, realmId: string) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-zitadel-migration-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database: opened.data,
    input: { domain: "migration.example.com", name: "Migration realm" },
    runtime: testkit.runtime,
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  try {
    return await operation(opened.data, realm.data.realm.id)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

test("ZITADEL organization roles map to stable Authworks roles", () => {
  expect(zitadelMigrationOrganizationRolesMap(["ORG_OWNER", "ORG_USER_VIEWER", "CUSTOM_ROLE", "ORG_OWNER"])).toEqual({
    mapped: ["guest", "owner"],
    unsupported: ["CUSTOM_ROLE"],
  })
})

test("migration imports relationships, preserves IDs, and is idempotent", async () => {
  const snapshot = await fixture("zitadel-migration-snapshot.json")
  await withDatabase(async (database, realmId) => {
    const first = zitadelMigrationImport({ database, realmId, snapshot })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.counts.users).toMatchObject({ created: 1, imported: 1, skipped: 0 })
    expect(first.data.counts.organizations).toMatchObject({ created: 2, imported: 2 })
    expect(first.data.counts.organizationMemberships).toMatchObject({ created: 1, imported: 1 })
    expect(first.data.counts.projects).toMatchObject({ created: 1, imported: 1 })
    expect(first.data.counts.projectRoles).toMatchObject({ created: 1, imported: 1 })
    expect(first.data.counts.projectGrants).toMatchObject({ created: 1, imported: 1 })
    expect(first.data.unsupported).toHaveLength(3)

    const user = userRepositoryCreate(database.db).userGet(realmId, "98765432109876543210")
    expect(user.success).toBe(true)
    if (!user.success) return
    expect(user.data?.email).toBe("alice@example.com")
    const listed = userList({ context: realmSystemContextCreate(), database, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(v.safeParse(userListResponseSchema, listed.data).success).toBe(true)
    expect(v.safeParse(userResponseSchema, { user: listed.data.items[0] }).success).toBe(true)
    const organizations = organizationRepositoryCreate(database.db).organizationList(realmId)
    expect(organizations.success).toBe(true)
    if (!organizations.success) return
    expect(organizations.data.map((organization) => organization.id)).toEqual([
      "123456789012345678",
      "223456789012345678",
    ])

    const membership = organizationRepositoryCreate(database.db).organizationMembershipGet("membership-1")
    expect(membership.success).toBe(true)
    if (membership.success && membership.data !== null)
      expect(organizationRolesDecode(membership.data.roles)).toMatchObject({ data: ["guest", "owner"], success: true })

    const project = projectRepositoryCreate(database.db).projectGet("project-1")
    const role = projectRepositoryCreate(database.db).projectRoleGet("role-1")
    const grant = projectRepositoryCreate(database.db).projectGrantGet("grant-1")
    expect(project.success).toBe(true)
    expect(role.success).toBe(true)
    expect(grant.success).toBe(true)
    if (!project.success || !role.success || !grant.success) return
    expect(project.data?.organizationId).toBe("123456789012345678")
    expect(role.data?.projectId).toBe(project.data?.id)
    expect(grant.data).toMatchObject({
      grantedOrganizationId: "223456789012345678",
      organizationId: "123456789012345678",
      projectId: "project-1",
    })

    const second = zitadelMigrationImport({ database, realmId, snapshot })
    expect(second.success).toBe(true)
    if (!second.success) return
    expect(second.data.counts.users).toMatchObject({ created: 0, imported: 1, unchanged: 1, updated: 0 })
    expect(second.data.counts.organizations).toMatchObject({ created: 0, imported: 2, unchanged: 2, updated: 0 })
    expect(second.data.counts.projectGrants).toMatchObject({ created: 0, imported: 1, unchanged: 1, updated: 0 })
  })
})

test("migration rejects malformed or path-dangerous user IDs and references before writing", async () => {
  const snapshot = (await fixture("zitadel-migration-snapshot.json")) as {
    users: Array<{ id: string }>
    organizationMemberships: Array<{ userId: string }>
  }
  const invalidUserIdSnapshot = structuredClone(snapshot)
  const invalidUserReferenceSnapshot = structuredClone(snapshot)
  invalidUserIdSnapshot.users[0]!.id = "../user"
  invalidUserReferenceSnapshot.organizationMemberships[0]!.userId = "user/../reference"

  for (const invalidSnapshot of [invalidUserIdSnapshot, invalidUserReferenceSnapshot]) {
    await withDatabase(async (database, realmId) => {
      const imported = zitadelMigrationImport({ database, realmId, snapshot: invalidSnapshot })
      expect(imported).toMatchObject({ code: "zitadel-migration.snapshot-invalid", success: false })
      expect(userRepositoryCreate(database.db).userList(realmId)).toEqual({ data: [], success: true })
    })
  }
})

test("migration rejects unsupported organization IDs before opening the import transaction", async () => {
  const snapshot = (await fixture("zitadel-migration-snapshot.json")) as {
    organizations: Array<{ id: string }>
  }
  const organization = snapshot.organizations[0]
  expect(organization).toBeDefined()
  if (organization === undefined) return
  organization.id = "legacy/organization"

  await withDatabase(async (database, realmId) => {
    const imported = zitadelMigrationImport({ database, realmId, snapshot })
    expect(imported).toMatchObject({ code: "zitadel-migration.snapshot-invalid", success: false })
    const organizations = organizationRepositoryCreate(database.db).organizationList(realmId)
    expect(organizations).toEqual({ data: [], success: true })
  })
})

test("migration reconciles same-name organizations and translates relationships", async () => {
  const snapshot = await fixture("zitadel-migration-snapshot.json")
  await withDatabase(async (database, realmId) => {
    const existing = organizationRepositoryCreate(database.db).organizationCreate({
      createdAt: 1700000000000,
      id: "target-owner",
      name: "Owner organization",
      realmId,
      status: "active",
      updatedAt: 1700000000000,
      version: 1,
    })
    expect(existing.success).toBe(true)
    if (!existing.success) return

    const first = zitadelMigrationImport({ database, realmId, snapshot })
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.data.counts.organizations).toMatchObject({ created: 1, imported: 2, skipped: 0 })

    const membership = organizationRepositoryCreate(database.db).organizationMembershipGet("membership-1")
    const project = projectRepositoryCreate(database.db).projectGet("project-1")
    const grant = projectRepositoryCreate(database.db).projectGrantGet("grant-1")
    expect(membership.success).toBe(true)
    expect(project.success).toBe(true)
    expect(grant.success).toBe(true)
    if (!membership.success || !project.success || !grant.success) return
    expect(membership.data?.organizationId).toBe("target-owner")
    expect(project.data?.organizationId).toBe("target-owner")
    expect(grant.data).toMatchObject({ organizationId: "target-owner", grantedOrganizationId: "223456789012345678" })

    const second = zitadelMigrationImport({ database, realmId, snapshot })
    expect(second.success).toBe(true)
    if (!second.success) return
    expect(second.data.counts.organizations).toMatchObject({ created: 0, imported: 2, unchanged: 2, skipped: 0 })
    expect(second.data.counts.organizationMemberships).toMatchObject({ unchanged: 1, skipped: 0 })
    expect(second.data.counts.projects).toMatchObject({ unchanged: 1, skipped: 0 })
    expect(second.data.counts.projectGrants).toMatchObject({ unchanged: 1, skipped: 0 })
  })
})

test("exporter uses API records without exporting password or federated material", async () => {
  const source = (await fixture("zitadel-export-source.json")) as JsonRecord
  const records = (name: string) => (source[name] as JsonRecord[]) ?? []
  const grants = [
    ...records("grants"),
    {
      details: {
        changeDate: "2023-11-14T22:13:21.000Z",
        creationDate: "2023-11-14T22:13:20.000Z",
      },
      grantId: "grant-empty-roles",
      grantedOrgId: "223456789012345678",
      projectId: "project-source",
      projectOwnerId: "323456789012345678",
      state: "PROJECT_GRANT_STATE_ACTIVE",
    },
  ]
  const api = {
    organizationMembershipsList: async () => resultCreate(records("memberships")),
    organizationsList: async () => resultCreate(records("organizations")),
    projectGrantsList: async () => resultCreate(grants),
    projectRolesList: async () => resultCreate(records("roles")),
    projectsList: async () => resultCreate(records("projects")),
    usersList: async () => resultCreate(records("users")),
  }
  const result = await zitadelMigrationExport({ api: api as never })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.users[0]).not.toHaveProperty("passwordChanged")
  expect(result.data.snapshot.users[0]).not.toHaveProperty("idpLinks")
  expect(result.data.snapshot.unsupported.map((item) => item.entity)).toEqual(["userPassword", "federatedIdentity"])
  expect(result.data.snapshot.projects[0]).toMatchObject({
    authorizationRequired: true,
    organizationId: "323456789012345678",
    projectAccessRequired: true,
  })
  expect(result.data.snapshot.projectRoles[0]?.id).toBe("zitadel-role-project-source-viewer")
  expect(result.data.snapshot.projectGrants[1]?.roleKeys).toEqual([])
})

test("ZITADEL empty searches with details but no result are treated as empty", async () => {
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.example.com",
    fetch: async () => new Response(JSON.stringify({ details: { totalResult: "0" } }), { status: 200 }),
    token: "test-token",
  })
  const result = await api.organizationsList()
  expect(result).toEqual({ data: [], success: true })
})
