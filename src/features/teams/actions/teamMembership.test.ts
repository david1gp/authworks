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
import { teamGet } from "./teamGet.js"
import { teamList } from "./teamList.js"
import { teamMemberAssign } from "./teamMemberAssign.js"
import { teamMemberUnassign } from "./teamMemberUnassign.js"
import { teamUpdate } from "./teamUpdate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-team-membership-"))
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

test("team member assignment moves people between teams and unassigns them", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "teams-move.example.com", name: "teams-move" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const owner = seedUser(database, realmId, "move-owner")
    const member = seedUser(database, realmId, "move-member")
    const helper = seedUser(database, realmId, "move-helper")
    const outsider = seedUser(database, realmId, "move-outsider")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Acme", ownerUserId: owner },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) throw new Error(organization.errorMessage)
    const organizationId = organization.data.organization.id
    const ownerContext = realmTenantContextCreate(realmId, owner)
    for (const userId of [member, helper]) {
      expect(
        organizationMembershipCreate({
          context: ownerContext,
          database,
          input: { roles: ["member"], userId },
          organizationId,
          realmId,
        }).success,
      ).toBe(true)
    }
    const teamA = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: owner, name: "Team A", slug: "team-a" },
      organizationId,
      realmId,
    })
    const teamB = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: helper, name: "Team B", slug: "team-b" },
      organizationId,
      realmId,
    })
    expect(teamA.success).toBe(true)
    expect(teamB.success).toBe(true)
    if (!teamA.success || !teamB.success) throw new Error("team setup failed")

    const assigned = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: member },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(assigned.success).toBe(true)
    if (!assigned.success) throw new Error(assigned.errorMessage)
    expect(assigned.data.team.memberCount).toBe(2)

    const moved = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: member },
      organizationId,
      realmId,
      teamRef: "team-b",
    })
    expect(moved.success).toBe(true)
    if (!moved.success) throw new Error(moved.errorMessage)
    expect(moved.data.team.id).toBe(teamB.data.team.id)
    const afterMoveA = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(afterMoveA.success).toBe(true)
    if (!afterMoveA.success) throw new Error(afterMoveA.errorMessage)
    expect(afterMoveA.data.team.memberCount).toBe(1)

    const unassigned = teamMemberUnassign({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: "team-b",
      userId: member,
    })
    expect(unassigned.success).toBe(true)
    const listed = teamList({ context: ownerContext, database, organizationId, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) throw new Error(listed.errorMessage)
    expect(listed.data.unassignedCount).toBe(1)

    const nonMember = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: outsider },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(nonMember.success).toBe(false)
    if (nonMember.success) throw new Error("expected non-member rejection")
    expect(nonMember.code).toBe("teams.not-member")
  })
})

test("team leader removal conflicts and leadership transfer auto-adds the new leader", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "teams-leader.example.com", name: "teams-leader" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const owner = seedUser(database, realmId, "leader-owner")
    const leader = seedUser(database, realmId, "leader-user")
    const successor = seedUser(database, realmId, "leader-successor")
    const other = seedUser(database, realmId, "leader-other")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Acme", ownerUserId: owner },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) throw new Error(organization.errorMessage)
    const organizationId = organization.data.organization.id
    const ownerContext = realmTenantContextCreate(realmId, owner)
    for (const userId of [leader, successor, other]) {
      expect(
        organizationMembershipCreate({
          context: ownerContext,
          database,
          input: { roles: ["member"], userId },
          organizationId,
          realmId,
        }).success,
      ).toBe(true)
    }
    const first = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leader, name: "Team A", slug: "team-a" },
      organizationId,
      realmId,
    })
    const second = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: other, name: "Team B", slug: "team-b" },
      organizationId,
      realmId,
    })
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) throw new Error("team setup failed")
    const joined = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: successor },
      organizationId,
      realmId,
      teamRef: second.data.team.id,
    })
    expect(joined.success).toBe(true)
    if (!joined.success) throw new Error(joined.errorMessage)

    const leaderRemoval = teamMemberUnassign({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: first.data.team.id,
      userId: leader,
    })
    expect(leaderRemoval.success).toBe(false)
    if (leaderRemoval.success) throw new Error("expected leader conflict")
    expect(leaderRemoval.code).toBe("teams.leader-conflict")

    const transfer = teamUpdate({
      context: ownerContext,
      database,
      input: { leaderUserId: successor },
      organizationId,
      realmId,
      teamRef: first.data.team.id,
    })
    expect(transfer.success).toBe(true)
    if (!transfer.success) throw new Error(transfer.errorMessage)
    expect(transfer.data.team.leader.userId).toBe(successor)
    expect(transfer.data.team.memberCount).toBe(2)
    const secondView = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: second.data.team.id,
    })
    expect(secondView.success).toBe(true)
    if (!secondView.success) throw new Error(secondView.errorMessage)
    expect(secondView.data.team.memberCount).toBe(1)
    const previousLeaderView = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: first.data.team.id,
    })
    expect(previousLeaderView.success).toBe(true)
    if (!previousLeaderView.success) throw new Error(previousLeaderView.errorMessage)
    expect(previousLeaderView.data.team.leader.userId).toBe(successor)
    const leaderEvents = database.sqlite
      .prepare("select event_type from events where event_type = 'team.leader_changed'")
      .all() as { event_type: string }[]
    expect(leaderEvents).toHaveLength(1)
  })
})

test("team leaders manage members only on their own team", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "teams-leader-scope.example.com", name: "teams-leader-scope" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const owner = seedUser(database, realmId, "scope-owner")
    const leaderA = seedUser(database, realmId, "scope-leader-a")
    const leaderB = seedUser(database, realmId, "scope-leader-b")
    const member = seedUser(database, realmId, "scope-member")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Acme", ownerUserId: owner },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) throw new Error(organization.errorMessage)
    const organizationId = organization.data.organization.id
    const ownerContext = realmTenantContextCreate(realmId, owner)
    for (const userId of [leaderA, leaderB, member]) {
      expect(
        organizationMembershipCreate({
          context: ownerContext,
          database,
          input: { roles: ["member"], userId },
          organizationId,
          realmId,
        }).success,
      ).toBe(true)
    }
    const teamA = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderA, name: "Team A", slug: "team-a" },
      organizationId,
      realmId,
    })
    const teamB = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderB, name: "Team B", slug: "team-b" },
      organizationId,
      realmId,
    })
    expect(teamA.success).toBe(true)
    expect(teamB.success).toBe(true)
    if (!teamA.success || !teamB.success) throw new Error("team setup failed")
    const leaderAContext = realmTenantContextCreate(realmId, leaderA)
    const ownAssign = teamMemberAssign({
      context: leaderAContext,
      database,
      input: { userId: member },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(ownAssign.success).toBe(true)
    const otherAssign = teamMemberAssign({
      context: leaderAContext,
      database,
      input: { userId: member },
      organizationId,
      realmId,
      teamRef: teamB.data.team.id,
    })
    expect(otherAssign.success).toBe(false)
    const otherUnassign = teamMemberUnassign({
      context: leaderAContext,
      database,
      organizationId,
      realmId,
      teamRef: teamB.data.team.id,
      userId: leaderB,
    })
    expect(otherUnassign.success).toBe(false)
    const ownUnassign = teamMemberUnassign({
      context: leaderAContext,
      database,
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
      userId: member,
    })
    expect(ownUnassign.success).toBe(true)
  })
})

test("leader-scope assignment accepts only unassigned people", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "teams-leader-assign-scope.example.com", name: "teams-leader-assign-scope" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const owner = seedUser(database, realmId, "assign-scope-owner")
    const leaderA = seedUser(database, realmId, "assign-scope-leader-a")
    const leaderB = seedUser(database, realmId, "assign-scope-leader-b")
    const member = seedUser(database, realmId, "assign-scope-member")
    const loner = seedUser(database, realmId, "assign-scope-loner")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Acme", ownerUserId: owner },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) throw new Error(organization.errorMessage)
    const organizationId = organization.data.organization.id
    const ownerContext = realmTenantContextCreate(realmId, owner)
    for (const userId of [leaderA, leaderB, member, loner]) {
      expect(
        organizationMembershipCreate({
          context: ownerContext,
          database,
          input: { roles: ["member"], userId },
          organizationId,
          realmId,
        }).success,
      ).toBe(true)
    }
    const teamA = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderA, name: "Team A", slug: "team-a" },
      organizationId,
      realmId,
    })
    const teamB = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderB, name: "Team B", slug: "team-b" },
      organizationId,
      realmId,
    })
    expect(teamA.success).toBe(true)
    expect(teamB.success).toBe(true)
    if (!teamA.success || !teamB.success) throw new Error("team setup failed")
    expect(
      teamMemberAssign({
        context: ownerContext,
        database,
        input: { userId: member },
        organizationId,
        realmId,
        teamRef: teamB.data.team.id,
      }).success,
    ).toBe(true)
    const leaderAContext = realmTenantContextCreate(realmId, leaderA)

    const added = teamMemberAssign({
      context: leaderAContext,
      database,
      input: { userId: loner },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(added.success).toBe(true)

    const idempotent = teamMemberAssign({
      context: leaderAContext,
      database,
      input: { userId: loner },
      organizationId,
      realmId,
      teamRef: "team-a",
    })
    expect(idempotent.success).toBe(true)

    const poached = teamMemberAssign({
      context: leaderAContext,
      database,
      input: { userId: member },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(poached.success).toBe(false)
    if (poached.success) throw new Error("expected cross-team denial")
    expect(poached.code).toBe("teams.forbidden")
    const stillThere = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: teamB.data.team.id,
    })
    expect(stillThere.success).toBe(true)
    if (!stillThere.success) throw new Error(stillThere.errorMessage)
    expect(stillThere.data.team.memberCount).toBe(2)

    const moved = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: member },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(moved.success).toBe(true)
  })
})

test("assigning another team's leader fails and leaves both teams unchanged", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "teams-leader-move.example.com", name: "teams-leader-move" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const owner = seedUser(database, realmId, "steal-owner")
    const leaderA = seedUser(database, realmId, "steal-leader-a")
    const leaderB = seedUser(database, realmId, "steal-leader-b")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Acme", ownerUserId: owner },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) throw new Error(organization.errorMessage)
    const organizationId = organization.data.organization.id
    const ownerContext = realmTenantContextCreate(realmId, owner)
    for (const userId of [leaderA, leaderB]) {
      expect(
        organizationMembershipCreate({
          context: ownerContext,
          database,
          input: { roles: ["member"], userId },
          organizationId,
          realmId,
        }).success,
      ).toBe(true)
    }
    const teamA = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderA, name: "Team A", slug: "team-a" },
      organizationId,
      realmId,
    })
    const teamB = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderB, name: "Team B", slug: "team-b" },
      organizationId,
      realmId,
    })
    expect(teamA.success).toBe(true)
    expect(teamB.success).toBe(true)
    if (!teamA.success || !teamB.success) throw new Error("team setup failed")

    const stolen = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: leaderA },
      organizationId,
      realmId,
      teamRef: teamB.data.team.id,
    })
    expect(stolen.success).toBe(false)
    if (stolen.success) throw new Error("expected leader conflict")
    expect(stolen.code).toBe("teams.leader-conflict")

    const afterA = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(afterA.success).toBe(true)
    if (!afterA.success) throw new Error(afterA.errorMessage)
    expect(afterA.data.team.leader.userId).toBe(leaderA)
    expect(afterA.data.team.memberCount).toBe(1)
    const afterB = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: teamB.data.team.id,
    })
    expect(afterB.success).toBe(true)
    if (!afterB.success) throw new Error(afterB.errorMessage)
    expect(afterB.data.team.leader.userId).toBe(leaderB)
    expect(afterB.data.team.memberCount).toBe(1)

    const idempotent = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: leaderA },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(idempotent.success).toBe(true)
  })
})

test("transferring leadership to another team's leader fails, and the former leader can move after transfer", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "teams-leader-handoff.example.com", name: "teams-leader-handoff" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) throw new Error(realm.errorMessage)
    const realmId = realm.data.realm.id
    const owner = seedUser(database, realmId, "handoff-owner")
    const leaderA = seedUser(database, realmId, "handoff-leader-a")
    const leaderB = seedUser(database, realmId, "handoff-leader-b")
    const successor = seedUser(database, realmId, "handoff-successor")
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Acme", ownerUserId: owner },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) throw new Error(organization.errorMessage)
    const organizationId = organization.data.organization.id
    const ownerContext = realmTenantContextCreate(realmId, owner)
    for (const userId of [leaderA, leaderB, successor]) {
      expect(
        organizationMembershipCreate({
          context: ownerContext,
          database,
          input: { roles: ["member"], userId },
          organizationId,
          realmId,
        }).success,
      ).toBe(true)
    }
    const teamA = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderA, name: "Team A", slug: "team-a" },
      organizationId,
      realmId,
    })
    const teamB = teamCreate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderB, name: "Team B", slug: "team-b" },
      organizationId,
      realmId,
    })
    expect(teamA.success).toBe(true)
    expect(teamB.success).toBe(true)
    if (!teamA.success || !teamB.success) throw new Error("team setup failed")

    const hostile = teamUpdate({
      context: ownerContext,
      database,
      input: { leaderUserId: leaderB },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(hostile.success).toBe(false)
    if (hostile.success) throw new Error("expected leader conflict")
    expect(hostile.code).toBe("teams.leader-conflict")
    const unchanged = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(unchanged.success).toBe(true)
    if (!unchanged.success) throw new Error(unchanged.errorMessage)
    expect(unchanged.data.team.leader.userId).toBe(leaderA)
    expect(unchanged.data.team.memberCount).toBe(1)

    const transfer = teamUpdate({
      context: ownerContext,
      database,
      input: { leaderUserId: successor },
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(transfer.success).toBe(true)
    if (!transfer.success) throw new Error(transfer.errorMessage)
    expect(transfer.data.team.leader.userId).toBe(successor)

    const moved = teamMemberAssign({
      context: ownerContext,
      database,
      input: { userId: leaderA },
      organizationId,
      realmId,
      teamRef: teamB.data.team.id,
    })
    expect(moved.success).toBe(true)
    if (!moved.success) throw new Error(moved.errorMessage)
    expect(moved.data.team.id).toBe(teamB.data.team.id)
    const afterA = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: teamA.data.team.id,
    })
    expect(afterA.success).toBe(true)
    if (!afterA.success) throw new Error(afterA.errorMessage)
    expect(afterA.data.team.leader.userId).toBe(successor)
    expect(afterA.data.team.memberCount).toBe(1)
    const afterB = teamGet({
      context: ownerContext,
      database,
      organizationId,
      realmId,
      teamRef: teamB.data.team.id,
    })
    expect(afterB.success).toBe(true)
    if (!afterB.success) throw new Error(afterB.errorMessage)
    expect(afterB.data.team.leader.userId).toBe(leaderB)
    expect(afterB.data.team.memberCount).toBe(2)
  })
})
