import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { authorizationUserActorContextCreate } from "../../src/features/authorization/domain/authorizationUserActorContextCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { projectApplicationCreate } from "../../src/features/projects/actions/projectApplicationCreate.js"
import { projectApplicationGet } from "../../src/features/projects/actions/projectApplicationGet.js"
import { projectApplicationLifecycleSet } from "../../src/features/projects/actions/projectApplicationLifecycleSet.js"
import { projectApplicationList } from "../../src/features/projects/actions/projectApplicationList.js"
import { projectApplicationUpdate } from "../../src/features/projects/actions/projectApplicationUpdate.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectDelete } from "../../src/features/projects/actions/projectDelete.js"
import { projectGet } from "../../src/features/projects/actions/projectGet.js"
import { projectGrantCreate } from "../../src/features/projects/actions/projectGrantCreate.js"
import { projectGrantLifecycleSet } from "../../src/features/projects/actions/projectGrantLifecycleSet.js"
import { projectGrantUpdate } from "../../src/features/projects/actions/projectGrantUpdate.js"
import { projectLifecycleSet } from "../../src/features/projects/actions/projectLifecycleSet.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectRoleList } from "../../src/features/projects/actions/projectRoleList.js"
import { projectRoleUpdate } from "../../src/features/projects/actions/projectRoleUpdate.js"
import { projectUpdate } from "../../src/features/projects/actions/projectUpdate.js"
import { projectApiClientCreate } from "../../src/features/projects/client/projectApiClientCreate.js"
import { projectServerAppCreate } from "../../src/features/projects/server/projectServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { httpDateFormat } from "../../src/platform/http/httpDateFormat.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-projects-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createRealm(database: StorageDatabase, domain: string) {
  const result = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data.realm
}

async function createOrganization(database: StorageDatabase, realmId: string, name: string, ownerUserId: string) {
  const result = organizationCreate({
    context: realmSystemContextCreate(),
    database,
    input: { name, ownerUserId },
    realmId,
  })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data.organization
}

function actorTenantContext(actor: ReturnType<typeof authorizationUserActorContextCreate>) {
  return { actor, actorId: actor.actorId, realmId: actor.realmId ?? "", kind: "tenant" as const }
}

test("projects, applications, roles, and lifecycles are tenant-isolated", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "projects-alpha.example.com")
    const beta = await createRealm(database, "projects-beta.example.com")
    const alphaOrganization = await createOrganization(database, alpha.id, "Alpha", "alpha-owner")
    const betaOrganization = await createOrganization(database, beta.id, "Beta", "beta-owner")
    const alphaContext = realmTenantContextCreate(alpha.id, "alpha-owner")
    const created = projectCreate({
      context: alphaContext,
      database,
      input: {
        authorizationRequired: false,
        name: "Alpha project",
        organizationId: alphaOrganization.id,
        projectAccessRequired: true,
      },
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(
      projectGet({ context: alphaContext, database, realmId: beta.id, projectId: created.data.project.id }).success,
    ).toBe(false)
    expect(
      projectCreate({
        context: realmTenantContextCreate(beta.id, "beta-owner"),
        database,
        input: {
          authorizationRequired: false,
          name: "Wrong tenant",
          organizationId: alphaOrganization.id,
          projectAccessRequired: false,
        },
        realmId: beta.id,
      }).success,
    ).toBe(false)
    expect(betaOrganization.realmId).toBe(beta.id)
    const application = projectApplicationCreate({
      context: alphaContext,
      database,
      input: { applicationType: "api", name: "Alpha API" },
      realmId: alpha.id,
      projectId: created.data.project.id,
    })
    expect(application.success).toBe(true)
    if (!application.success) return
    expect(
      projectApplicationLifecycleSet({
        applicationId: application.data.application.id,
        context: alphaContext,
        database,
        input: { status: "inactive" },
        realmId: alpha.id,
        projectId: created.data.project.id,
      }).success,
    ).toBe(true)
    expect(
      projectApplicationLifecycleSet({
        applicationId: application.data.application.id,
        context: alphaContext,
        database,
        input: { status: "inactive" },
        realmId: alpha.id,
        projectId: created.data.project.id,
      }).success,
    ).toBe(false)
    const listedApplications = projectApplicationList({
      context: alphaContext,
      database,
      realmId: alpha.id,
      projectId: created.data.project.id,
    })
    expect(listedApplications.success).toBe(true)
    if (listedApplications.success) expect(listedApplications.data.items).toHaveLength(0)
  })
})

test("project lifecycle guards and updates preserve active-resource rules", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "project-rules.example.com")
    const ownerOrganization = await createOrganization(database, realm.id, "Owner", "owner-user")
    const otherOrganization = await createOrganization(database, realm.id, "Other", "other-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(realm.id, "owner-user", ownerOrganization.id),
    )
    const project = projectCreate({
      context: ownerContext,
      database,
      input: {
        authorizationRequired: false,
        name: "Project",
        organizationId: ownerOrganization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return

    expect(
      projectLifecycleSet({
        context: ownerContext,
        database,
        input: { status: "active" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)

    const renamed = projectUpdate({
      context: ownerContext,
      database,
      input: { authorizationRequired: true, name: "Renamed" },
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(renamed).toMatchObject({
      success: true,
      data: { project: { authorizationRequired: true, name: "Renamed", projectAccessRequired: false } },
    })

    const duplicateProject = projectCreate({
      context: ownerContext,
      database,
      input: {
        authorizationRequired: false,
        name: "Another project",
        organizationId: ownerOrganization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(duplicateProject.success).toBe(true)
    if (!duplicateProject.success) return
    expect(
      projectUpdate({
        context: ownerContext,
        database,
        input: { name: "Renamed" },
        realmId: realm.id,
        projectId: duplicateProject.data.project.id,
      }).success,
    ).toBe(false)

    const sameNameInOtherOrganization = projectCreate({
      context: actorTenantContext(authorizationUserActorContextCreate(realm.id, "other-user", otherOrganization.id)),
      database,
      input: {
        authorizationRequired: false,
        name: "Renamed",
        organizationId: otherOrganization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(sameNameInOtherOrganization.success).toBe(true)

    expect(
      projectLifecycleSet({
        context: ownerContext,
        database,
        input: { status: "inactive" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(true)
    expect(
      projectLifecycleSet({
        context: ownerContext,
        database,
        input: { status: "inactive" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectUpdate({
        context: ownerContext,
        database,
        input: { name: "Inactive update" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
  })
})

test("application, role, and grant state guards reject stale or cross-scope changes", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "project-children.example.com")
    const ownerOrganization = await createOrganization(database, realm.id, "Owner", "owner-user")
    const grantedOrganization = await createOrganization(database, realm.id, "Granted", "granted-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(realm.id, "owner-user", ownerOrganization.id),
    )
    const project = projectCreate({
      context: ownerContext,
      database,
      input: {
        authorizationRequired: false,
        name: "Project",
        organizationId: ownerOrganization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return

    const role = projectRoleCreate({
      context: ownerContext,
      database,
      input: { displayName: "Reader", key: "reader" },
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    expect(
      projectRoleUpdate({
        context: ownerContext,
        database,
        input: {},
        realmId: realm.id,
        projectId: project.data.project.id,
        roleId: role.data.role.id,
      }).success,
    ).toBe(false)
    expect(
      projectRoleUpdate({
        context: ownerContext,
        database,
        input: { displayName: "Updated reader" },
        realmId: realm.id,
        projectId: project.data.project.id,
        roleId: role.data.role.id,
      }).success,
    ).toBe(true)

    const application = projectApplicationCreate({
      context: ownerContext,
      database,
      input: { applicationType: "api", name: "API" },
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(application.success).toBe(true)
    if (!application.success) return
    expect(
      projectApplicationUpdate({
        applicationId: application.data.application.id,
        context: ownerContext,
        database,
        input: { name: "Updated API" },
        realmId: realm.id,
        projectId: "wrong-project",
      }).success,
    ).toBe(false)
    expect(
      projectApplicationLifecycleSet({
        applicationId: application.data.application.id,
        context: ownerContext,
        database,
        input: { status: "active" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)

    const grant = projectGrantCreate({
      context: ownerContext,
      database,
      input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["reader"] },
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return
    expect(
      projectGrantCreate({
        context: ownerContext,
        database,
        input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["reader"] },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGrantUpdate({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { grantedOrganizationId: ownerOrganization.id, roleKeys: ["reader"] },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGrantLifecycleSet({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { status: "active" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
  })
})

test("project roles and cross-organization grants enforce access and revocation", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "grants.example.com")
    const ownerOrganization = await createOrganization(database, realm.id, "Owner", "owner-user")
    const grantedOrganization = await createOrganization(database, realm.id, "Granted", "granted-user")
    const otherOrganization = await createOrganization(database, realm.id, "Other", "other-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(realm.id, "owner-user", ownerOrganization.id),
    )
    const grantedContext = actorTenantContext(
      authorizationUserActorContextCreate(realm.id, "granted-user", grantedOrganization.id),
    )
    const otherContext = actorTenantContext(
      authorizationUserActorContextCreate(realm.id, "other-user", otherOrganization.id),
    )
    const project = projectCreate({
      context: ownerContext,
      database,
      input: {
        authorizationRequired: true,
        name: "Granted project",
        organizationId: ownerOrganization.id,
        projectAccessRequired: true,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const role = projectRoleCreate({
      context: ownerContext,
      database,
      input: { displayName: "Administrator", key: "admin" },
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    expect(
      projectRoleCreate({
        context: ownerContext,
        database,
        input: { displayName: "Duplicate", key: "admin" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGrantCreate({
        context: ownerContext,
        database,
        input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["missing"] },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    const grant = projectGrantCreate({
      context: ownerContext,
      database,
      input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["admin"] },
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return
    expect(
      projectGet({ context: grantedContext, database, realmId: realm.id, projectId: project.data.project.id }).success,
    ).toBe(true)
    expect(
      projectGet({ context: otherContext, database, realmId: realm.id, projectId: project.data.project.id }).success,
    ).toBe(false)
    expect(
      projectUpdate({
        context: grantedContext,
        database,
        input: { name: "Granted update" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectRoleCreate({
        context: grantedContext,
        database,
        input: { displayName: "Granted writer", key: "granted-writer" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    const inactive = projectGrantLifecycleSet({
      context: ownerContext,
      database,
      grantId: grant.data.grant.id,
      input: { status: "inactive" },
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(inactive.success).toBe(true)
    expect(
      projectGrantLifecycleSet({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { status: "inactive" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGet({ context: grantedContext, database, realmId: realm.id, projectId: project.data.project.id }).success,
    ).toBe(false)
    expect(
      projectGrantLifecycleSet({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { status: "active" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(true)
    const roles = projectRoleList({
      context: grantedContext,
      database,
      realmId: realm.id,
      projectId: project.data.project.id,
    })
    expect(roles.success).toBe(true)
    expect(role.data.role.key).toBe("admin")
  })
})

test("project deletion is idempotent and leaves no readable parent", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "project-delete.example.com")
    const organization = await createOrganization(database, realm.id, "Owner", "owner-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(realm.id, "owner-user", organization.id),
    )
    const project = projectCreate({
      context: ownerContext,
      database,
      input: {
        authorizationRequired: false,
        name: "To delete",
        organizationId: organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return

    const eventCount = database.db.select().from(storageEventTable).all().length
    expect(
      projectDelete({
        context: ownerContext,
        database,
        realmId: realm.id,
        projectId: project.data.project.id,
      }),
    ).toEqual({ data: { deleted: true, projectId: project.data.project.id }, success: true })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount + 1)
    expect(
      projectDelete({
        context: ownerContext,
        database,
        realmId: realm.id,
        projectId: project.data.project.id,
      }),
    ).toEqual({ data: { deleted: true, projectId: project.data.project.id }, success: true })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount + 1)
    expect(
      projectGet({ context: ownerContext, database, realmId: realm.id, projectId: project.data.project.id }).success,
    ).toBe(false)
    expect(
      projectRoleCreate({
        context: ownerContext,
        database,
        input: { displayName: "Unreachable", key: "unreachable" },
        realmId: realm.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
  })
})

test("membership authorization and state plus event writes are atomic", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "atomic.example.com")
    const organization = await createOrganization(database, realm.id, "Atomic", "owner")
    const member = organizationMembershipCreate({
      context: realmTenantContextCreate(realm.id, "owner"),
      database,
      input: { roles: ["member"], userId: "member" },
      realmId: realm.id,
      organizationId: organization.id,
    })
    expect(member.success).toBe(true)
    expect(
      projectCreate({
        context: actorTenantContext(authorizationUserActorContextCreate(realm.id, "member", organization.id)),
        database,
        input: {
          authorizationRequired: false,
          name: "Denied",
          organizationId: organization.id,
          projectAccessRequired: false,
        },
        realmId: realm.id,
      }).success,
    ).toBe(false)
    const eventCount = database.db.select().from(storageEventTable).all().length
    const failed = projectCreate({
      context: realmSystemContextCreate(),
      correlationId: "",
      database,
      input: {
        authorizationRequired: false,
        name: "Rolled back",
        organizationId: organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(failed.success).toBe(false)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)
    expect(
      projectGet({ context: realmSystemContextCreate(), database, realmId: realm.id, projectId: "missing" }).success,
    ).toBe(false)
  })
})

test("project routes, API client, and CLI expose public contracts", async () => {
  await withDatabase(async (database) => {
    const app = projectServerAppCreate({ database, systemSecret: "project-secret" })
    const realm = await createRealm(database, "api-projects.example.com")
    const client = projectApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "project-secret",
    })
    const organization = await createOrganization(database, realm.id, "API owner", "api-owner")
    const created = await client.projectCreate(realm.id, {
      authorizationRequired: false,
      name: "API project",
      organizationId: organization.id,
      projectAccessRequired: false,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const fetched = await client.projectGet(realm.id, created.data.project.id)
    expect(fetched.success).toBe(true)
    if (!fetched.success || fetched.status !== "current") return
    expect(fetched.data.project).toBeDefined()
    expect(fetched.lastModified).toEqual(new Date(Math.floor(fetched.data.project.updatedAt / 1000) * 1000))
    if (fetched.lastModified === undefined) return

    const conditional = await app.request(
      `http://server.test/system/realms/${realm.id}/projects/${created.data.project.id}`,
      {
        headers: {
          authorization: "Bearer project-secret",
          "if-modified-since": httpDateFormat(fetched.lastModified),
        },
      },
    )
    expect(conditional.status).toBe(304)
    expect(await conditional.text()).toBe("")
    expect(conditional.headers.get("last-modified")).toBe(httpDateFormat(fetched.lastModified))
    expect(conditional.headers.get("cache-control")).toBe("private, no-cache")

    const unchanged = await client.projectGet(realm.id, created.data.project.id, {
      ifModifiedSince: fetched.lastModified,
    })
    expect(unchanged.success).toBe(true)
    if (!unchanged.success) return
    expect(unchanged.status).toBe("unchanged")
    const listed = await client.projectList(realm.id)
    expect(listed.success).toBe(true)
    const unauthorized = await projectApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).projectList(realm.id)
    expect(unauthorized.success).toBe(false)
  })
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "projects", "--help"], { stderr: "pipe", stdout: "pipe" })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Project, application, role, and grant administration")
})
