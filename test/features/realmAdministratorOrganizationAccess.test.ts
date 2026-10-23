import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationGet } from "../../src/features/organizations/actions/organizationGet.js"
import { organizationList } from "../../src/features/organizations/actions/organizationList.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationMembershipList } from "../../src/features/organizations/actions/organizationMembershipList.js"
import { organizationMembershipUpdate } from "../../src/features/organizations/actions/organizationMembershipUpdate.js"
import { organizationSwitch } from "../../src/features/organizations/actions/organizationSwitch.js"
import { organizationUpdate } from "../../src/features/organizations/actions/organizationUpdate.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectList } from "../../src/features/projects/actions/projectList.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-realm-admin-organization-access-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function setupRealm(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate("system")
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const userSeed = (userName: string) => {
    const created = userCreate({
      context: system,
      database,
      input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const activated = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId,
      userId: created.data.user.id,
    })
    expect(activated.success).toBe(true)
    if (!activated.success) throw new Error(activated.errorMessage)
    return created.data.user.id
  }
  const ownerAId = userSeed(`access-owner-a-${domain.split(".")[0]}`)
  const adminAId = userSeed(`access-admin-a-${domain.split(".")[0]}`)
  const ownerBId = userSeed(`access-owner-b-${domain.split(".")[0]}`)
  const memberBId = userSeed(`access-member-b-${domain.split(".")[0]}`)
  const realmAdministratorId = userSeed(`access-realm-admin-${domain.split(".")[0]}`)
  const organizationA = organizationCreate({
    context: system,
    database,
    input: { name: "Access A", ownerUserId: ownerAId },
    realmId,
  })
  expect(organizationA.success).toBe(true)
  if (!organizationA.success) throw new Error(organizationA.errorMessage)
  const organizationB = organizationCreate({
    context: system,
    database,
    input: { name: "Access B", ownerUserId: ownerBId },
    realmId,
  })
  expect(organizationB.success).toBe(true)
  if (!organizationB.success) throw new Error(organizationB.errorMessage)
  for (const created of [
    organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, ownerAId),
      database,
      input: { roles: ["admin"], userId: adminAId },
      organizationId: organizationA.data.organization.id,
      realmId,
    }),
    organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      input: { roles: ["member"], userId: memberBId },
      organizationId: organizationB.data.organization.id,
      realmId,
    }),
    realmAdministratorGrant({ context: system, database, realmId, userId: realmAdministratorId }),
  ]) {
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
  }
  return {
    adminAId,
    memberBId,
    organizationA: organizationA.data.organization,
    organizationB: organizationB.data.organization,
    ownerAId,
    ownerBId,
    realmAdministratorId,
    realmId,
  }
}

test("realm administrators read and manage organizations without membership", async () => {
  await withDatabase(async (database) => {
    const { organizationB, realmAdministratorId, realmId } = await setupRealm(
      database,
      "realm-admin-org-access-a.example.com",
    )
    const context = realmTenantContextCreate(realmId, realmAdministratorId)
    const read = organizationGet({
      context,
      database,
      organizationId: organizationB.id,
      realmId,
    })
    expect(read.success).toBe(true)
    const renamed = organizationUpdate({
      context,
      database,
      input: { name: "Access B Renamed" },
      organizationId: organizationB.id,
      realmId,
    })
    expect(renamed.success).toBe(true)
    if (!renamed.success) return
    expect(renamed.data.organization.name).toBe("Access B Renamed")
    const memberships = organizationMembershipList({
      context,
      database,
      organizationId: organizationB.id,
      realmId,
    })
    expect(memberships.success).toBe(true)
    if (!memberships.success) return
    expect(memberships.data.items.length).toBeGreaterThan(0)
  })
})

test("realm administrators manage memberships and projects of organizations without membership", async () => {
  await withDatabase(async (database) => {
    const { memberBId, organizationB, realmAdministratorId, realmId } = await setupRealm(
      database,
      "realm-admin-org-access-b.example.com",
    )
    const context = realmTenantContextCreate(realmId, realmAdministratorId)
    const current = organizationMembershipList({
      context,
      database,
      organizationId: organizationB.id,
      realmId,
    })
    expect(current.success).toBe(true)
    if (!current.success) return
    const memberB = current.data.items.find((item) => item.userId === memberBId)
    expect(memberB).toBeDefined()
    if (memberB === undefined) return
    const managed = organizationMembershipUpdate({
      context,
      database,
      input: { roles: ["admin"] },
      membershipId: memberB.id,
      organizationId: organizationB.id,
      realmId,
    })
    expect(managed.success).toBe(true)
    const created = projectCreate({
      context,
      database,
      input: { name: "Realm Admin Project", organizationId: organizationB.id },
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const listed = projectList({ context, database, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.map((item) => item.id)).toContain(created.data.project.id)
  })
})

test("realm administrators switch into organizations without membership", async () => {
  await withDatabase(async (database) => {
    const { organizationB, realmAdministratorId, realmId } = await setupRealm(
      database,
      "realm-admin-org-access-c.example.com",
    )
    const switched = organizationSwitch({
      context: realmTenantContextCreate(realmId, realmAdministratorId),
      database,
      input: { organizationId: organizationB.id },
      realmId,
    })
    expect(switched.success).toBe(true)
    if (!switched.success) return
    expect(switched.data.activeOrganizationId).toBe(organizationB.id)
  })
})

test("tenant organization creation requires realm administrators", async () => {
  await withDatabase(async (database) => {
    const { ownerAId, realmAdministratorId, realmId } = await setupRealm(
      database,
      "realm-admin-org-access-d.example.com",
    )
    expect(
      organizationCreate({
        context: realmTenantContextCreate(realmId, ownerAId),
        database,
        input: { name: "Owner Created" },
        realmId,
      }).success,
    ).toBe(false)
    const created = organizationCreate({
      context: realmTenantContextCreate(realmId, realmAdministratorId),
      database,
      input: { name: "Realm Admin Created" },
      realmId,
    })
    expect(created.success).toBe(true)
  })
})

test("organization lists scope to memberships except for realm administrators and bootstrap", async () => {
  await withDatabase(async (database) => {
    const { memberBId, organizationA, organizationB, ownerAId, realmAdministratorId, realmId } = await setupRealm(
      database,
      "realm-admin-org-access-e.example.com",
    )
    const memberScoped = organizationList({
      context: realmTenantContextCreate(realmId, memberBId),
      database,
      realmId,
    })
    expect(memberScoped.success).toBe(true)
    if (!memberScoped.success) return
    expect(memberScoped.data.items.map((item) => item.id)).toEqual([organizationB.id])
    const ownerScoped = organizationList({
      context: realmTenantContextCreate(realmId, ownerAId),
      database,
      realmId,
    })
    expect(ownerScoped.success).toBe(true)
    if (!ownerScoped.success) return
    expect(ownerScoped.data.items.map((item) => item.id)).toEqual([organizationA.id])
    const administratorScoped = organizationList({
      context: realmTenantContextCreate(realmId, realmAdministratorId),
      database,
      realmId,
    })
    expect(administratorScoped.success).toBe(true)
    if (!administratorScoped.success) return
    expect(new Set(administratorScoped.data.items.map((item) => item.id))).toEqual(
      new Set([organizationA.id, organizationB.id]),
    )
    const bootstrapScoped = organizationList({
      context: realmSystemContextCreate(),
      database,
      realmId,
    })
    expect(bootstrapScoped.success).toBe(true)
    if (!bootstrapScoped.success) return
    expect(new Set(bootstrapScoped.data.items.map((item) => item.id))).toEqual(
      new Set([organizationA.id, organizationB.id]),
    )
    const firstPage = organizationList({
      context: realmTenantContextCreate(realmId, realmAdministratorId),
      database,
      query: { pageSize: 1 },
      realmId,
    })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success || firstPage.data.nextPageToken === undefined) return
    expect(firstPage.data.items).toHaveLength(1)
    const secondPage = organizationList({
      context: realmTenantContextCreate(realmId, realmAdministratorId),
      database,
      query: { pageSize: 1, pageToken: firstPage.data.nextPageToken },
      realmId,
    })
    expect(secondPage.success).toBe(true)
    if (!secondPage.success) return
    expect(secondPage.data.items).toHaveLength(1)
    expect(new Set([...firstPage.data.items, ...secondPage.data.items].map((item) => item.id))).toEqual(
      new Set([organizationA.id, organizationB.id]),
    )
  })
})

test("realm administrators act on organizations without membership over HTTP", async () => {
  await withDatabase(async (database) => {
    const domain = "realm-admin-org-access-f.example.com"
    const { memberBId, organizationA, organizationB, ownerAId, realmAdministratorId, realmId } = await setupRealm(
      database,
      domain,
    )
    const app = organizationServerAppCreate({ database })
    const sessionFor = async (userId: string) => {
      const issued = sessionIssue({
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        realmId,
        subjectId: userId,
        userId,
      })
      expect(issued.success).toBe(true)
      if (!issued.success) throw new Error("The session could not be issued.")
      return issued.data.token
    }
    const administratorToken = await sessionFor(realmAdministratorId)
    const memberships = await app.request(
      `https://${domain}/realms/${realmId}/organizations/${organizationB.id}/memberships`,
      {
        headers: { authorization: `Bearer ${administratorToken}` },
      },
    )
    expect(memberships.status).toBe(200)
    const outsiderToken = await sessionFor(memberBId)
    const foreign = await app.request(
      `https://${domain}/realms/${realmId}/organizations/${organizationA.id}/memberships`,
      {
        headers: { authorization: `Bearer ${outsiderToken}` },
      },
    )
    expect(foreign.status).toBe(401)
    const ownerToken = await sessionFor(ownerAId)
    const ownerForeign = await app.request(
      `https://${domain}/realms/${realmId}/organizations/${organizationB.id}/memberships`,
      {
        headers: { authorization: `Bearer ${ownerToken}` },
      },
    )
    expect(ownerForeign.status).toBe(401)
    const switched = await app.request(`https://${domain}/realms/${realmId}/me/organizations/switch`, {
      body: JSON.stringify({ organizationId: organizationB.id }),
      headers: { authorization: `Bearer ${administratorToken}`, "content-type": "application/json" },
      method: "POST",
    })
    expect(switched.status).toBe(200)
    expect((await switched.json()).activeOrganizationId).toBe(organizationB.id)
  })
})
