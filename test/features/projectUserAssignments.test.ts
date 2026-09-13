import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { accountEffectiveAccessList } from "../../src/features/account/actions/accountEffectiveAccessList.js"
import { authorizationUserActorContextCreate } from "../../src/features/authorization/domain/authorizationUserActorContextCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { projectAccessCheck } from "../../src/features/projects/actions/projectAccessCheck.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectLifecycleSet } from "../../src/features/projects/actions/projectLifecycleSet.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectRoleList } from "../../src/features/projects/actions/projectRoleList.js"
import { projectUserAssignmentCreate } from "../../src/features/projects/actions/projectUserAssignmentCreate.js"
import { projectUserAssignmentList } from "../../src/features/projects/actions/projectUserAssignmentList.js"
import { projectUserAssignmentRemove } from "../../src/features/projects/actions/projectUserAssignmentRemove.js"
import { projectUserAssignmentUpdate } from "../../src/features/projects/actions/projectUserAssignmentUpdate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-project-user-assignments-"))
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

function createUser(database: StorageDatabase, realmId: string, email: string) {
  const result = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email, profile: { displayName: email }, userName: email.split("@")[0] ?? email },
    realmId,
  })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data.user
}

function activateUser(database: StorageDatabase, realmId: string, userId: string) {
  const result = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId,
  })
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data.user
}

test("project user assignments support membership, project roles, updates, removal, and events", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "assignments.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Assignments" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        authorizationRequired: false,
        name: "Assignments project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const role = projectRoleCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Reader", key: "reader" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    const membershipUser = createUser(database, realm.id, "membership@example.com")
    const roleUser = createUser(database, realm.id, "role@example.com")
    const invalidRoleUser = createUser(database, realm.id, "invalid-role@example.com")

    const membership = projectUserAssignmentCreate({
      context: realmSystemContextCreate(),
      database,
      input: { userId: membershipUser.id },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(membership).toMatchObject({ success: true, data: { assignment: { roleKeys: [] } } })
    if (!membership.success) return
    const withRole = projectUserAssignmentCreate({
      context: realmSystemContextCreate(),
      database,
      input: { roleKeys: ["reader"], userId: roleUser.id },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(withRole).toMatchObject({ success: true, data: { assignment: { roleKeys: ["reader"] } } })
    if (!withRole.success) return
    expect(
      projectUserAssignmentCreate({
        context: realmSystemContextCreate(),
        database,
        input: { userId: membershipUser.id },
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ success: false, code: "projects.already-exists" })
    expect(
      projectUserAssignmentCreate({
        context: realmSystemContextCreate(),
        database,
        input: { roleKeys: ["missing"], userId: invalidRoleUser.id },
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ success: false, code: "projects.role-keys-invalid" })

    const listed = projectUserAssignmentList({
      context: realmSystemContextCreate(),
      database,
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(listed).toMatchObject({ success: true, data: { items: [{ roleKeys: [] }, { roleKeys: ["reader"] }] } })

    const updated = projectUserAssignmentUpdate({
      assignmentId: withRole.data.assignment.id,
      context: realmSystemContextCreate(),
      database,
      input: { roleKeys: [] },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(updated).toMatchObject({ success: true, data: { assignment: { roleKeys: [] } } })
    if (!updated.success) return
    expect(
      projectUserAssignmentUpdate({
        assignmentId: updated.data.assignment.id,
        context: realmSystemContextCreate(),
        database,
        input: { roleKeys: ["missing"] },
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ success: false, code: "projects.role-keys-invalid" })

    expect(
      projectUserAssignmentRemove({
        assignmentId: membership.data.assignment.id,
        context: realmSystemContextCreate(),
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toEqual({ data: { removed: true }, success: true })
    expect(
      projectUserAssignmentRemove({
        assignmentId: membership.data.assignment.id,
        context: realmSystemContextCreate(),
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toEqual({ data: { removed: true }, success: true })

    const assignmentEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateType === "project_user_assignment")
    expect(assignmentEvents.map((event) => event.eventType)).toEqual([
      "project.user_assignment_created",
      "project.user_assignment_created",
      "project.user_assignment_updated",
      "project.user_assignment_removed",
    ])
    expect(assignmentEvents.map((event) => event.aggregateVersion)).toEqual([1, 1, 2, 2])
  })
})

test("project user assignments validate realm users and project authorization atomically", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "assignments-alpha.example.com")
    const beta = await createRealm(database, "assignments-beta.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Assignments" },
      realmId: alpha.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        authorizationRequired: false,
        name: "Assignments project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: alpha.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const alphaUser = createUser(database, alpha.id, "alpha@example.com")
    const betaUser = createUser(database, beta.id, "beta@example.com")
    const before = database.db.select().from(storageEventTable).all().length

    expect(
      projectUserAssignmentCreate({
        context: realmSystemContextCreate(),
        correlationId: "",
        database,
        input: { userId: alphaUser.id },
        projectId: project.data.project.id,
        realmId: alpha.id,
      }),
    ).toMatchObject({ success: false })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(before)
    expect(
      projectUserAssignmentList({
        context: realmSystemContextCreate(),
        database,
        projectId: project.data.project.id,
        realmId: alpha.id,
      }),
    ).toMatchObject({ success: true, data: { items: [] } })
    expect(
      projectUserAssignmentCreate({
        context: realmSystemContextCreate(),
        database,
        input: { userId: betaUser.id },
        projectId: project.data.project.id,
        realmId: alpha.id,
      }),
    ).toMatchObject({ success: false, code: "users.not-found" })
    expect(
      projectUserAssignmentCreate({
        context: realmTenantContextCreate(beta.id, "not-a-member"),
        database,
        input: { userId: alphaUser.id },
        projectId: project.data.project.id,
        realmId: alpha.id,
      }),
    ).toMatchObject({ success: false, code: "projects.tenant-mismatch" })

    const forbiddenContext = {
      actor: authorizationUserActorContextCreate(alpha.id, "not-a-member"),
      actorId: "not-a-member",
      kind: "tenant" as const,
      realmId: alpha.id,
    }
    expect(
      projectUserAssignmentCreate({
        context: forbiddenContext,
        database,
        input: { userId: alphaUser.id },
        projectId: project.data.project.id,
        realmId: alpha.id,
      }),
    ).toMatchObject({ success: false, code: "projects.forbidden" })
  })
})

test("project user assignments authorize active users without granting management", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "assignment-access.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Assignments" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const project = projectCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        authorizationRequired: true,
        name: "Assigned project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: true,
      },
      realmId: realm.id,
    })
    expect(project.success).toBe(true)
    if (!project.success) return
    const role = projectRoleCreate({
      context: realmSystemContextCreate(),
      database,
      input: { displayName: "Administrator", key: "admin" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(role.success).toBe(true)
    if (!role.success) return
    const assignedUser = activateUser(database, realm.id, createUser(database, realm.id, "assigned@example.com").id)
    const otherUser = activateUser(database, realm.id, createUser(database, realm.id, "other@example.com").id)
    const assignment = projectUserAssignmentCreate({
      context: realmSystemContextCreate(),
      database,
      input: { userId: assignedUser.id },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(assignment.success).toBe(true)
    if (!assignment.success) return
    const assignedContext = realmTenantContextCreate(realm.id, assignedUser.id)
    expect(
      projectAccessCheck({
        context: assignedContext,
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ data: { roleKeys: [] }, success: true })
    expect(
      projectUserAssignmentList({
        context: assignedContext,
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "projects.forbidden", success: false })
    expect(
      projectRoleList({
        context: assignedContext,
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "projects.forbidden", success: false })
    const membershipAccess = accountEffectiveAccessList({
      actor: authorizationUserActorContextCreate(realm.id, assignedUser.id),
      database,
      realmId: realm.id,
    })
    expect(membershipAccess).toMatchObject({ success: true })
    if (!membershipAccess.success) return
    expect(membershipAccess.data.items).toContainEqual(
      expect.objectContaining({
        permissions: [],
        project: expect.objectContaining({ id: project.data.project.id }),
        roleKeys: [],
        source: "project-assignment",
      }),
    )
    expect(
      projectUserAssignmentCreate({
        context: assignedContext,
        database,
        input: { userId: otherUser.id },
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "projects.forbidden", success: false })

    const roleUpdated = projectUserAssignmentUpdate({
      assignmentId: assignment.data.assignment.id,
      context: realmSystemContextCreate(),
      database,
      input: { roleKeys: ["admin"] },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(roleUpdated).toMatchObject({ data: { assignment: { roleKeys: ["admin"] } }, success: true })
    expect(
      projectAccessCheck({
        context: assignedContext,
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ data: { roleKeys: ["admin"] }, success: true })
    const roleAccess = accountEffectiveAccessList({
      actor: authorizationUserActorContextCreate(realm.id, assignedUser.id),
      database,
      realmId: realm.id,
    })
    expect(roleAccess.success).toBe(true)
    if (!roleAccess.success) return
    const roleEntry = roleAccess.data.items.find((item) => item.source === "project-assignment")
    expect(roleEntry?.permissions).toContain("project.read")
    expect(roleEntry?.permissions).not.toContain("project.write")

    const cleared = projectUserAssignmentUpdate({
      assignmentId: assignment.data.assignment.id,
      context: realmSystemContextCreate(),
      database,
      input: { roleKeys: [] },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(cleared).toMatchObject({ data: { assignment: { roleKeys: [] } }, success: true })
    const inactive = userLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { state: "inactive" },
      realmId: realm.id,
      userId: assignedUser.id,
    })
    expect(inactive.success).toBe(true)
    expect(
      projectAccessCheck({
        context: assignedContext,
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "projects.forbidden", success: false })
    const removed = projectUserAssignmentRemove({
      assignmentId: assignment.data.assignment.id,
      context: realmSystemContextCreate(),
      database,
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(removed).toMatchObject({ data: { removed: true }, success: true })
    const reactivated = userLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { state: "active" },
      realmId: realm.id,
      userId: assignedUser.id,
    })
    expect(reactivated.success).toBe(true)
    const afterRemoval = accountEffectiveAccessList({
      actor: authorizationUserActorContextCreate(realm.id, assignedUser.id),
      database,
      realmId: realm.id,
    })
    expect(afterRemoval.success).toBe(true)
    if (afterRemoval.success)
      expect(afterRemoval.data.items.some((item) => item.project?.id === project.data.project.id)).toBe(false)

    const secondAssignment = projectUserAssignmentCreate({
      context: realmSystemContextCreate(),
      database,
      input: { userId: otherUser.id },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(secondAssignment.success).toBe(true)
    const inactiveProject = projectLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { status: "inactive" },
      projectId: project.data.project.id,
      realmId: realm.id,
    })
    expect(inactiveProject.success).toBe(true)
    expect(
      projectAccessCheck({
        context: realmTenantContextCreate(realm.id, otherUser.id),
        database,
        projectId: project.data.project.id,
        realmId: realm.id,
      }),
    ).toMatchObject({ code: "projects.not-found", success: false })
  })
})
