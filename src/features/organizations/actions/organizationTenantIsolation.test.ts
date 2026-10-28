import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmAdministratorGrant } from "../../realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { organizationActivityAuthorize } from "../server/organizationActivityAuthorize.js"
import { organizationCreate } from "./organizationCreate.js"
import { organizationDomainClaim } from "./organizationDomainClaim.js"
import { organizationDomainVerify } from "./organizationDomainVerify.js"
import { organizationGet } from "./organizationGet.js"
import { organizationInvitationCreate } from "./organizationInvitationCreate.js"
import { organizationInvitationRevoke } from "./organizationInvitationRevoke.js"
import { organizationMembershipCreate } from "./organizationMembershipCreate.js"
import { organizationMembershipRemove } from "./organizationMembershipRemove.js"
import { organizationMembershipUpdate } from "./organizationMembershipUpdate.js"
import { organizationMeSwitch } from "./organizationMeSwitch.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-organization-tenant-isolation-"))
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

function activeUserCreate(database: StorageDatabase, realmId: string, userName: string): string {
  const system = realmSystemContextCreate("system")
  const created = userCreate({
    context: system,
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
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

async function organizationSeed(database: StorageDatabase, realmId: string, name: string, ownerUserId: string) {
  const organization = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name, ownerUserId },
    realmId,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  return organization.data.organization
}

test("organization activity requires realm or organization administration in the requested tenant", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate()
    const realm = realmCreate({
      context: system,
      database,
      input: { domain: "activity.example.com", name: "activity" },
    })
    const other = realmCreate({
      context: system,
      database,
      input: { domain: "activity-other.example.com", name: "other" },
    })
    expect(realm.success && other.success).toBe(true)
    if (!realm.success || !other.success) throw new Error("Realm creation failed")
    const realmId = realm.data.realm.id
    const owner = activeUserCreate(database, realmId, "activity-owner")
    const admin = activeUserCreate(database, realmId, "activity-admin")
    const member = activeUserCreate(database, realmId, "activity-member")
    const outsider = activeUserCreate(database, realmId, "activity-outsider")
    const realmAdmin = activeUserCreate(database, realmId, "activity-realm-admin")
    const organization = await organizationSeed(database, realmId, "Activity", owner)
    const tenant = (userId: string) => realmTenantContextCreate(realmId, userId)
    for (const [userId, role] of [
      [admin, "admin"],
      [member, "member"],
    ] as const) {
      expect(
        organizationMembershipCreate({
          context: tenant(owner),
          database,
          input: { roles: [role], userId },
          organizationId: organization.id,
          realmId,
        }).success,
      ).toBe(true)
    }
    expect(realmAdministratorGrant({ context: system, database, realmId, userId: realmAdmin }).success).toBe(true)
    const authorize = (userId: string, requestedRealm = realmId, organizationId = organization.id) =>
      organizationActivityAuthorize({ context: tenant(userId), database, realmId: requestedRealm, organizationId })
    for (const userId of [owner, admin, realmAdmin]) expect(authorize(userId).success).toBe(true)
    for (const userId of [member, outsider]) expect(authorize(userId).success).toBe(false)
    expect(authorize(owner, other.data.realm.id).success).toBe(false)
    expect(authorize(owner, realmId, "missing").success).toBe(false)
    expect(
      organizationActivityAuthorize({
        context: realmTenantContextCreate(other.data.realm.id, owner),
        database,
        realmId: other.data.realm.id,
        organizationId: organization.id,
      }).success,
    ).toBe(false)
  })
})

test("cross-realm organization reads are denied", async () => {
  await withDatabase(async (database) => {
    const alpha = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "org-isolation-alpha.example.com", name: "alpha" },
    })
    const beta = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "org-isolation-beta.example.com", name: "beta" },
    })
    expect(alpha.success && beta.success).toBe(true)
    if (!alpha.success || !beta.success) return
    const owner = activeUserCreate(database, alpha.data.realm.id, "isolation-owner")
    const organization = await organizationSeed(database, alpha.data.realm.id, "Isolated", owner)

    const foreign = realmTenantContextCreate(beta.data.realm.id, owner)
    expect(
      organizationGet({ context: foreign, database, organizationId: organization.id, realmId: alpha.data.realm.id })
        .success,
    ).toBe(false)

    const local = realmTenantContextCreate(alpha.data.realm.id, owner)
    expect(
      organizationGet({ context: local, database, organizationId: organization.id, realmId: alpha.data.realm.id })
        .success,
    ).toBe(true)
    expect(
      organizationGet({
        context: realmSystemContextCreate(),
        database,
        organizationId: organization.id,
        realmId: alpha.data.realm.id,
      }).success,
    ).toBe(true)
  })
})

test("organization admins cannot manage memberships in other organizations", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "membership-isolation.example.com", name: "membership isolation" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const ownerA = activeUserCreate(database, realmId, "membership-owner-a")
    const ownerB = activeUserCreate(database, realmId, "membership-owner-b")
    const memberA = activeUserCreate(database, realmId, "membership-member-a")
    const organizationA = await organizationSeed(database, realmId, "Membership A", ownerA)
    const organizationB = await organizationSeed(database, realmId, "Membership B", ownerB)
    const tenant = (userId: string) => realmTenantContextCreate(realmId, userId)

    const memberAAdded = organizationMembershipCreate({
      context: tenant(ownerA),
      database,
      input: { roles: ["member"], userId: memberA },
      organizationId: organizationA.id,
      realmId,
    })
    expect(memberAAdded.success).toBe(true)
    if (!memberAAdded.success) return
    const memberAId = memberAAdded.data.membership.id

    const memberBAdded = organizationMembershipCreate({
      context: tenant(ownerB),
      database,
      input: { roles: ["member"], userId: memberA },
      organizationId: organizationB.id,
      realmId,
    })
    expect(memberBAdded.success).toBe(true)
    if (!memberBAdded.success) return
    const memberBId = memberBAdded.data.membership.id

    // An owner of A cannot touch memberships in B, and a plain member cannot manage memberships at all.
    expect(
      organizationMembershipUpdate({
        context: tenant(ownerA),
        database,
        input: { roles: ["member"] },
        membershipId: memberBId,
        organizationId: organizationB.id,
        realmId,
      }).success,
    ).toBe(false)
    expect(
      organizationMembershipRemove({
        context: tenant(memberA),
        database,
        membershipId: memberAId,
        organizationId: organizationA.id,
        realmId,
      }).success,
    ).toBe(false)

    // Owners manage their own organization.
    expect(
      organizationMembershipUpdate({
        context: tenant(ownerA),
        database,
        input: { roles: ["admin"] },
        membershipId: memberAId,
        organizationId: organizationA.id,
        realmId,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipRemove({
        context: tenant(ownerB),
        database,
        membershipId: memberBId,
        organizationId: organizationB.id,
        realmId,
      }).success,
    ).toBe(true)
  })
})

test("organization switch stays inside the session membership", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "switch-isolation.example.com", name: "switch isolation" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const ownerA = activeUserCreate(database, realmId, "switch-owner-a")
    const ownerB = activeUserCreate(database, realmId, "switch-owner-b")
    const organizationA = await organizationSeed(database, realmId, "Switch A", ownerA)
    const organizationB = await organizationSeed(database, realmId, "Switch B", ownerB)

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      organizationId: organizationA.id,
      realmId,
      subjectId: ownerA,
      userId: ownerA,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const context = realmTenantContextCreate(realmId, ownerA)

    expect(
      organizationMeSwitch({
        context,
        database,
        input: { organizationId: organizationB.id },
        realmId,
        sessionId: issued.data.session.id,
      }).success,
    ).toBe(false)
    expect(
      organizationMeSwitch({
        context,
        database,
        input: { organizationId: organizationA.id },
        realmId,
        sessionId: issued.data.session.id,
      }).success,
    ).toBe(true)
  })
})

test("invitation revoke requires membership in the owning organization", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "invitation-isolation.example.com", name: "invitation isolation" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const ownerA = activeUserCreate(database, realmId, "invitation-owner-a")
    const ownerB = activeUserCreate(database, realmId, "invitation-owner-b")
    await organizationSeed(database, realmId, "Invitation A", ownerA)
    const organizationB = await organizationSeed(database, realmId, "Invitation B", ownerB)
    const tenant = (userId: string) => realmTenantContextCreate(realmId, userId)

    const invitation = organizationInvitationCreate({
      context: tenant(ownerB),
      database,
      input: { email: "invited@example.com", roles: ["member"] },
      organizationId: organizationB.id,
      realmId,
    })
    expect(invitation.success).toBe(true)
    if (!invitation.success) return
    const invitationId = invitation.data.invitation.id

    expect(
      organizationInvitationRevoke({
        context: tenant(ownerA),
        database,
        invitationId,
        organizationId: organizationB.id,
        realmId,
      }).success,
    ).toBe(false)
    expect(
      organizationInvitationRevoke({
        context: tenant(ownerB),
        database,
        invitationId,
        organizationId: organizationB.id,
        realmId,
      }).success,
    ).toBe(true)
  })
})

test("domain verification stays inside the owning organization", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "domain-isolation.example.com", name: "domain isolation" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const otherRealm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "domain-isolation-other.example.com", name: "other" },
    })
    expect(otherRealm.success).toBe(true)
    if (!otherRealm.success) return
    const owner = activeUserCreate(database, realmId, "domain-owner")
    const foreignUser = activeUserCreate(database, otherRealm.data.realm.id, "domain-foreigner")
    const organization = await organizationSeed(database, realmId, "Domain Org", owner)

    const claimed = organizationDomainClaim({
      context: realmTenantContextCreate(realmId, owner),
      database,
      input: { domain: "login.example.com" },
      organizationId: organization.id,
      realmId,
    })
    expect(claimed.success).toBe(true)
    if (!claimed.success) return
    const dnsPort = {
      txtRecordsGet: async () => resultCreate([claimed.data.domain.verification?.recordValue ?? ""]),
    }
    const foreign = realmTenantContextCreate(otherRealm.data.realm.id, foreignUser)

    expect(
      (
        await organizationDomainVerify({
          context: foreign,
          database,
          dnsPort,
          domain: "login.example.com",
          organizationId: organization.id,
          realmId,
        })
      ).success,
    ).toBe(false)
    expect(
      (
        await organizationDomainVerify({
          context: realmTenantContextCreate(realmId, owner),
          database,
          dnsPort,
          domain: "login.example.com",
          organizationId: organization.id,
          realmId,
        })
      ).success,
    ).toBe(true)
  })
})
