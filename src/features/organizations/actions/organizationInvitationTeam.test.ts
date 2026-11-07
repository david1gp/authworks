import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { teamCreate } from "../../teams/actions/teamCreate.js"
import { teamDelete } from "../../teams/actions/teamDelete.js"
import { teamMemberAssign } from "../../teams/actions/teamMemberAssign.js"
import { teamRepositoryCreate } from "../../teams/persistence/teamRepositoryCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationCreate } from "./organizationCreate.js"
import { organizationInvitationAccept } from "./organizationInvitationAccept.js"
import { organizationInvitationCreate } from "./organizationInvitationCreate.js"
import { organizationInvitationList } from "./organizationInvitationList.js"
import { organizationInvitationMeAccept } from "./organizationInvitationMeAccept.js"
import { organizationMembershipCreate } from "./organizationMembershipCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-invitation-team-"))
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

function seedUser(database: StorageDatabase, realmId: string, userName: string): { email: string; id: string } {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return { email: `${userName}@example.com`, id: created.data.user.id }
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

function seedOrganization(database: StorageDatabase, realmId: string, ownerUserId: string, members: readonly string[]) {
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
  return organization.data.organization
}

function seedTeam(
  database: StorageDatabase,
  realmId: string,
  organizationId: string,
  actorUserId: string,
  input: { leaderUserId: string; name: string; slug: string },
): string {
  const created = teamCreate({
    context: realmTenantContextCreate(realmId, actorUserId),
    database,
    input,
    organizationId,
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.team.id
}

function teamIdOf(database: StorageDatabase, organizationId: string, userId: string): string | null {
  const membership = teamRepositoryCreate(database.db).teamMembershipGetByOrganizationUser(organizationId, userId)
  expect(membership.success).toBe(true)
  if (!membership.success) throw new Error("team membership read failed")
  return membership.data?.teamId ?? null
}

test("invitation create with teamId validates the team and exposes it with the inviter", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-team-create.example.com")
    const owner = seedUser(database, realmId, "team-invite-owner")
    const organization = seedOrganization(database, realmId, owner.id, [])
    const teamId = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: owner.id,
      name: "Engineering",
      slug: "engineering",
    })
    const invitee = seedUser(database, realmId, "team-invitee")
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const created = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: invitee.email, roles: ["member"], teamId },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.data.invitation.teamId).toBe(teamId)
    expect(created.data.invitation.team).toEqual({ name: "Engineering", slug: "engineering" })
    expect(created.data.invitation.invitedBy?.userId).toBe(owner.id)
    expect(created.data.invitation.invitedBy?.displayName).toBe("team-invite-owner")

    const unknown = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: "unknown-team@example.com", roles: ["member"], teamId: "team-does-not-exist" },
      organizationId: organization.id,
      realmId,
    })
    expect(unknown.success).toBe(false)
    if (unknown.success) throw new Error("expected team validation failure")
    expect(unknown.code).toBe("teams.not-found")
  })
})

test("invitation accept with teamId creates the team membership and resolves invitedBy", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-team-accept.example.com")
    const owner = seedUser(database, realmId, "accept-owner")
    const invitee = seedUser(database, realmId, "accept-invitee")
    const organization = seedOrganization(database, realmId, owner.id, [])
    const teamId = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: owner.id,
      name: "Engineering",
      slug: "engineering",
    })
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const created = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: invitee.email, roles: ["member"], teamId },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const accepted = organizationInvitationAccept({
      database,
      input: { token: created.data.token, userId: invitee.id },
    })
    expect(accepted.success).toBe(true)
    expect(teamIdOf(database, organization.id, invitee.id)).toBe(teamId)

    const listed = organizationInvitationList({
      context: ownerContext,
      database,
      organizationId: organization.id,
      realmId,
    })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    const invitation = listed.data.items.find((item) => item.id === created.data.invitation.id)
    expect(invitation?.status).toBe("accepted")
    expect(invitation?.teamId).toBe(teamId)
    expect(invitation?.team).toEqual({ name: "Engineering", slug: "engineering" })
    expect(invitation?.invitedBy?.userId).toBe(owner.id)
  })
})

test("invitations without teamId leave team assignment and views empty", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-team-absent.example.com")
    const owner = seedUser(database, realmId, "absent-owner")
    const invitee = seedUser(database, realmId, "absent-invitee")
    const organization = seedOrganization(database, realmId, owner.id, [])
    seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: owner.id,
      name: "Engineering",
      slug: "engineering",
    })
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const created = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: invitee.email, roles: ["member"] },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.data.invitation.teamId).toBeNull()
    expect(created.data.invitation.team).toBeNull()
    const accepted = organizationInvitationAccept({
      database,
      input: { token: created.data.token, userId: invitee.id },
    })
    expect(accepted.success).toBe(true)
    expect(teamIdOf(database, organization.id, invitee.id)).toBeNull()
  })
})

test("me accept with teamId assigns the team and moves existing members", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-team-me-accept.example.com")
    const owner = seedUser(database, realmId, "me-owner")
    const helper = seedUser(database, realmId, "me-helper")
    const invitee = seedUser(database, realmId, "me-invitee")
    const organization = seedOrganization(database, realmId, owner.id, [helper.id, invitee.id])
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const teamA = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: owner.id,
      name: "Team A",
      slug: "team-a",
    })
    const teamB = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: helper.id,
      name: "Team B",
      slug: "team-b",
    })
    expect(
      teamMemberAssign({
        context: ownerContext,
        database,
        input: { userId: invitee.id },
        organizationId: organization.id,
        realmId,
        teamRef: teamB,
      }).success,
    ).toBe(true)
    const created = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: invitee.email, roles: ["member"], teamId: teamA },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    expect(
      userLifecycleSet({
        context: realmSystemContextCreate("system"),
        database,
        input: { state: "active" },
        realmId,
        userId: invitee.id,
      }).success,
    ).toBe(true)
    const accepted = organizationInvitationMeAccept({
      context: realmTenantContextCreate(realmId, invitee.id),
      database,
      input: { token: created.data.token },
      realmId,
    })
    expect(accepted.success).toBe(true)
    expect(teamIdOf(database, organization.id, invitee.id)).toBe(teamA)
  })
})

test("accept with a team the invitee leads or a deleted team keeps the org membership and skips assignment", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-team-skip.example.com")
    const owner = seedUser(database, realmId, "skip-owner")
    const leader = seedUser(database, realmId, "skip-leader")
    const newcomer = seedUser(database, realmId, "skip-newcomer")
    const organization = seedOrganization(database, realmId, owner.id, [leader.id])
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const teamA = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: owner.id,
      name: "Team A",
      slug: "team-a",
    })
    const teamB = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: leader.id,
      name: "Team B",
      slug: "team-b",
    })
    const conflictInvite = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: leader.email, roles: ["member"], teamId: teamA },
      organizationId: organization.id,
      realmId,
    })
    expect(conflictInvite.success).toBe(true)
    if (!conflictInvite.success) throw new Error(conflictInvite.errorMessage)
    expect(
      organizationInvitationAccept({
        database,
        input: { token: conflictInvite.data.token, userId: leader.id },
      }).success,
    ).toBe(true)
    expect(teamIdOf(database, organization.id, leader.id)).toBe(teamB)

    const doomedInvite = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: newcomer.email, roles: ["member"], teamId: teamA },
      organizationId: organization.id,
      realmId,
    })
    expect(doomedInvite.success).toBe(true)
    if (!doomedInvite.success) throw new Error(doomedInvite.errorMessage)
    expect(
      teamDelete({ context: ownerContext, database, organizationId: organization.id, realmId, teamRef: teamA }).success,
    ).toBe(true)
    const newcomerAccept = organizationInvitationAccept({
      database,
      input: { token: doomedInvite.data.token, userId: newcomer.id },
    })
    expect(newcomerAccept.success).toBe(true)
    if (!newcomerAccept.success) throw new Error(newcomerAccept.errorMessage)
    expect(newcomerAccept.data.membership.userId).toBe(newcomer.id)
    expect(teamIdOf(database, organization.id, newcomer.id)).toBeNull()
  })
})

test("team leaders invite into their own team only and plain members cannot invite", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-team-leader.example.com")
    const owner = seedUser(database, realmId, "leader-owner")
    const leader = seedUser(database, realmId, "team-leader")
    const member = seedUser(database, realmId, "plain-member")
    const organization = seedOrganization(database, realmId, owner.id, [leader.id, member.id])
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const leaderContext = realmTenantContextCreate(realmId, leader.id)
    const memberContext = realmTenantContextCreate(realmId, member.id)
    const ownTeam = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: leader.id,
      name: "Own Team",
      slug: "own-team",
    })
    const otherTeam = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: owner.id,
      name: "Other Team",
      slug: "other-team",
    })
    const ownInvite = organizationInvitationCreate({
      context: leaderContext,
      database,
      input: { email: "leader-guest@example.com", roles: ["member"], teamId: ownTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(ownInvite.success).toBe(true)
    if (!ownInvite.success) throw new Error(ownInvite.errorMessage)
    expect(ownInvite.data.invitation.teamId).toBe(ownTeam)
    expect(ownInvite.data.invitation.invitedBy?.userId).toBe(leader.id)

    const otherInvite = organizationInvitationCreate({
      context: leaderContext,
      database,
      input: { email: "other-guest@example.com", roles: ["member"], teamId: otherTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(otherInvite.success).toBe(false)
    if (otherInvite.success) throw new Error("expected other-team denial")
    expect(otherInvite.code).toBe("authorization.forbidden")

    const noTeamInvite = organizationInvitationCreate({
      context: leaderContext,
      database,
      input: { email: "noteam-guest@example.com", roles: ["member"] },
      organizationId: organization.id,
      realmId,
    })
    expect(noTeamInvite.success).toBe(false)
    if (noTeamInvite.success) throw new Error("expected teamless denial")

    const memberInvite = organizationInvitationCreate({
      context: memberContext,
      database,
      input: { email: "member-guest@example.com", roles: ["member"], teamId: ownTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(memberInvite.success).toBe(false)
    if (memberInvite.success) throw new Error("expected plain member denial")

    const ownerRoleInvite = organizationInvitationCreate({
      context: leaderContext,
      database,
      input: { email: "owner-guest@example.com", roles: ["owner"], teamId: ownTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(ownerRoleInvite.success).toBe(false)
    if (ownerRoleInvite.success) throw new Error("expected owner-role denial")

    const unknownTeamInvite = organizationInvitationCreate({
      context: leaderContext,
      database,
      input: { email: "unknown-guest@example.com", roles: ["member"], teamId: "team-does-not-exist" },
      organizationId: organization.id,
      realmId,
    })
    expect(unknownTeamInvite.success).toBe(false)
    if (unknownTeamInvite.success) throw new Error("expected unknown team failure")
    expect(unknownTeamInvite.code).toBe("teams.not-found")

    const adminInvite = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: "admin-guest@example.com", roles: ["member"], teamId: otherTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(adminInvite.success).toBe(true)
  })
})

test("team leaders cannot invite with elevated organization roles", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-team-leader-roles.example.com")
    const owner = seedUser(database, realmId, "roles-owner")
    const leader = seedUser(database, realmId, "roles-leader")
    const organization = seedOrganization(database, realmId, owner.id, [leader.id])
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const leaderContext = realmTenantContextCreate(realmId, leader.id)
    const ownTeam = seedTeam(database, realmId, organization.id, owner.id, {
      leaderUserId: leader.id,
      name: "Own Team",
      slug: "own-team",
    })

    const adminInvite = organizationInvitationCreate({
      context: leaderContext,
      database,
      input: { email: "roles-admin@example.com", roles: ["admin"], teamId: ownTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(adminInvite.success).toBe(false)
    if (adminInvite.success) throw new Error("expected admin-role denial")
    expect(adminInvite.code).toBe("authorization.forbidden")

    const listed = organizationInvitationList({
      context: ownerContext,
      database,
      organizationId: organization.id,
      realmId,
    })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.some((item) => item.email === "roles-admin@example.com")).toBe(false)

    const guestInvite = organizationInvitationCreate({
      context: leaderContext,
      database,
      input: { email: "roles-guest@example.com", roles: ["guest"], teamId: ownTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(guestInvite.success).toBe(true)
    if (!guestInvite.success) throw new Error(guestInvite.errorMessage)
    expect(guestInvite.data.invitation.teamId).toBe(ownTeam)
    expect(guestInvite.data.invitation.invitedBy?.userId).toBe(leader.id)

    const adminInviterInvite = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: "roles-admin-inviter@example.com", roles: ["admin"], teamId: ownTeam },
      organizationId: organization.id,
      realmId,
    })
    expect(adminInviterInvite.success).toBe(true)
  })
})

test("purged inviters resolve to null on invitation views", async () => {
  await withDatabase(async (database) => {
    const realmId = seedRealm(database, "invitation-inviter-purged.example.com")
    const owner = seedUser(database, realmId, "purged-owner")
    const invitee = seedUser(database, realmId, "purged-invitee")
    const organization = seedOrganization(database, realmId, owner.id, [])
    const ownerContext = realmTenantContextCreate(realmId, owner.id)
    const created = organizationInvitationCreate({
      context: ownerContext,
      database,
      input: { email: invitee.email, roles: ["member"] },
      organizationId: organization.id,
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.data.invitation.invitedBy?.userId).toBe(owner.id)
    const repository = organizationRepositoryCreate(database.db)
    expect(repository.organizationInvitationUpdate(created.data.invitation.id, { invitedBy: "" }).success).toBe(true)
    const listed = organizationInvitationList({
      context: ownerContext,
      database,
      organizationId: organization.id,
      realmId,
    })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.find((item) => item.id === created.data.invitation.id)?.invitedBy).toBeNull()
  })
})
