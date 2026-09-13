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
import { zitadelMigrationSourceRecordRepositoryCreate } from "../../src/features/zitadelMigration/persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import { zitadelMigrationSnapshotSchema } from "../../src/features/zitadelMigration/public/zitadelMigrationSnapshotSchema.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

type JsonRecord = Readonly<Record<string, unknown>>

test("version 2 snapshots normalize source instances and accept portable entities", async () => {
  const snapshot = (await fixture("zitadel-migration-snapshot.json")) as Record<string, unknown>
  snapshot.sourceInstance = "HTTPS://ZITADEL.EXAMPLE///"
  snapshot.oidcApplications = [
    {
      authorizationEndpoint: "https://zitadel.example/authorize",
      clientType: "confidential",
      credentials: [{ available: false, portable: false, type: "client-secret" }],
      createdAt: 1700000000000,
      name: "Web",
      projectId: "project-1",
      redirectUris: ["https://app.example/callback"],
      sourceId: "client-1",
      status: "active",
      tokenEndpointAuthMethod: "client_secret_basic",
      updatedAt: 1700000000000,
    },
  ]
  ;(snapshot.completeness as Record<string, unknown>).oidcApplications = { complete: true, count: 1 }
  const parsed = v.safeParse(zitadelMigrationSnapshotSchema, snapshot)
  expect(parsed.success).toBe(true)
  if (parsed.success) {
    expect(parsed.output.sourceInstance).toBe("https://zitadel.example")
    expect(parsed.output.oidcApplications[0]).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
    })
  }
  const invalidOrigin = structuredClone(snapshot)
  invalidOrigin.oidcApplications = [
    {
      ...(snapshot.oidcApplications as JsonRecord[])[0]!,
      additionalOrigins: ["https://app.example/path"],
    },
  ]
  ;(invalidOrigin.completeness as Record<string, unknown>).oidcApplications = { complete: true, count: 1 }
  expect(v.safeParse(zitadelMigrationSnapshotSchema, invalidOrigin).success).toBe(false)
})

test("version 1, incomplete counts, missing source, and embedded secrets are rejected", async () => {
  const base = await fixture("zitadel-migration-snapshot.json")
  const secretBase = base as JsonRecord
  const completeness = secretBase.completeness as JsonRecord
  for (const invalid of [
    { ...(base as JsonRecord), version: 1 },
    { ...(base as JsonRecord), sourceInstance: "not-a-url" },
    {
      ...(base as JsonRecord),
      completeness: { ...completeness, domains: { complete: true, count: 1 } },
    },
    {
      ...(base as JsonRecord),
      oidcApplications: [
        {
          authorizationEndpoint: null,
          clientType: "confidential",
          credentials: [],
          name: "Embedded secret",
          redirectUris: [],
          sourceId: "client-1",
          tokenEndpointAuthMethod: "client_secret_basic",
          clientSecret: "secret",
        },
      ],
      completeness: { ...completeness, oidcApplications: { complete: true, count: 1 } },
    },
    {
      ...secretBase,
      machineUsers: [
        {
          credentials: [{ available: true, portable: false, type: "machine-secret", secret: "secret" }],
          name: "Machine",
          sourceId: "machine-1",
        },
      ],
      completeness: { ...(secretBase.completeness as JsonRecord), machineUsers: { complete: true, count: 1 } },
    },
    {
      ...secretBase,
      identityProviders: [
        { clientId: "client", clientSecret: "secret", name: "Provider", provider: "oidc", sourceId: "provider-1" },
      ],
      completeness: { ...(secretBase.completeness as JsonRecord), identityProviders: { complete: true, count: 1 } },
    },
  ]) {
    expect(v.safeParse(zitadelMigrationSnapshotSchema, invalid).success).toBe(false)
  }
})

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

test("migration source records are isolated by realm and normalized source", async () => {
  await withDatabase(async (database, realmId) => {
    const repository = zitadelMigrationSourceRecordRepositoryCreate(database.db)
    const stored = repository.sourceRecordUpsert({
      realmId,
      sourceInstance: " HTTPS://ZITADEL.EXAMPLE/ ",
      entityType: "user",
      sourceId: "source-user",
      destinationId: "auth-user",
      sourceVersion: "7",
      sourceUpdatedAt: 10,
    })
    expect(stored.success).toBe(true)
    const found = repository.sourceRecordGet(realmId, "https://zitadel.example", "user", "source-user")
    expect(found.success).toBe(true)
    if (!found.success) return
    expect(found.data?.destinationId).toBe("auth-user")
    const listed = repository.sourceRecordList(realmId, "https://zitadel.example/")
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data).toHaveLength(1)
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

    const mapping = zitadelMigrationSourceRecordRepositoryCreate(database.db).sourceRecordGet(
      realmId,
      "https://zitadel.example",
      "user",
      "98765432109876543210",
    )
    expect(mapping.success).toBe(true)
    if (!mapping.success || mapping.data === null) return
    const user = userRepositoryCreate(database.db).userGet(realmId, mapping.data.destinationId)
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

test("migration rejects malformed membership IDs before writing", async () => {
  const snapshot = (await fixture("zitadel-migration-snapshot.json")) as {
    organizationMemberships: Array<{ id: string }>
  }
  const invalidIds = [
    "membership-",
    "membership-0",
    "membership-01",
    "membership-123456789012345678901",
    "membership-1/2",
    "membership-1\\2",
    "membership-1.2",
    "membership-1\u0000",
    "zitadel-membership-0-1",
    "zitadel-membership-01-1",
    "zitadel-membership-1-01",
    "zitadel-membership-123456789012345678901-1",
    "zitadel-membership-1-123456789012345678901",
    "zitadel-membership-1",
    "zitadel-membership-1-2/3",
    "zitadel-membership-1-2\\3",
    "zitadel-membership-1-2.3",
    "zitadel-membership-1-2\n",
    "018F0000-0000-7000-8000-000000000001",
  ]
  for (const id of invalidIds) {
    const invalidSnapshot = structuredClone(snapshot)
    invalidSnapshot.organizationMemberships[0]!.id = id
    await withDatabase(async (database, realmId) => {
      const imported = zitadelMigrationImport({ database, realmId, snapshot: invalidSnapshot })
      expect(imported).toMatchObject({ code: "zitadel-migration.snapshot-invalid", success: false })
      expect(organizationRepositoryCreate(database.db).organizationList(realmId)).toEqual({ data: [], success: true })
    })
  }
}, 15_000)

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

test("migration preserves same-name native organizations and skips dependent records", async () => {
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
    expect(first.data.counts.organizations).toMatchObject({ created: 1, imported: 1, skipped: 1 })
    expect(first.data.skipped).toContainEqual({
      entity: "organizations",
      reason: "native-conflict",
      sourceId: "123456789012345678",
    })

    const membership = organizationRepositoryCreate(database.db).organizationMembershipGet("membership-1")
    const project = projectRepositoryCreate(database.db).projectGet("project-1")
    const grant = projectRepositoryCreate(database.db).projectGrantGet("grant-1")
    expect(membership.success).toBe(true)
    expect(project.success).toBe(true)
    expect(grant.success).toBe(true)
    if (!membership.success || !project.success || !grant.success) return
    expect(membership.data).toBeNull()
    expect(project.data).toBeNull()
    expect(grant.data).toBeNull()

    const second = zitadelMigrationImport({ database, realmId, snapshot })
    expect(second.success).toBe(true)
    if (!second.success) return
    expect(second.data.counts.organizations).toMatchObject({ created: 0, imported: 1, unchanged: 1, skipped: 1 })
    expect(second.data.counts.organizationMemberships).toMatchObject({ skipped: 1 })
    expect(second.data.counts.projects).toMatchObject({ skipped: 1 })
    expect(second.data.counts.projectGrants).toMatchObject({ skipped: 1 })
  })
})

test("exporter exports supported identity links and only marks password unsupported", async () => {
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
      state: "GRANTED_PROJECT_STATE_ACTIVE",
    },
  ]
  const api = {
    organizationMembershipsList: async () => resultCreate(records("memberships")),
    organizationsList: async () => resultCreate(records("organizations")),
    projectGrantsList: async () => resultCreate(grants),
    projectRolesList: async () => resultCreate(records("roles")),
    projectsList: async () => resultCreate(records("projects")),
    usersList: async () => resultCreate(records("users")),
    userIdentityLinksList: async () => resultCreate([{ idpId: "google", userId: "upstream-subject" }]),
    machineUsersList: async () => resultCreate([]),
  }
  const result = await zitadelMigrationExport({ api: api as never })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.snapshot.users[0]).not.toHaveProperty("passwordChanged")
  expect(result.data.snapshot.externalIdentityLinks).toEqual([
    {
      externalSubject: "upstream-subject",
      identityProviderId: "google",
      sourceId: "zitadel-idp-link-98765432109876543210-google-upstream-subject",
      userId: "98765432109876543210",
    },
  ])
  expect(result.data.snapshot.organizationMemberships[0]?.id).toBe(
    "zitadel-membership-323456789012345678-98765432109876543210",
  )
  await withDatabase(async (database, realmId) => {
    const imported = zitadelMigrationImport({ database, realmId, snapshot: result.data.snapshot })
    expect(imported.success).toBe(true)
    expect(
      organizationRepositoryCreate(database.db).organizationMembershipGet(
        "zitadel-membership-323456789012345678-98765432109876543210",
      ),
    ).toMatchObject({ success: true })
  })
  expect(result.data.snapshot.unsupported.map((item) => item.entity)).toEqual(["userPassword"])
  expect(result.data.snapshot.projects[0]).toMatchObject({
    authorizationRequired: true,
    organizationId: "323456789012345678",
    projectAccessRequired: true,
  })
  expect(result.data.snapshot.projectRoles[0]?.id).toBe("zitadel-role-project-source-viewer")
  expect(result.data.snapshot.projectGrants[1]?.roleKeys).toEqual([])
})

test("ZITADEL empty searches with details but no result are treated as empty", async () => {
  let legacyFetchCalled = false
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.example.com",
    fetch: async () => {
      legacyFetchCalled = true
      throw new Error("legacy fetch must not be called")
    },
    token: "test-token",
    transport: {
      unary: async () => ({ message: { organizations: [], details: { totalResult: 0n } } }),
    } as never,
  })
  const result = await api.organizationsList()
  expect(result).toEqual({ data: [], success: true })
  expect(legacyFetchCalled).toBe(false)
})

test("ZITADEL v2 organizations and users use the injected transport, paginate, and normalize human users", async () => {
  const calls: Array<{ method: string; offset: bigint }> = []
  const transport = {
    unary: async (method: { name: string }, ...args: unknown[]) => {
      const request = args.find(
        (value): value is { query?: { offset?: bigint }; queries?: unknown[] } =>
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          ("query" in value || "queries" in value),
      )
      const offset = request?.query?.offset ?? 0n
      calls.push({ method: method.name, offset })
      if (method.name.includes("ListOrganizations"))
        return {
          message: {
            organizations:
              offset === 0n
                ? [{ organizationId: "org-1", organizationName: "First" }]
                : [{ organizationId: "org-2", organizationName: "Second" }],
            details: { totalResult: 2n },
          },
        }
      return {
        message: {
          result:
            offset === 0n
              ? [
                  {
                    userId: "user-1",
                    username: "alice",
                    type: { case: "human", value: { email: "alice@example.com", firstName: "Alice" } },
                  },
                ]
              : [],
          details: { totalResult: 1n },
        },
      }
    },
  }
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.example.com",
    fetch: async () => {
      throw new Error("legacy fetch must not be called")
    },
    pageSize: 1,
    token: "test-token",
    transport: transport as never,
  })

  await expect(api.organizationsList()).resolves.toEqual({
    success: true,
    data: [
      { organizationId: "org-1", organizationName: "First", id: "org-1", name: "First" },
      { organizationId: "org-2", organizationName: "Second", id: "org-2", name: "Second" },
    ],
  })
  await expect(api.usersList(["org-1"])).resolves.toMatchObject({
    success: true,
    data: [
      { id: "user-1", userName: "alice", human: { email: "alice@example.com", firstName: "Alice", idpLinks: [] } },
    ],
  })
  expect(calls).toEqual([
    { method: expect.stringContaining("ListOrganizations"), offset: 0n },
    { method: expect.stringContaining("ListOrganizations"), offset: 1n },
    { method: expect.stringContaining("ListUsers"), offset: 0n },
  ])
})

test("ZITADEL v2 project applications and domains use injected transport and filters", async () => {
  const requests: Array<{ method: string; request: JsonRecord }> = []
  const transport = {
    unary: async (method: { name: string }, ...args: unknown[]) => {
      const request =
        args.find(
          (value): value is JsonRecord =>
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            ("filters" in value || "organizationId" in value),
        ) ?? {}
      requests.push({ method: method.name, request })
      if (requests.length === 1)
        return {
          message: {
            applications: [
              {
                applicationId: "app-1",
                name: "OIDC",
                projectId: "project/1",
                configuration: {
                  case: "oidcConfiguration",
                  value: { clientId: "client-1", postLogoutRedirectUris: ["https://example.test/out"] },
                },
              },
            ],
            pagination: { totalResult: 1n },
          },
        }
      return {
        message: {
          domains: [{ domain: "Example.TEST", organizationId: "org-1", isVerified: true, isPrimary: true }],
          pagination: { totalResult: 1n },
        },
      }
    },
  }
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.example.com",
    fetch: async () => {
      throw new Error("legacy fetch must not be called")
    },
    pageSize: 1,
    token: "test-token",
    transport: transport as never,
  })
  const result = await api.projectApplicationsList("project/1", "org-1")
  expect(result).toMatchObject({
    success: true,
    data: [{ id: "app-1", oidcConfig: { clientId: "client-1", postLogoutRedirectUris: ["https://example.test/out"] } }],
  })
  const domains = await api.organizationDomainsList("org-1")
  expect(domains).toMatchObject({
    success: true,
    data: [{ domain: "Example.TEST", isPrimary: true, organizationId: "org-1" }],
  })
  expect(requests).toHaveLength(2)
  expect(requests[0]).toMatchObject({
    method: expect.stringContaining("ListApplications"),
    request: {
      filters: [{ filter: { case: "projectIdFilter", value: { projectId: "project/1" } } }],
      pagination: { limit: 1 },
    },
  })
  expect(requests[1]).toMatchObject({
    method: expect.stringContaining("ListOrganizationDomains"),
    request: { organizationId: "org-1", pagination: { limit: 1 } },
  })
})

test("exporter uses the machine-user endpoint and classifies machine users", async () => {
  const source = (await fixture("zitadel-export-source.json")) as JsonRecord
  const records = (name: string) => (source[name] as JsonRecord[]) ?? []
  const machine = {
    id: "machine-1",
    machine: { name: "Worker" },
    organizationId: "323456789012345678",
    userName: "worker",
  }
  const calls: string[] = []
  const api = {
    organizationMembershipsList: async () => resultCreate([]),
    organizationsList: async () => resultCreate(records("organizations")),
    projectApplicationsList: async () => resultCreate([]),
    projectGrantsList: async () => resultCreate([]),
    projectRolesList: async () => resultCreate([]),
    projectsList: async () => resultCreate([]),
    usersList: async () => {
      calls.push("humans")
      return resultCreate(records("users"))
    },
    machineUsersList: async () => {
      calls.push("machines")
      return resultCreate([machine])
    },
  }
  const result = await zitadelMigrationExport({ api: api as never })
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(calls).toEqual(["humans", "machines"])
  expect(result.data.snapshot.machineUsers).toMatchObject([
    { name: "Worker", organizationId: "323456789012345678", sourceId: "machine-1" },
  ])
  expect(result.data.snapshot.users.every((user) => user.id !== "machine-1")).toBe(true)
})
