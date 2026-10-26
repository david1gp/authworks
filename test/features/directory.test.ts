import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { directoryApiClientCreate } from "../../src/features/directory/client/directoryApiClientCreate.js"
import { directoryEntryListPageCreate } from "../../src/features/directory/server/directoryEntryListPageCreate.js"
import { directoryOrganizationUserList } from "../../src/features/directory/server/directoryOrganizationUserList.js"
import { directoryOrganizationUserSummary } from "../../src/features/directory/server/directoryOrganizationUserSummary.js"
import { directoryRealmUserList } from "../../src/features/directory/server/directoryRealmUserList.js"
import { directoryServerAppCreate } from "../../src/features/directory/server/directoryServerAppCreate.js"
import { directoryUserAccess } from "../../src/features/directory/server/directoryUserAccess.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { projectRoleCreate } from "../../src/features/projects/actions/projectRoleCreate.js"
import { projectUserAssignmentCreate } from "../../src/features/projects/actions/projectUserAssignmentCreate.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userLastSignInRecord } from "../../src/features/users/server/userLastSignInRecord.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-directory-"))
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

async function activeUser(database: StorageDatabase, realmId: string, userName: string, displayName?: string) {
  const system = realmSystemContextCreate("system")
  const created = userCreate({
    context: system,
    database,
    input: {
      email: `${userName}@example.com`,
      profile: { displayName: displayName ?? userName, firstName: displayName?.split(" ")[0] },
      userName,
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: system,
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return created.data.user.id
}

async function setupTwoOrgRealm(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate("system")
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const ownerAId = await activeUser(database, realmId, `dir-owner-a-${domain.split(".")[0]}`, "Alice Owner")
  const memberAId = await activeUser(database, realmId, `dir-member-a-${domain.split(".")[0]}`, "Amy Member")
  const ownerBId = await activeUser(database, realmId, `dir-owner-b-${domain.split(".")[0]}`, "Bob Owner")
  const memberBId = await activeUser(database, realmId, `dir-member-b-${domain.split(".")[0]}`, "Ben Member")
  const organizationA = organizationCreate({
    context: system,
    database,
    input: { name: "Directory A", ownerUserId: ownerAId },
    realmId,
  })
  expect(organizationA.success).toBe(true)
  if (!organizationA.success) throw new Error(organizationA.errorMessage)
  const organizationB = organizationCreate({
    context: system,
    database,
    input: { name: "Directory B", ownerUserId: ownerBId },
    realmId,
  })
  expect(organizationB.success).toBe(true)
  if (!organizationB.success) throw new Error(organizationB.errorMessage)
  for (const seed of [
    organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, ownerAId),
      database,
      input: { roles: ["member"], userId: memberAId },
      organizationId: organizationA.data.organization.id,
      realmId,
    }),
    organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      input: { roles: ["admin"], userId: memberBId },
      organizationId: organizationB.data.organization.id,
      realmId,
    }),
  ]) {
    expect(seed.success).toBe(true)
  }
  const recordSignIn = (userId: string, signedInAt: number) =>
    userLastSignInRecord({ executor: database.db, realmId, signedInAt, userId })
  expect(recordSignIn(memberAId, 3_000).success).toBe(true)
  expect(recordSignIn(ownerAId, 2_000).success).toBe(true)
  expect(recordSignIn(memberBId, 1_000).success).toBe(true)
  return {
    memberAId,
    memberBId,
    organizationA: organizationA.data.organization,
    organizationB: organizationB.data.organization,
    ownerAId,
    ownerBId,
    realmId,
  }
}

test("organization owners list, search, filter, and paginate their organization users sorted by last sign-in", async () => {
  await withDatabase(async (database) => {
    const { memberAId, organizationA, ownerAId, realmId } = await setupTwoOrgRealm(
      database,
      "directory-list.example.com",
    )
    const context = realmTenantContextCreate(realmId, ownerAId)
    const listed = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      realmId,
    })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.map((item) => item.user.id)).toEqual([memberAId, ownerAId])
    expect(listed.data.items[0]?.memberships).toHaveLength(1)
    expect(listed.data.items[0]?.memberships[0]).toMatchObject({
      organizationId: organizationA.id,
      organizationName: organizationA.name,
    })
    expect(listed.data.items[0]?.user.lastSignInAt).toBe(3_000)

    const searched = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      query: { search: "amy" },
      realmId,
    })
    expect(searched).toMatchObject({ success: true, data: { items: [{ user: { id: memberAId } }] } })

    const roleFiltered = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      query: { role: "member" },
      realmId,
    })
    expect(roleFiltered).toMatchObject({ success: true, data: { items: [{ user: { id: memberAId } }] } })

    const firstPage = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      query: { pageSize: 1 },
      realmId,
    })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success || firstPage.data.nextPageToken === undefined) return
    expect(firstPage.data.items).toHaveLength(1)
    expect(firstPage.data.items[0]?.user.id).toBe(memberAId)
    const secondPage = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      query: { pageSize: 1, pageToken: firstPage.data.nextPageToken },
      realmId,
    })
    expect(secondPage).toMatchObject({ success: true, data: { items: [{ user: { id: ownerAId } }] } })

    const byUserName = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      query: { sortBy: "userName", sortDirection: "asc" },
      realmId,
    })
    expect(byUserName.success).toBe(true)
    if (!byUserName.success) return
    const userNames = byUserName.data.items.map((item) => item.user.userName)
    expect(userNames).toEqual([...userNames].sort())
  })
})

test("organization member cannot reach directory routes and cross-organization owners are denied", async () => {
  await withDatabase(async (database) => {
    const domain = "directory-deny.example.com"
    const { memberAId, organizationA, organizationB, ownerAId, realmId } = await setupTwoOrgRealm(database, domain)
    const app = directoryServerAppCreate({ database, publicOrigin: `https://${domain}` })
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
    const memberToken = await sessionFor(memberAId)
    const memberResponse = await app.request(
      `https://${domain}/realms/${realmId}/organizations/${organizationA.id}/users`,
      {
        headers: { authorization: `Bearer ${memberToken}` },
      },
    )
    expect(memberResponse.status).toBe(403)
    const memberSummary = await app.request(
      `https://${domain}/realms/${realmId}/organizations/${organizationA.id}/users/summary`,
      {
        headers: { authorization: `Bearer ${memberToken}` },
      },
    )
    expect(memberSummary.status).toBe(403)
    const ownerToken = await sessionFor(ownerAId)
    const foreignResponse = await app.request(
      `https://${domain}/realms/${realmId}/organizations/${organizationB.id}/users`,
      {
        headers: { authorization: `Bearer ${ownerToken}` },
      },
    )
    expect([401, 403]).toContain(foreignResponse.status)
    const realmResponse = await app.request(`https://${domain}/realms/${realmId}/directory/users`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    })
    expect(realmResponse.status).toBe(403)
    const roleResponse = await app.request(
      `https://${domain}/realms/${realmId}/organizations/${organizationA.id}/users?role=member`,
      {
        headers: { authorization: `Bearer ${ownerToken}` },
      },
    )
    expect(roleResponse.status).toBe(200)
    const roleBody = (await roleResponse.json()) as { items: { user: { id: string } }[] }
    expect(roleBody.items.map((item) => item.user.id)).toEqual([memberAId])
  })
})

test("organization user summary counts members by role", async () => {
  await withDatabase(async (database) => {
    const { organizationA, organizationB, realmId } = await setupTwoOrgRealm(database, "directory-summary.example.com")
    const summaryA = directoryOrganizationUserSummary({ database, organizationId: organizationA.id, realmId })
    expect(summaryA).toMatchObject({
      success: true,
      data: { roles: { admin: 0, guest: 0, member: 1, owner: 1 }, total: 2 },
    })
    const summaryB = directoryOrganizationUserSummary({ database, organizationId: organizationB.id, realmId })
    expect(summaryB).toMatchObject({
      success: true,
      data: { roles: { admin: 1, guest: 0, member: 0, owner: 1 }, total: 2 },
    })
  })
})

test("realm administrators list every user across organizations with all memberships", async () => {
  await withDatabase(async (database) => {
    const domain = "directory-realm.example.com"
    const { memberAId, memberBId, organizationA, ownerAId, ownerBId, realmId } = await setupTwoOrgRealm(
      database,
      domain,
    )
    const granted = realmAdministratorGrant({
      context: realmSystemContextCreate("system"),
      database,
      realmId,
      userId: ownerAId,
    })
    expect(granted.success).toBe(true)
    const context = realmTenantContextCreate(realmId, ownerAId)
    const listed = directoryRealmUserList({ context, database, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(new Set(listed.data.items.map((item) => item.user.id))).toEqual(
      new Set([ownerAId, memberAId, ownerBId, memberBId]),
    )
    const ownerEntry = listed.data.items.find((item) => item.user.id === ownerAId)
    expect(ownerEntry?.memberships.map((membership) => membership.organizationId)).toContain(organizationA.id)
    const roleFiltered = directoryRealmUserList({ context, database, query: { role: "admin" }, realmId })
    expect(roleFiltered.success).toBe(true)
    if (!roleFiltered.success) return
    expect(roleFiltered.data.items.map((item) => item.user.id)).toContain(memberBId)
    expect(roleFiltered.data.items.map((item) => item.user.id).includes(memberAId)).toBe(false)
  })
})

test("access endpoint scopes memberships and project assignments by administered organizations", async () => {
  await withDatabase(async (database) => {
    const domain = "directory-access.example.com"
    const system = realmSystemContextCreate("system")
    const { memberAId, memberBId, organizationA, organizationB, ownerAId, ownerBId, realmId } = await setupTwoOrgRealm(
      database,
      domain,
    )
    const projectA = projectCreate({
      context: system,
      database,
      input: { name: "Access A", organizationId: organizationA.id },
      realmId,
    })
    expect(projectA.success).toBe(true)
    if (!projectA.success) return
    const projectB = projectCreate({
      context: system,
      database,
      input: { name: "Access B", organizationId: organizationB.id },
      realmId,
    })
    expect(projectB.success).toBe(true)
    if (!projectB.success) return
    const roleA = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Viewer", key: "viewer" },
      projectId: projectA.data.project.id,
      realmId,
    })
    expect(roleA.success).toBe(true)
    if (!roleA.success) return
    const roleB = projectRoleCreate({
      context: system,
      database,
      input: { displayName: "Editor", key: "editor" },
      projectId: projectB.data.project.id,
      realmId,
    })
    expect(roleB.success).toBe(true)
    if (!roleB.success) return
    for (const assignment of [
      projectUserAssignmentCreate({
        context: system,
        database,
        input: { roleKeys: ["viewer"], userId: memberAId },
        projectId: projectA.data.project.id,
        realmId,
      }),
      projectUserAssignmentCreate({
        context: system,
        database,
        input: { roleKeys: ["editor"], userId: memberBId },
        projectId: projectB.data.project.id,
        realmId,
      }),
    ]) {
      expect(assignment.success).toBe(true)
    }
    const granted = realmAdministratorGrant({ context: system, database, realmId, userId: ownerBId })
    expect(granted.success).toBe(true)

    const ownerAccess = directoryUserAccess({
      context: realmTenantContextCreate(realmId, ownerAId),
      database,
      realmId,
      targetUserId: memberAId,
    })
    expect(ownerAccess.success).toBe(true)
    if (!ownerAccess.success) return
    expect(ownerAccess.data.memberships.map((membership) => membership.organizationId)).toEqual([organizationA.id])
    expect(ownerAccess.data.projectAssignments).toHaveLength(1)
    expect(ownerAccess.data.projectAssignments[0]).toMatchObject({
      projectId: projectA.data.project.id,
      projectName: "Access A",
      projectOrganizationId: organizationA.id,
      roleKeys: ["viewer"],
      roles: [{ displayName: "Viewer", key: "viewer" }],
    })
    expect(ownerAccess.data.realmAdministrator).toBe(false)

    const administratorAccess = directoryUserAccess({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      realmId,
      targetUserId: memberBId,
    })
    expect(administratorAccess.success).toBe(true)
    if (!administratorAccess.success) return
    expect(administratorAccess.data.memberships.map((membership) => membership.organizationId)).toEqual([
      organizationB.id,
    ])
    expect(administratorAccess.data.projectAssignments).toHaveLength(1)
    expect(administratorAccess.data.projectAssignments[0]).toMatchObject({
      projectId: projectB.data.project.id,
      roles: [{ displayName: "Editor", key: "editor" }],
    })
    expect(administratorAccess.data.realmAdministrator).toBe(false)

    const adminSeesMemberA = directoryUserAccess({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      realmId,
      targetUserId: memberAId,
    })
    expect(adminSeesMemberA.success).toBe(true)
    if (!adminSeesMemberA.success) return
    expect(adminSeesMemberA.data.memberships.map((membership) => membership.organizationId)).toEqual([organizationA.id])
    expect(adminSeesMemberA.data.projectAssignments.map((assignment) => assignment.projectId)).toEqual([
      projectA.data.project.id,
    ])
  })
})

test("directory tenant endpoints round-trip through the composed server with browser sessions", async () => {
  await withDatabase(async (database) => {
    const domain = "directory-http.example.com"
    const { organizationA, ownerAId, realmId } = await setupTwoOrgRealm(database, domain)
    const app = directoryServerAppCreate({ database, publicOrigin: `https://${domain}` })
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      subjectId: ownerAId,
      userId: ownerAId,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const csrf = sessionCsrfTokenCreate(database.runtime)
    const client = directoryApiClientCreate({
      baseUrl: `https://${domain}`,
      csrfToken: csrf,
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        headers.set("cookie", `session=${issued.data.token}; csrf=${csrf}`)
        headers.set("origin", `https://${domain}`)
        return app.request(input.toString(), { ...init, headers })
      },
    })
    const page = await client.directoryOrganizationUserList(realmId, organizationA.id)
    expect(page.success).toBe(true)
    if (!page.success) return
    expect(page.data.items).toHaveLength(2)
    const summary = await client.directoryOrganizationUserSummary(realmId, organizationA.id)
    expect(summary).toMatchObject({ success: true, data: { total: 2 } })
    const realmPage = await client.directoryRealmUserList(realmId)
    expect(realmPage.success).toBe(false)
    const realmAdminGrant = realmAdministratorGrant({
      context: realmSystemContextCreate("system"),
      database,
      realmId,
      userId: ownerAId,
    })
    expect(realmAdminGrant.success).toBe(true)
    const adminPage = await client.directoryRealmUserList(realmId)
    expect(adminPage.success).toBe(true)
    if (!adminPage.success) return
    expect(adminPage.data.items.length).toBeGreaterThanOrEqual(2)
    const access = await client.directoryUserAccess(realmId, ownerAId)
    expect(access).toMatchObject({ success: true, data: { realmAdministrator: true } })
    expect(access.success && access.data.memberships.length).toBeGreaterThanOrEqual(1)
  })
})

test("organization role filter matches only memberships of the requested organization", async () => {
  await withDatabase(async (database) => {
    const { memberAId, memberBId, organizationA, organizationB, ownerAId, ownerBId, realmId } = await setupTwoOrgRealm(
      database,
      "directory-cross-role.example.com",
    )
    // memberA is a plain member of A but an admin of B: the A-scoped admin filter must not leak them in.
    const cross = organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      input: { roles: ["admin"], userId: memberAId },
      organizationId: organizationB.id,
      realmId,
    })
    expect(cross.success).toBe(true)
    const context = realmTenantContextCreate(realmId, ownerAId)
    const adminsOfA = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: true,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      query: { role: "admin" },
      realmId,
    })
    expect(adminsOfA.success).toBe(true)
    if (!adminsOfA.success) return
    expect(adminsOfA.data.items.map((item) => item.user.id).includes(memberAId)).toBe(false)
    expect(adminsOfA.data.items).toHaveLength(0)
    const adminsOfB = directoryOrganizationUserList({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      includeOtherMemberships: true,
      organizationId: organizationB.id,
      organizationName: organizationB.name,
      query: { role: "admin" },
      realmId,
    })
    expect(adminsOfB.success).toBe(true)
    if (!adminsOfB.success) return
    expect(new Set(adminsOfB.data.items.map((item) => item.user.id))).toEqual(new Set([memberAId, memberBId]))
    // The realm-wide list keeps anywhere semantics: memberA is an admin somewhere.
    const realmAdmins = directoryRealmUserList({ context, database, query: { role: "admin" }, realmId })
    expect(realmAdmins.success).toBe(true)
    if (!realmAdmins.success) return
    expect(realmAdmins.data.items.map((item) => item.user.id)).toContain(memberAId)
  })
})

test("organization user summary agrees with the role-filtered list for memberships without users", async () => {
  await withDatabase(async (database) => {
    const { memberAId, organizationA, ownerAId, realmId } = await setupTwoOrgRealm(
      database,
      "directory-dangling.example.com",
    )
    // Membership rows carry no foreign key to users, so a membership can outlive its user.
    const ghost = organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, ownerAId),
      database,
      input: { roles: ["admin"], userId: "01900000-0000-7000-8000-00000000abcd" },
      organizationId: organizationA.id,
      realmId,
    })
    expect(ghost.success).toBe(true)
    const summary = directoryOrganizationUserSummary({ database, organizationId: organizationA.id, realmId })
    expect(summary).toMatchObject({
      success: true,
      data: { roles: { admin: 0, guest: 0, member: 1, owner: 1 }, total: 2 },
    })
    const context = realmTenantContextCreate(realmId, ownerAId)
    const admins = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      query: { role: "admin" },
      realmId,
    })
    expect(admins).toMatchObject({ success: true, data: { items: [] } })
    const everyone = directoryOrganizationUserList({
      context,
      database,
      includeOtherMemberships: false,
      organizationId: organizationA.id,
      organizationName: organizationA.name,
      realmId,
    })
    expect(everyone.success).toBe(true)
    if (!everyone.success) return
    expect(new Set(everyone.data.items.map((item) => item.user.id))).toEqual(new Set([memberAId, ownerAId]))
  })
})

test("directory list paging helper keeps last sign-in nulls last", async () => {
  const usersById = new Map([
    ["a", { createdAt: 1, userName: "a" }],
    ["b", { createdAt: 2, lastSignInAt: 5, userName: "b" }],
  ] as unknown as [string, import("../../src/features/users/public/userSchema.js").User][])
  const entries = [
    { memberships: [], user: { createdAt: 1, id: "a" } },
    { memberships: [], user: { createdAt: 2, id: "b", lastSignInAt: 5 } },
  ] as unknown as Parameters<typeof directoryEntryListPageCreate>[0]["entries"]
  const page = directoryEntryListPageCreate({
    entries,
    fallbackSortBy: "lastSignInAt",
    fallbackSortDirection: "desc",
    query: {},
    usersById,
  })
  expect(page.success).toBe(true)
  if (!page.success) return
  expect(page.data.items.map((item) => item.user.id)).toEqual(["b", "a"])
})
