import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { projectApplicationCreate } from "../../src/features/projects/actions/projectApplicationCreate.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectGrantCreate } from "../../src/features/projects/actions/projectGrantCreate.js"
import { projectList } from "../../src/features/projects/actions/projectList.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectUserAssignmentCreate } from "../../src/features/projects/actions/projectUserAssignmentCreate.js"
import { projectServerAppCreate } from "../../src/features/projects/server/projectServerAppCreate.js"
import { projectUserAssignmentListByUser } from "../../src/features/projects/server/projectUserAssignmentListByUser.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-projects-organization-filter-"))
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
  const activated = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId: result.data.user.id,
  })
  expect(activated.success).toBe(true)
  if (!activated.success) throw new Error(activated.errorMessage)
  return activated.data.user
}

test("project list filters owned and granted projects by organization and reports counts", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = await createRealm(database, "project-organization-filter.example.com")
    const granted = organizationCreate({ context: system, database, input: { name: "Granted" }, realmId: realm.id })
    expect(granted.success).toBe(true)
    if (!granted.success) return
    const other = organizationCreate({ context: system, database, input: { name: "Other" }, realmId: realm.id })
    expect(other.success).toBe(true)
    if (!other.success) return
    const grantedOrganizationId = granted.data.organization.id
    const otherOrganizationId = other.data.organization.id

    const owned = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Owned project",
        organizationId: grantedOrganizationId,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(owned.success).toBe(true)
    if (!owned.success) return
    const shared = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Shared project",
        organizationId: otherOrganizationId,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(shared.success).toBe(true)
    if (!shared.success) return
    const excluded = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Excluded project",
        organizationId: otherOrganizationId,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(excluded.success).toBe(true)
    if (!excluded.success) return
    const ownedRole = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Owner reader", key: "reader" },
      projectId: owned.data.project.id,
      realmId: realm.id,
    })
    expect(ownedRole.success).toBe(true)
    const ownedApplication = projectApplicationCreate({
      context: system,
      database,
      input: { applicationType: "api", name: "Owned API" },
      projectId: owned.data.project.id,
      realmId: realm.id,
    })
    expect(ownedApplication.success).toBe(true)
    const sharedRole = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Shared reader", key: "reader" },
      projectId: shared.data.project.id,
      realmId: realm.id,
    })
    expect(sharedRole.success).toBe(true)
    const grant = projectGrantCreate({
      context: system,
      database,
      input: { grantedOrganizationId, roleKeys: ["reader"] },
      projectId: shared.data.project.id,
      realmId: realm.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return

    const filtered = projectList({
      context: system,
      database,
      organizationId: grantedOrganizationId,
      realmId: realm.id,
    })
    expect(filtered.success).toBe(true)
    if (!filtered.success) return
    expect(filtered.data.items.map((item) => item.id).sort()).toEqual(
      [owned.data.project.id, shared.data.project.id].sort(),
    )
    const ownedItem = filtered.data.items.find((item) => item.id === owned.data.project.id)
    const sharedItem = filtered.data.items.find((item) => item.id === shared.data.project.id)
    expect(ownedItem).toBeDefined()
    expect(sharedItem).toBeDefined()
    expect(filtered.data.items.some((item) => item.id === excluded.data.project.id)).toBe(false)
    expect(ownedItem).toMatchObject({ applicationCount: 1, roleCount: 1 })
    expect(sharedItem).toMatchObject({ applicationCount: 0, roleCount: 1 })

    const ownerView = projectList({
      context: system,
      database,
      organizationId: otherOrganizationId,
      realmId: realm.id,
    })
    expect(ownerView.success).toBe(true)
    if (!ownerView.success) return
    expect(ownerView.data.items.map((item) => item.id).sort()).toEqual(
      [shared.data.project.id, excluded.data.project.id].sort(),
    )
  })
})

test("tenant project list keeps authorization filtering when an organization filter applies", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const domain = "project-organization-tenant.example.com"
    const realm = await createRealm(database, domain)
    const owner = organizationCreate({ context: system, database, input: { name: "Owner" }, realmId: realm.id })
    expect(owner.success).toBe(true)
    if (!owner.success) return
    const granted = organizationCreate({ context: system, database, input: { name: "Granted" }, realmId: realm.id })
    expect(granted.success).toBe(true)
    if (!granted.success) return
    const member = createUser(database, realm.id, "granted-member@example.com")
    const memberContext = realmTenantContextCreate(realm.id, member.id)
    expect(memberContext.realmId).toBe(realm.id)

    const owned = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Owned project",
        organizationId: owner.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(owned.success).toBe(true)
    if (!owned.success) return
    const role = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Reader", key: "reader" },
      projectId: owned.data.project.id,
      realmId: realm.id,
    })
    expect(role.success).toBe(true)
    const grant = projectGrantCreate({
      context: system,
      database,
      input: { grantedOrganizationId: granted.data.organization.id, roleKeys: ["reader"] },
      projectId: owned.data.project.id,
      realmId: realm.id,
    })
    expect(grant.success).toBe(true)
    if (!grant.success) return

    const filtered = projectList({
      context: memberContext,
      database,
      organizationId: granted.data.organization.id,
      realmId: realm.id,
    })
    expect(filtered).toMatchObject({ data: { items: [] }, success: true })

    const unfiltered = projectList({ context: memberContext, database, realmId: realm.id })
    expect(unfiltered).toMatchObject({ data: { items: [] }, success: true })

    const app = projectServerAppCreate({ database, publicOrigin: `https://${domain}`, systemSecret: "filter-secret" })
    const invalid = await app.request(`https://${domain}/realms/${realm.id}/projects?organizationId=not-an-id`, {
      headers: { authorization: "Bearer member-token" },
    })
    expect([400, 401, 403].includes(invalid.status)).toBe(true)
  })
})

test("tenant project list route accepts the organizationId query parameter", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const domain = "project-organization-route.example.com"
    const realm = await createRealm(database, domain)
    const owned = organizationCreate({ context: system, database, input: { name: "Owned" }, realmId: realm.id })
    expect(owned.success).toBe(true)
    if (!owned.success) return
    const other = organizationCreate({ context: system, database, input: { name: "Other" }, realmId: realm.id })
    expect(other.success).toBe(true)
    if (!other.success) return
    const created = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Route project",
        organizationId: owned.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const app = projectServerAppCreate({ database, publicOrigin: `https://${domain}`, systemSecret: "filter-secret" })
    const systemList = await app.request(
      `https://${domain}/system/realms/${realm.id}/projects?organizationId=${owned.data.organization.id}&pageSize=100`,
      { headers: { authorization: "Bearer filter-secret" } },
    )
    expect(systemList.status).toBe(200)
    const systemBody = (await systemList.json()) as { items: { id: string }[] }
    expect(systemBody.items.map((item) => item.id)).toEqual([created.data.project.id])

    const systemInvalid = await app.request(
      `https://${domain}/system/realms/${realm.id}/projects?organizationId=not-an-id`,
      { headers: { authorization: "Bearer filter-secret" } },
    )
    expect(systemInvalid.status).toBe(400)
  })
})
test("projectUserAssignmentListByUser returns assignments across projects with role display names", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = await createRealm(database, "project-user-lookup.example.com")
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Lookup" },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const first = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "First project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    const second = projectCreate({
      context: system,
      database,
      input: {
        authorizationRequired: false,
        name: "Second project",
        organizationId: organization.data.organization.id,
        projectAccessRequired: false,
      },
      realmId: realm.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const firstRole = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "First reader", key: "reader" },
      projectId: first.data.project.id,
      realmId: realm.id,
    })
    expect(firstRole.success).toBe(true)
    const secondRole = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Second editor", key: "editor" },
      projectId: second.data.project.id,
      realmId: realm.id,
    })
    expect(secondRole.success).toBe(true)
    const user = createUser(database, realm.id, "lookup@example.com")

    const firstAssignment = projectUserAssignmentCreate({
      context: system,
      database,
      input: { roleKeys: ["reader"], userId: user.id },
      projectId: first.data.project.id,
      realmId: realm.id,
    })
    expect(firstAssignment.success).toBe(true)
    const secondAssignment = projectUserAssignmentCreate({
      context: system,
      database,
      input: { roleKeys: ["editor"], userId: user.id },
      projectId: second.data.project.id,
      realmId: realm.id,
    })
    expect(secondAssignment.success).toBe(true)
    if (!firstAssignment.success || !secondAssignment.success) return

    const listed = projectUserAssignmentListByUser({ database, realmId: realm.id, userId: user.id })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.map((entry) => entry.project.id).sort()).toEqual(
      [first.data.project.id, second.data.project.id].sort(),
    )
    const firstEntry = listed.data.find((entry) => entry.project.id === first.data.project.id)
    const secondEntry = listed.data.find((entry) => entry.project.id === second.data.project.id)
    expect(firstEntry?.assignment.id).toBe(firstAssignment.data.assignment.id)
    expect(firstEntry?.project).toMatchObject({ name: "First project" })
    expect(firstEntry?.roles).toEqual([{ displayName: "First reader", key: "reader" }])
    expect(secondEntry?.roles).toEqual([{ displayName: "Second editor", key: "editor" }])

    const missing = projectUserAssignmentListByUser({ database, realmId: realm.id, userId: "missing-user" })
    expect(missing).toMatchObject({ data: [], success: true })
  })
})
