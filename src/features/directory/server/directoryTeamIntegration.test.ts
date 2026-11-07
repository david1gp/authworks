import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { directoryOrganizationUserList } from "../../directory/server/directoryOrganizationUserList.js"
import { directoryRealmUserList } from "../../directory/server/directoryRealmUserList.js"
import { directoryServerAppCreate } from "../../directory/server/directoryServerAppCreate.js"
import { directoryUserAccess } from "../../directory/server/directoryUserAccess.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { organizationInvitationAccept } from "../../organizations/actions/organizationInvitationAccept.js"
import { organizationInvitationCreate } from "../../organizations/actions/organizationInvitationCreate.js"
import { organizationMembershipCreate } from "../../organizations/actions/organizationMembershipCreate.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { teamCreate } from "../../teams/actions/teamCreate.js"
import { teamMemberAssign } from "../../teams/actions/teamMemberAssign.js"
import { teamMemberUnassign } from "../../teams/actions/teamMemberUnassign.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { userServerAppCreate } from "../../users/server/userServerAppCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-directory-team-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function seedUser(database: StorageDatabase, realmId: string, userName: string): string {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.user.id
}

function seedRealm(database: StorageDatabase, domain: string): string {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  return realm.data.realm.id
}

function seedOrganization(
  database: StorageDatabase,
  realmId: string,
  ownerUserId: string,
  members: readonly string[] = [],
) {
  const organization = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name: "Acme", ownerUserId },
    realmId,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  const organizationId = organization.data.organization.id
  const ownerContext = realmTenantContextCreate(realmId, ownerUserId)
  for (const userId of members) {
    const created = organizationMembershipCreate({
      context: ownerContext,
      database,
      input: { roles: ["member"], userId },
      organizationId,
      realmId,
    })
    expect(created.success).toBe(true)
  }
  return organization.data.organization
}

function seedTeam(
  database: StorageDatabase,
  realmId: string,
  organizationId: string,
  ownerUserId: string,
  input: { leaderUserId: string; name: string; slug: string },
) {
  const created = teamCreate({
    context: realmTenantContextCreate(realmId, ownerUserId),
    database,
    input,
    organizationId,
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.team
}

function sessionTokenCreate(database: StorageDatabase, realmId: string, userId: string): string {
  const activated = userLifecycleSet({
    context: realmTenantContextCreate(realmId, userId),
    database,
    input: { state: "active" },
    realmId,
    userId,
  })
  expect(activated.success).toBe(true)
  const session = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    realmId,
    userId,
  })
  expect(session.success).toBe(true)
  if (!session.success) throw new Error(session.errorMessage)
  return session.data.token
}

function seedLeaderScope(database: StorageDatabase) {
  const realmId = seedRealm(database, "directory-leader-scope.example.com")
  const owner = seedUser(database, realmId, "scope-owner")
  const leader = seedUser(database, realmId, "scope-leader")
  const teammate = seedUser(database, realmId, "scope-teammate")
  const otherLeader = seedUser(database, realmId, "scope-other-leader")
  const otherMember = seedUser(database, realmId, "scope-other-member")
  const loner = seedUser(database, realmId, "scope-loner")
  const plain = seedUser(database, realmId, "scope-plain")
  const organization = seedOrganization(database, realmId, owner, [
    leader,
    teammate,
    otherLeader,
    otherMember,
    loner,
    plain,
  ])
  const teamA = seedTeam(database, realmId, organization.id, owner, {
    leaderUserId: leader,
    name: "Team A",
    slug: "team-a",
  })
  const teamB = seedTeam(database, realmId, organization.id, owner, {
    leaderUserId: otherLeader,
    name: "Team B",
    slug: "team-b",
  })
  const ownerContext = realmTenantContextCreate(realmId, owner)
  for (const [userId, teamRef] of [
    [teammate, teamA.id],
    [otherMember, teamB.id],
  ] as const) {
    const assigned = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId },
      organizationId: organization.id,
      realmId,
      teamRef,
    })
    expect(assigned.success).toBe(true)
  }
  return { leader, loner, organization, otherLeader, otherMember, owner, plain, realmId, teammate }
}

test("directory org list exposes team entries and filters by slug, unassigned, and unknown slugs", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "directory-team-filter.example.com")
    const owner = seedUser(database, realmId, "filter-owner")
    const assigned = seedUser(database, realmId, "filter-assigned")
    const loner = seedUser(database, realmId, "filter-loner")
    const organization = seedOrganization(database, realmId, owner, [assigned, loner])
    const team = seedTeam(database, realmId, organization.id, owner, {
      leaderUserId: owner,
      name: "Engineering",
      slug: "engineering",
    })
    const moved = teamMemberAssign({
      context: realmTenantContextCreate(realmId, owner),
      database,
      input: { userId: assigned },
      organizationId: organization.id,
      realmId,
      teamRef: team.id,
    })
    expect(moved.success).toBe(true)
    const context = realmTenantContextCreate(realmId, owner)
    const base = { context, database, includeOtherMemberships: false, organizationId: organization.id }

    const listed = directoryOrganizationUserList({ ...base, organizationName: organization.name, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items).toHaveLength(3)
    const byUser = new Map(listed.data.items.map((entry) => [entry.user.id, entry]))
    expect(byUser.get(owner)?.team).toEqual({ id: team.id, name: "Engineering", slug: "engineering" })
    expect(byUser.get(assigned)?.team).toEqual({ id: team.id, name: "Engineering", slug: "engineering" })
    expect(byUser.get(loner)?.team).toBeNull()

    const bySlug = directoryOrganizationUserList({
      ...base,
      organizationName: organization.name,
      query: { team: "engineering" },
      realmId,
    })
    expect(bySlug.success).toBe(true)
    if (!bySlug.success) return
    expect(new Set(bySlug.data.items.map((entry) => entry.user.id))).toEqual(new Set([owner, assigned]))

    const unassigned = directoryOrganizationUserList({
      ...base,
      organizationName: organization.name,
      query: { team: "unassigned" },
      realmId,
    })
    expect(unassigned.success).toBe(true)
    if (!unassigned.success) return
    expect(unassigned.data.items.map((entry) => entry.user.id)).toEqual([loner])

    const unknown = directoryOrganizationUserList({
      ...base,
      organizationName: organization.name,
      query: { team: "does-not-exist" },
      realmId,
    })
    expect(unknown.success).toBe(true)
    if (!unknown.success) return
    expect(unknown.data.items).toEqual([])
  })
})

test("directory org list team entries follow moves and unassignment", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "directory-team-move.example.com")
    const owner = seedUser(database, realmId, "move-owner")
    const member = seedUser(database, realmId, "move-member")
    const helper = seedUser(database, realmId, "move-helper")
    const organization = seedOrganization(database, realmId, owner, [member, helper])
    const teamA = seedTeam(database, realmId, organization.id, owner, {
      leaderUserId: owner,
      name: "Team A",
      slug: "team-a",
    })
    const teamB = seedTeam(database, realmId, organization.id, owner, {
      leaderUserId: helper,
      name: "Team B",
      slug: "team-b",
    })
    const ownerContext = realmTenantContextCreate(realmId, owner)
    const listFor = (query?: { team?: string }) =>
      directoryOrganizationUserList({
        context: ownerContext,
        database,
        includeOtherMemberships: false,
        organizationId: organization.id,
        organizationName: organization.name,
        query,
        realmId,
      })
    expect(
      teamMemberAssign({
        context: ownerContext,
        database,
        input: { userId: member },
        organizationId: organization.id,
        realmId,
        teamRef: teamA.id,
      }).success,
    ).toBe(true)
    const assigned = listFor({ team: "team-a" })
    expect(assigned.success).toBe(true)
    if (!assigned.success) return
    expect(assigned.data.items.map((entry) => entry.user.id)).toContain(member)
    expect(
      teamMemberAssign({
        context: ownerContext,
        database,
        input: { userId: member },
        organizationId: organization.id,
        realmId,
        teamRef: "team-b",
      }).success,
    ).toBe(true)
    const moved = listFor({ team: "team-b" })
    expect(moved.success).toBe(true)
    if (!moved.success) return
    expect(moved.data.items.map((entry) => entry.user.id)).toContain(member)
    expect(moved.data.items.find((entry) => entry.user.id === member)?.team).toEqual({
      id: teamB.id,
      name: "Team B",
      slug: "team-b",
    })
    const leftBehind = listFor({ team: "team-a" })
    expect(leftBehind.success).toBe(true)
    if (!leftBehind.success) return
    expect(leftBehind.data.items.map((entry) => entry.user.id)).not.toContain(member)
    expect(
      teamMemberUnassign({
        context: ownerContext,
        database,
        organizationId: organization.id,
        realmId,
        teamRef: "team-b",
        userId: member,
      }).success,
    ).toBe(true)
    const unassigned = listFor({ team: "unassigned" })
    expect(unassigned.success).toBe(true)
    if (!unassigned.success) return
    expect(unassigned.data.items.map((entry) => entry.user.id)).toContain(member)
  })
})

test("realm directory entries always report a null team", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "directory-team-realm.example.com")
    const owner = seedUser(database, realmId, "realm-owner")
    const member = seedUser(database, realmId, "realm-member")
    const organization = seedOrganization(database, realmId, owner, [member])
    const team = seedTeam(database, realmId, organization.id, owner, {
      leaderUserId: owner,
      name: "Engineering",
      slug: "engineering",
    })
    expect(
      teamMemberAssign({
        context: realmTenantContextCreate(realmId, owner),
        database,
        input: { userId: member },
        organizationId: organization.id,
        realmId,
        teamRef: team.id,
      }).success,
    ).toBe(true)
    const listed = directoryRealmUserList({ context: realmTenantContextCreate(realmId, member), database, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items).toHaveLength(2)
    for (const entry of listed.data.items) expect(entry.team).toBeNull()
  })
})

test("directory access resolves invitedBy from the accepted invitation and nulls purged and direct adds", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "directory-invited-by.example.com")
    const owner = seedUser(database, realmId, "inviter-owner")
    const invited = seedUser(database, realmId, "invited-member")
    const direct = seedUser(database, realmId, "direct-member")
    const organization = seedOrganization(database, realmId, owner)
    const ownerContext = realmTenantContextCreate(realmId, owner)
    const created = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: "invited-member@example.com", roles: ["member"] },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const accepted = organizationInvitationAccept({
      database,
      input: { token: created.data.token, userId: invited },
    })
    expect(accepted.success).toBe(true)
    const directAdded = organizationMembershipCreate({
      context: ownerContext,
      database,
      input: { roles: ["member"], userId: direct },
      organizationId: organization.id,
      realmId,
    })
    expect(directAdded.success).toBe(true)
    const access = (targetUserId: string) =>
      directoryUserAccess({ context: ownerContext, database, realmId, targetUserId })
    const invitedAccess = access(invited)
    expect(invitedAccess.success).toBe(true)
    if (!invitedAccess.success) return
    const invitedMembership = invitedAccess.data.memberships.find(
      (membership) => membership.organizationId === organization.id,
    )
    expect(invitedMembership?.invitedBy?.userId).toBe(owner)
    expect(invitedMembership?.invitedBy?.displayName).toBe("inviter-owner")
    expect(invitedMembership?.invitedBy?.email).toBe("inviter-owner@example.com")
    expect(typeof invitedMembership?.invitedBy?.invitedAt).toBe("number")
    expect(typeof invitedMembership?.invitedBy?.acceptedAt).toBe("number")

    const directAccess = access(direct)
    expect(directAccess.success).toBe(true)
    if (!directAccess.success) return
    expect(
      directAccess.data.memberships.find((membership) => membership.organizationId === organization.id)?.invitedBy,
    ).toBeNull()

    const repository = organizationRepositoryCreate(database.db)
    const rows = repository.organizationInvitationList(organization.id)
    expect(rows.success).toBe(true)
    if (!rows.success) return
    const row = rows.data.find((candidate) => candidate.email === "invited-member@example.com")
    expect(row).toBeDefined()
    if (row === undefined) return
    expect(repository.organizationInvitationUpdate(row.id, { invitedBy: "" }).success).toBe(true)
    const purgedAccess = access(invited)
    expect(purgedAccess.success).toBe(true)
    if (!purgedAccess.success) return
    expect(
      purgedAccess.data.memberships.find((membership) => membership.organizationId === organization.id)?.invitedBy,
    ).toBeNull()
  })
})

test("leader organization user list is scoped to their own team slug and unassigned", async () => {
  await withDatabase(async (database) => {
    const seeded = seedLeaderScope(database)
    const app = directoryServerAppCreate({ database })
    const base = `/realms/${seeded.realmId}/organizations/${seeded.organization.id}/users`
    const leaderToken = sessionTokenCreate(database, seeded.realmId, seeded.leader)
    const leaderHeaders = { authorization: `Bearer ${leaderToken}` }

    const roster = await app.request(`${base}?team=team-a`, { headers: leaderHeaders })
    expect(roster.status).toBe(200)
    const rosterBody = (await roster.json()) as { items: { user: { id: string } }[] }
    expect(new Set(rosterBody.items.map((entry) => entry.user.id))).toEqual(new Set([seeded.leader, seeded.teammate]))

    const searched = await app.request(`${base}?team=team-a&search=scope-teammate`, { headers: leaderHeaders })
    expect(searched.status).toBe(200)
    const searchedBody = (await searched.json()) as { items: { user: { id: string } }[] }
    expect(searchedBody.items.map((entry) => entry.user.id)).toEqual([seeded.teammate])

    const unassigned = await app.request(`${base}?team=unassigned`, { headers: leaderHeaders })
    expect(unassigned.status).toBe(200)
    const unassignedBody = (await unassigned.json()) as { items: { user: { id: string } }[] }
    const unassignedIds = new Set(unassignedBody.items.map((entry) => entry.user.id))
    expect(unassignedIds.has(seeded.loner)).toBe(true)
    expect(unassignedIds.has(seeded.plain)).toBe(true)
    expect(unassignedIds.has(seeded.teammate)).toBe(false)
    expect(unassignedIds.has(seeded.otherMember)).toBe(false)

    expect((await app.request(`${base}?team=team-b`, { headers: leaderHeaders })).status).toBe(403)
    expect((await app.request(`${base}?team=does-not-exist`, { headers: leaderHeaders })).status).toBe(403)
    expect((await app.request(base, { headers: leaderHeaders })).status).toBe(403)
  })
})

test("plain members stay denied on the organization user list", async () => {
  await withDatabase(async (database) => {
    const seeded = seedLeaderScope(database)
    const app = directoryServerAppCreate({ database })
    const base = `/realms/${seeded.realmId}/organizations/${seeded.organization.id}/users`
    const plainHeaders = { authorization: `Bearer ${sessionTokenCreate(database, seeded.realmId, seeded.plain)}` }
    expect((await app.request(base, { headers: plainHeaders })).status).toBe(403)
    expect((await app.request(`${base}?team=unassigned`, { headers: plainHeaders })).status).toBe(403)
    expect((await app.request(`${base}?team=team-a`, { headers: plainHeaders })).status).toBe(403)
  })
})

test("admin organization user list is unchanged", async () => {
  await withDatabase(async (database) => {
    const seeded = seedLeaderScope(database)
    const app = directoryServerAppCreate({ database })
    const base = `/realms/${seeded.realmId}/organizations/${seeded.organization.id}/users`
    const ownerHeaders = { authorization: `Bearer ${sessionTokenCreate(database, seeded.realmId, seeded.owner)}` }
    const listed = await app.request(base, { headers: ownerHeaders })
    expect(listed.status).toBe(200)
    const body = (await listed.json()) as { items: { user: { id: string } }[] }
    expect(body.items).toHaveLength(7)
  })
})

test("leader user access reads own team members only", async () => {
  await withDatabase(async (database) => {
    const seeded = seedLeaderScope(database)
    const app = directoryServerAppCreate({ database })
    const accessPath = (userId: string) => `/realms/${seeded.realmId}/users/${userId}/access`
    const leaderHeaders = { authorization: `Bearer ${sessionTokenCreate(database, seeded.realmId, seeded.leader)}` }

    const member = await app.request(accessPath(seeded.teammate), { headers: leaderHeaders })
    expect(member.status).toBe(200)
    const memberBody = (await member.json()) as { memberships: { organizationId: string }[] }
    expect(memberBody.memberships.map((membership) => membership.organizationId)).toEqual([seeded.organization.id])

    const self = await app.request(accessPath(seeded.leader), { headers: leaderHeaders })
    expect(self.status).toBe(200)

    expect((await app.request(accessPath(seeded.otherMember), { headers: leaderHeaders })).status).toBe(403)
    expect((await app.request(accessPath(seeded.loner), { headers: leaderHeaders })).status).toBe(403)
    expect((await app.request(accessPath(seeded.plain), { headers: leaderHeaders })).status).toBe(403)

    const ownerHeaders = { authorization: `Bearer ${sessionTokenCreate(database, seeded.realmId, seeded.owner)}` }
    const ownerView = await app.request(accessPath(seeded.otherMember), { headers: ownerHeaders })
    expect(ownerView.status).toBe(200)
  })
})

test("leader user read opens own team member profiles only", async () => {
  await withDatabase(async (database) => {
    const seeded = seedLeaderScope(database)
    const app = userServerAppCreate({ database })
    const userPath = (userId: string) => `/realms/${seeded.realmId}/users/${userId}`
    const leaderHeaders = { authorization: `Bearer ${sessionTokenCreate(database, seeded.realmId, seeded.leader)}` }

    const member = await app.request(userPath(seeded.teammate), { headers: leaderHeaders })
    expect(member.status).toBe(200)
    const memberBody = (await member.json()) as { user: { id: string } }
    expect(memberBody.user.id).toBe(seeded.teammate)

    expect((await app.request(userPath(seeded.otherMember), { headers: leaderHeaders })).status).toBe(403)
    expect((await app.request(userPath(seeded.loner), { headers: leaderHeaders })).status).toBe(403)
    expect((await app.request(userPath(seeded.plain), { headers: leaderHeaders })).status).toBe(403)

    const ownerHeaders = { authorization: `Bearer ${sessionTokenCreate(database, seeded.realmId, seeded.owner)}` }
    expect((await app.request(userPath(seeded.otherMember), { headers: ownerHeaders })).status).toBe(200)
  })
})
