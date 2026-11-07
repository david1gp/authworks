import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../organizations/actions/organizationMembershipCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { teamCreate } from "./teamCreate.js"
import { teamDelete } from "./teamDelete.js"
import { teamGet } from "./teamGet.js"
import { teamList } from "./teamList.js"
import { teamMemberAssign } from "./teamMemberAssign.js"
import { teamUpdate } from "./teamUpdate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-team-crud-"))
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

function seedOrganization(
  database: StorageDatabase,
  realmId: string,
  ownerUserId: string,
  members: readonly { roles: ["admin"] | ["member"]; userId: string }[] = [],
) {
  const system = realmSystemContextCreate("system")
  const organization = organizationCreate({
    context: system,
    database,
    input: { name: "Acme", ownerUserId },
    realmId,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  const ownerContext = realmTenantContextCreate(realmId, ownerUserId)
  for (const member of members) {
    const created = organizationMembershipCreate({
      context: ownerContext,
      database,
      input: { roles: member.roles, userId: member.userId },
      organizationId: organization.data.organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
  }
  return organization.data.organization
}

function realmSeed(database: StorageDatabase): string {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain: "teams-crud.example.com", name: "teams-crud" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  return realm.data.realm.id
}

function teamEventTypesList(database: StorageDatabase, aggregateId: string): string[] {
  const rows = database.sqlite
    .prepare("select event_type from events where aggregate_id = ? order by occurred_at, command_index")
    .all(aggregateId) as { event_type: string }[]
  return rows.map((row) => row.event_type)
}

test("team create validates slug pattern, reserves unassigned, and records events", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database)
    const owner = seedUser(database, realmId, "crud-owner")
    const organization = seedOrganization(database, realmId, owner)
    const context = realmTenantContextCreate(realmId, owner)
    for (const slug of ["Bad", "-bad", "bad-", "bad--slug", "bad slug", "bad_slug", ""]) {
      const rejected = teamCreate({
        context,
        database,
        input: { leaderUserId: owner, name: "Engineering", slug },
        organizationId: organization.id,
        realmId,
      })
      expect(rejected.success).toBe(false)
      if (rejected.success) throw new Error("expected slug rejection")
      expect(rejected.code).toBe("teams.invalid")
    }
    const reserved = teamCreate({
      context,
      database,
      input: { leaderUserId: owner, name: "Engineering", slug: "unassigned" },
      organizationId: organization.id,
      realmId,
    })
    expect(reserved.success).toBe(false)
    if (reserved.success) throw new Error("expected reserved slug rejection")
    expect(reserved.code).toBe("teams.invalid")
    const created = teamCreate({
      context,
      database,
      input: { leaderUserId: owner, name: "Engineering", slug: "engineering" },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.data.team.slug).toBe("engineering")
    expect(created.data.team.memberCount).toBe(1)
    expect(created.data.team.leader.userId).toBe(owner)
    expect(created.data.team.leader.displayName).toBe("crud-owner")
    expect(teamEventTypesList(database, created.data.team.id)).toEqual(["team.created"])
    const membershipEvents = database.sqlite
      .prepare("select event_type from events where event_type like 'team.member%'")
      .all() as { event_type: string }[]
    expect(membershipEvents.map((row) => row.event_type)).toEqual(["team.member_assigned"])
  })
})

test("team create rejects slug and name conflicts and non-member leaders", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database)
    const owner = seedUser(database, realmId, "conflict-owner")
    const outsider = seedUser(database, realmId, "conflict-outsider")
    const organization = seedOrganization(database, realmId, owner)
    const context = realmTenantContextCreate(realmId, owner)
    const created = teamCreate({
      context,
      database,
      input: { leaderUserId: owner, name: "Engineering", slug: "engineering" },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    const slugConflict = teamCreate({
      context,
      database,
      input: { leaderUserId: owner, name: "Something else", slug: "engineering" },
      organizationId: organization.id,
      realmId,
    })
    expect(slugConflict.success).toBe(false)
    if (slugConflict.success) throw new Error("expected slug conflict")
    expect(slugConflict.code).toBe("teams.slug-conflict")
    const nameConflict = teamCreate({
      context,
      database,
      input: { leaderUserId: owner, name: "Engineering", slug: "something-else" },
      organizationId: organization.id,
      realmId,
    })
    expect(nameConflict.success).toBe(false)
    if (nameConflict.success) throw new Error("expected name conflict")
    expect(nameConflict.code).toBe("teams.name-conflict")
    const nonMember = teamCreate({
      context,
      database,
      input: { leaderUserId: outsider, name: "Design", slug: "design" },
      organizationId: organization.id,
      realmId,
    })
    expect(nonMember.success).toBe(false)
    if (nonMember.success) throw new Error("expected non-member rejection")
    expect(nonMember.code).toBe("teams.not-member")
  })
})

test("team create rejects an existing leader as the new team's leader", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database)
    const owner = seedUser(database, realmId, "steal-create-owner")
    const leader = seedUser(database, realmId, "steal-create-leader")
    const organization = seedOrganization(database, realmId, owner, [{ roles: ["member"], userId: leader }])
    const context = realmTenantContextCreate(realmId, owner)
    const first = teamCreate({
      context,
      database,
      input: { leaderUserId: leader, name: "Engineering", slug: "engineering" },
      organizationId: organization.id,
      realmId,
    })
    expect(first.success).toBe(true)
    if (!first.success) throw new Error(first.errorMessage)
    const stolen = teamCreate({
      context,
      database,
      input: { leaderUserId: leader, name: "Design", slug: "design" },
      organizationId: organization.id,
      realmId,
    })
    expect(stolen.success).toBe(false)
    if (stolen.success) throw new Error("expected leader conflict")
    expect(stolen.code).toBe("teams.leader-conflict")
    const listed = teamList({ context, database, organizationId: organization.id, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) throw new Error(listed.errorMessage)
    expect(listed.data.items).toHaveLength(1)
    expect(listed.data.items[0]?.leader.userId).toBe(leader)
    expect(listed.data.items[0]?.memberCount).toBe(1)
  })
})

test("team get resolves by id and by slug", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database)
    const owner = seedUser(database, realmId, "resolve-owner")
    const organization = seedOrganization(database, realmId, owner)
    const context = realmTenantContextCreate(realmId, owner)
    const created = teamCreate({
      context,
      database,
      input: { leaderUserId: owner, name: "Engineering", slug: "engineering" },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const byId = teamGet({
      context,
      database,
      organizationId: organization.id,
      realmId,
      teamRef: created.data.team.id,
    })
    expect(byId.success).toBe(true)
    const bySlug = teamGet({
      context,
      database,
      organizationId: organization.id,
      realmId,
      teamRef: "engineering",
    })
    expect(bySlug.success).toBe(true)
    if (!bySlug.success) throw new Error(bySlug.errorMessage)
    expect(bySlug.data.team.id).toBe(created.data.team.id)
    const missing = teamGet({ context, database, organizationId: organization.id, realmId, teamRef: "nope" })
    expect(missing.success).toBe(false)
    if (missing.success) throw new Error("expected not-found")
    expect(missing.code).toBe("teams.not-found")
  })
})

test("team update and delete enforce admin versus leader versus member scopes", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database)
    const owner = seedUser(database, realmId, "scope-owner")
    const admin = seedUser(database, realmId, "scope-admin")
    const leader = seedUser(database, realmId, "scope-leader")
    const member = seedUser(database, realmId, "scope-member")
    const organization = seedOrganization(database, realmId, owner, [
      { roles: ["admin"], userId: admin },
      { roles: ["member"], userId: leader },
      { roles: ["member"], userId: member },
    ])
    const ownerContext = realmTenantContextCreate(realmId, owner)
    const adminContext = realmTenantContextCreate(realmId, admin)
    const leaderContext = realmTenantContextCreate(realmId, leader)
    const memberContext = realmTenantContextCreate(realmId, member)
    const created = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leader, name: "Engineering", slug: "engineering" },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const teamId = created.data.team.id
    const leaderRename = teamUpdate({
      context: leaderContext,
      database,
      input: { name: "Eng", slug: "eng" },
      organizationId: organization.id,
      realmId,
      teamRef: teamId,
    })
    expect(leaderRename.success).toBe(true)
    if (!leaderRename.success) throw new Error(leaderRename.errorMessage)
    expect(leaderRename.data.team.slug).toBe("eng")
    const leaderSteal = teamUpdate({
      context: leaderContext,
      database,
      input: { leaderUserId: member },
      organizationId: organization.id,
      realmId,
      teamRef: teamId,
    })
    expect(leaderSteal.success).toBe(false)
    if (leaderSteal.success) throw new Error("expected leader-change denial")
    expect(leaderSteal.code).toBe("teams.forbidden")
    const memberRead = teamGet({
      context: memberContext,
      database,
      organizationId: organization.id,
      realmId,
      teamRef: teamId,
    })
    expect(memberRead.success).toBe(false)
    const leaderCreate = teamCreate({
      context: leaderContext,
      database,
      input: { leaderUserId: leader, name: "Design", slug: "design" },
      organizationId: organization.id,
      realmId,
    })
    expect(leaderCreate.success).toBe(false)
    const leaderDelete = teamDelete({
      context: leaderContext,
      database,
      organizationId: organization.id,
      realmId,
      teamRef: teamId,
    })
    expect(leaderDelete.success).toBe(false)
    const adminRename = teamUpdate({
      context: adminContext,
      database,
      input: { name: "Engineering org", slug: "engineering-org" },
      organizationId: organization.id,
      realmId,
      teamRef: teamId,
    })
    expect(adminRename.success).toBe(true)
    const listed = teamList({ context: leaderContext, database, organizationId: organization.id, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) throw new Error(listed.errorMessage)
    expect(listed.data.items.map((team) => team.id)).toEqual([teamId])
  })
})

test("team leader sees only their team while admins see every team", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database)
    const owner = seedUser(database, realmId, "scope2-owner")
    const leaderA = seedUser(database, realmId, "scope2-leader-a")
    const leaderB = seedUser(database, realmId, "scope2-leader-b")
    const organization = seedOrganization(database, realmId, owner, [
      { roles: ["member"], userId: leaderA },
      { roles: ["member"], userId: leaderB },
    ])
    const ownerContext = realmTenantContextCreate(realmId, owner)
    const teamA = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderA, name: "Team A", slug: "team-a" },
      organizationId: organization.id,
      realmId,
    })
    const teamB = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderB, name: "Team B", slug: "team-b" },
      organizationId: organization.id,
      realmId,
    })
    expect(teamA.success).toBe(true)
    expect(teamB.success).toBe(true)
    if (!teamA.success || !teamB.success) throw new Error("team setup failed")
    const leaderView = teamList({
      context: realmTenantContextCreate(realmId, leaderA),
      database,
      organizationId: organization.id,
      realmId,
    })
    expect(leaderView.success).toBe(true)
    if (!leaderView.success) throw new Error(leaderView.errorMessage)
    expect(leaderView.data.items.map((team) => team.id)).toEqual([teamA.data.team.id])
    const otherRead = teamGet({
      context: realmTenantContextCreate(realmId, leaderA),
      database,
      organizationId: organization.id,
      realmId,
      teamRef: teamB.data.team.id,
    })
    expect(otherRead.success).toBe(false)
    const adminView = teamList({ context: ownerContext, database, organizationId: organization.id, realmId })
    expect(adminView.success).toBe(true)
    if (!adminView.success) throw new Error(adminView.errorMessage)
    expect(adminView.data.items).toHaveLength(2)
    expect(adminView.data.unassignedCount).toBe(1)
  })
})

test("team delete makes members unassigned", async () => {
  await withDatabase(async (database) => {
    const realmId = realmSeed(database)
    const owner = seedUser(database, realmId, "delete-owner")
    const member = seedUser(database, realmId, "delete-member")
    const organization = seedOrganization(database, realmId, owner, [{ roles: ["member"], userId: member }])
    const context = realmTenantContextCreate(realmId, owner)
    const created = teamCreate({
      context,
      database,
      input: { leaderUserId: owner, name: "Engineering", slug: "engineering" },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const assigned = teamMemberAssign({
      context,
      database,
      input: { userId: member },
      organizationId: organization.id,
      realmId,
      teamRef: created.data.team.id,
    })
    expect(assigned.success).toBe(true)
    const before = teamList({ context, database, organizationId: organization.id, realmId })
    expect(before.success).toBe(true)
    if (!before.success) throw new Error(before.errorMessage)
    expect(before.data.unassignedCount).toBe(0)
    const deleted = teamDelete({
      context,
      database,
      organizationId: organization.id,
      realmId,
      teamRef: created.data.team.id,
    })
    expect(deleted.success).toBe(true)
    const after = teamList({ context, database, organizationId: organization.id, realmId })
    expect(after.success).toBe(true)
    if (!after.success) throw new Error(after.errorMessage)
    expect(after.data.items).toHaveLength(0)
    expect(after.data.unassignedCount).toBe(2)
    const missing = teamGet({
      context,
      database,
      organizationId: organization.id,
      realmId,
      teamRef: created.data.team.id,
    })
    expect(missing.success).toBe(false)
    if (missing.success) throw new Error("expected not-found")
    expect(missing.code).toBe("teams.not-found")
  })
})
