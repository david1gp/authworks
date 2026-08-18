import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
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
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectRoleList } from "../../src/features/projects/actions/projectRoleList.js"
import { projectRoleUpdate } from "../../src/features/projects/actions/projectRoleUpdate.js"
import { projectLifecycleSet } from "../../src/features/projects/actions/projectLifecycleSet.js"
import { projectUpdate } from "../../src/features/projects/actions/projectUpdate.js"
import { projectServerAppCreate } from "../../src/features/projects/server/projectServerAppCreate.js"
import { projectApiClientCreate } from "../../src/features/projects/client/projectApiClientCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-projects-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createInstance(database: StorageDatabase, domain: string) {
  const result = instanceCreate({ context: instanceSystemContextCreate(), database, input: { domain, name: domain } })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data.instance
}

async function createOrganization(database: StorageDatabase, instanceId: string, name: string, ownerUserId: string) {
  const result = organizationCreate({
    context: instanceSystemContextCreate(),
    database,
    input: { name, ownerUserId },
    instanceId,
  })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data.organization
}

function actorTenantContext(actor: ReturnType<typeof authorizationUserActorContextCreate>) {
  return { actor, actorId: actor.actorId, instanceId: actor.instanceId ?? "", kind: "tenant" as const }
}

test("projects, applications, roles, and lifecycles are tenant-isolated", async () => {
  await withDatabase(async (database) => {
    const alpha = await createInstance(database, "projects-alpha.example.com")
    const beta = await createInstance(database, "projects-beta.example.com")
    const alphaOrganization = await createOrganization(database, alpha.id, "Alpha", "alpha-owner")
    const betaOrganization = await createOrganization(database, beta.id, "Beta", "beta-owner")
    const alphaContext = instanceTenantContextCreate(alpha.id, "alpha-owner")
    const created = projectCreate({
      context: alphaContext,
      database,
      input: {
        authorizationRequired: false,
        name: "Alpha project",
        organizationId: alphaOrganization.id,
        projectAccessRequired: true,
      },
      instanceId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(
      projectGet({ context: alphaContext, database, instanceId: beta.id, projectId: created.data.project.id }).success,
    ).toBe(false)
    expect(
      projectCreate({
        context: instanceTenantContextCreate(beta.id, "beta-owner"),
        database,
        input: {
          authorizationRequired: false,
          name: "Wrong tenant",
          organizationId: alphaOrganization.id,
          projectAccessRequired: false,
        },
        instanceId: beta.id,
      }).success,
    ).toBe(false)
    expect(betaOrganization.instanceId).toBe(beta.id)
    const application = projectApplicationCreate({
      context: alphaContext,
      database,
      input: { applicationType: "api", name: "Alpha API" },
      instanceId: alpha.id,
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
        instanceId: alpha.id,
        projectId: created.data.project.id,
      }).success,
    ).toBe(true)
    expect(
      projectApplicationLifecycleSet({
        applicationId: application.data.application.id,
        context: alphaContext,
        database,
        input: { status: "inactive" },
        instanceId: alpha.id,
        projectId: created.data.project.id,
      }).success,
    ).toBe(false)
    const listedApplications = projectApplicationList({
      context: alphaContext,
      database,
      instanceId: alpha.id,
      projectId: created.data.project.id,
    })
    expect(listedApplications.success).toBe(true)
    if (listedApplications.success) expect(listedApplications.data.applications).toHaveLength(0)
  })
})

test("project lifecycle guards and updates preserve active-resource rules", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "project-rules.example.com")
    const ownerOrganization = await createOrganization(database, instance.id, "Owner", "owner-user")
    const otherOrganization = await createOrganization(database, instance.id, "Other", "other-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(instance.id, "owner-user", ownerOrganization.id),
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
      instanceId: instance.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return

    expect(
      projectLifecycleSet({
        context: ownerContext,
        database,
        input: { status: "active" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)

    const renamed = projectUpdate({
      context: ownerContext,
      database,
      input: { authorizationRequired: true, name: "Renamed" },
      instanceId: instance.id,
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
      instanceId: instance.id,
    })
    expect(duplicateProject.success).toBe(true)
    if (!duplicateProject.success) return
    expect(
      projectUpdate({
        context: ownerContext,
        database,
        input: { name: "Renamed" },
        instanceId: instance.id,
        projectId: duplicateProject.data.project.id,
      }).success,
    ).toBe(false)

    const sameNameInOtherOrganization = projectCreate({
      context: actorTenantContext(authorizationUserActorContextCreate(instance.id, "other-user", otherOrganization.id)),
      database,
      input: {
        authorizationRequired: false,
        name: "Renamed",
        organizationId: otherOrganization.id,
        projectAccessRequired: false,
      },
      instanceId: instance.id,
    })
    expect(sameNameInOtherOrganization.success).toBe(true)

    expect(
      projectLifecycleSet({
        context: ownerContext,
        database,
        input: { status: "inactive" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(true)
    expect(
      projectLifecycleSet({
        context: ownerContext,
        database,
        input: { status: "inactive" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectUpdate({
        context: ownerContext,
        database,
        input: { name: "Inactive update" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
  })
})

test("application, role, and grant state guards reject stale or cross-scope changes", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "project-children.example.com")
    const ownerOrganization = await createOrganization(database, instance.id, "Owner", "owner-user")
    const grantedOrganization = await createOrganization(database, instance.id, "Granted", "granted-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(instance.id, "owner-user", ownerOrganization.id),
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
      instanceId: instance.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return

    const role = projectRoleCreate({
      context: ownerContext,
      database,
      input: { displayName: "Reader", key: "reader" },
      instanceId: instance.id,
      projectId: project.data.project.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    expect(
      projectRoleUpdate({
        context: ownerContext,
        database,
        input: {},
        instanceId: instance.id,
        projectId: project.data.project.id,
        roleId: role.data.role.id,
      }).success,
    ).toBe(false)
    expect(
      projectRoleUpdate({
        context: ownerContext,
        database,
        input: { displayName: "Updated reader" },
        instanceId: instance.id,
        projectId: project.data.project.id,
        roleId: role.data.role.id,
      }).success,
    ).toBe(true)

    const application = projectApplicationCreate({
      context: ownerContext,
      database,
      input: { applicationType: "api", name: "API" },
      instanceId: instance.id,
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
        instanceId: instance.id,
        projectId: "wrong-project",
      }).success,
    ).toBe(false)
    expect(
      projectApplicationLifecycleSet({
        applicationId: application.data.application.id,
        context: ownerContext,
        database,
        input: { status: "active" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)

    const grant = projectGrantCreate({
      context: ownerContext,
      database,
      input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["reader"] },
      instanceId: instance.id,
      projectId: project.data.project.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return
    expect(
      projectGrantCreate({
        context: ownerContext,
        database,
        input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["reader"] },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGrantUpdate({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { grantedOrganizationId: ownerOrganization.id, roleKeys: ["reader"] },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGrantLifecycleSet({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { status: "active" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
  })
})

test("project roles and cross-organization grants enforce access and revocation", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "grants.example.com")
    const ownerOrganization = await createOrganization(database, instance.id, "Owner", "owner-user")
    const grantedOrganization = await createOrganization(database, instance.id, "Granted", "granted-user")
    const otherOrganization = await createOrganization(database, instance.id, "Other", "other-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(instance.id, "owner-user", ownerOrganization.id),
    )
    const grantedContext = actorTenantContext(
      authorizationUserActorContextCreate(instance.id, "granted-user", grantedOrganization.id),
    )
    const otherContext = actorTenantContext(
      authorizationUserActorContextCreate(instance.id, "other-user", otherOrganization.id),
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
      instanceId: instance.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const role = projectRoleCreate({
      context: ownerContext,
      database,
      input: { displayName: "Administrator", key: "admin" },
      instanceId: instance.id,
      projectId: project.data.project.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    expect(
      projectRoleCreate({
        context: ownerContext,
        database,
        input: { displayName: "Duplicate", key: "admin" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGrantCreate({
        context: ownerContext,
        database,
        input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["missing"] },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    const grant = projectGrantCreate({
      context: ownerContext,
      database,
      input: { grantedOrganizationId: grantedOrganization.id, roleKeys: ["admin"] },
      instanceId: instance.id,
      projectId: project.data.project.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return
    expect(
      projectGet({ context: grantedContext, database, instanceId: instance.id, projectId: project.data.project.id })
        .success,
    ).toBe(true)
    expect(
      projectGet({ context: otherContext, database, instanceId: instance.id, projectId: project.data.project.id })
        .success,
    ).toBe(false)
    expect(
      projectUpdate({
        context: grantedContext,
        database,
        input: { name: "Granted update" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectRoleCreate({
        context: grantedContext,
        database,
        input: { displayName: "Granted writer", key: "granted-writer" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    const inactive = projectGrantLifecycleSet({
      context: ownerContext,
      database,
      grantId: grant.data.grant.id,
      input: { status: "inactive" },
      instanceId: instance.id,
      projectId: project.data.project.id,
    })
    expect(inactive.success).toBe(true)
    expect(
      projectGrantLifecycleSet({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { status: "inactive" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
    expect(
      projectGet({ context: grantedContext, database, instanceId: instance.id, projectId: project.data.project.id })
        .success,
    ).toBe(false)
    expect(
      projectGrantLifecycleSet({
        context: ownerContext,
        database,
        grantId: grant.data.grant.id,
        input: { status: "active" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(true)
    const roles = projectRoleList({
      context: grantedContext,
      database,
      instanceId: instance.id,
      projectId: project.data.project.id,
    })
    expect(roles.success).toBe(true)
    expect(role.data.role.key).toBe("admin")
  })
})

test("project deletion is idempotent and leaves no readable parent", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "project-delete.example.com")
    const organization = await createOrganization(database, instance.id, "Owner", "owner-user")
    const ownerContext = actorTenantContext(
      authorizationUserActorContextCreate(instance.id, "owner-user", organization.id),
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
      instanceId: instance.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return

    const eventCount = database.db.select().from(storageEventTable).all().length
    expect(
      projectDelete({
        context: ownerContext,
        database,
        instanceId: instance.id,
        projectId: project.data.project.id,
      }),
    ).toEqual({ data: { deleted: true, projectId: project.data.project.id }, success: true })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount + 1)
    expect(
      projectDelete({
        context: ownerContext,
        database,
        instanceId: instance.id,
        projectId: project.data.project.id,
      }),
    ).toEqual({ data: { deleted: true, projectId: project.data.project.id }, success: true })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount + 1)
    expect(
      projectGet({ context: ownerContext, database, instanceId: instance.id, projectId: project.data.project.id })
        .success,
    ).toBe(false)
    expect(
      projectRoleCreate({
        context: ownerContext,
        database,
        input: { displayName: "Unreachable", key: "unreachable" },
        instanceId: instance.id,
        projectId: project.data.project.id,
      }).success,
    ).toBe(false)
  })
})

test("membership authorization and state plus event writes are atomic", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "atomic.example.com")
    const organization = await createOrganization(database, instance.id, "Atomic", "owner")
    const member = organizationMembershipCreate({
      context: instanceTenantContextCreate(instance.id, "owner"),
      database,
      input: { roles: ["member"], userId: "member" },
      instanceId: instance.id,
      organizationId: organization.id,
    })
    expect(member.success).toBe(true)
    expect(
      projectCreate({
        context: actorTenantContext(authorizationUserActorContextCreate(instance.id, "member", organization.id)),
        database,
        input: {
          authorizationRequired: false,
          name: "Denied",
          organizationId: organization.id,
          projectAccessRequired: false,
        },
        instanceId: instance.id,
      }).success,
    ).toBe(false)
    const eventCount = database.db.select().from(storageEventTable).all().length
    const failed = projectCreate({
      context: instanceSystemContextCreate(),
      correlationId: "",
      database,
      input: {
        authorizationRequired: false,
        name: "Rolled back",
        organizationId: organization.id,
        projectAccessRequired: false,
      },
      instanceId: instance.id,
    })
    expect(failed.success).toBe(false)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)
    expect(
      projectGet({ context: instanceSystemContextCreate(), database, instanceId: instance.id, projectId: "missing" })
        .success,
    ).toBe(false)
  })
})

test("project routes, API client, and CLI expose public contracts", async () => {
  await withDatabase(async (database) => {
    const app = projectServerAppCreate({ database, systemSecret: "project-secret" })
    const instance = await createInstance(database, "api-projects.example.com")
    const client = projectApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "project-secret",
    })
    const organization = await createOrganization(database, instance.id, "API owner", "api-owner")
    const created = await client.projectCreate(instance.id, {
      authorizationRequired: false,
      name: "API project",
      organizationId: organization.id,
      projectAccessRequired: false,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const listed = await client.projectList(instance.id)
    expect(listed.success).toBe(true)
    const unauthorized = await projectApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).projectList(instance.id)
    expect(unauthorized.success).toBe(false)
  })
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "projects", "--help"], { stderr: "pipe", stdout: "pipe" })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Project, application, role, and grant administration")
})
