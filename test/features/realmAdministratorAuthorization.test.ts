import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { authorizationUserActorContextCreate } from "../../src/features/authorization/domain/authorizationUserActorContextCreate.js"
import { oidcConsentList } from "../../src/features/oidc/actions/oidcConsentList.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationMembershipRemove } from "../../src/features/organizations/actions/organizationMembershipRemove.js"
import { organizationMembershipUpdate } from "../../src/features/organizations/actions/organizationMembershipUpdate.js"
import { organizationRepositoryCreate } from "../../src/features/organizations/persistence/organizationRepositoryCreate.js"
import { realmAdministratorContextAuthorize } from "../../src/features/realms/actions/realmAdministratorContextAuthorize.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAdministratorList } from "../../src/features/sessions/actions/sessionAdministratorList.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userRealmReadCapabilityResolve } from "../../src/features/users/actions/userRealmReadCapabilityResolve.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-realm-admin-authorization-"))
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

function actorCreate(realmId: string, userId: string) {
  return authorizationUserActorContextCreate(realmId, userId)
}

async function setupRealm(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate("system")
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const userCreateForTest = (userName: string) => {
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
  const ownerAId = userCreateForTest(`authz-owner-a-${domain.split(".")[0]}`)
  const adminAId = userCreateForTest(`authz-admin-a-${domain.split(".")[0]}`)
  const memberAId = userCreateForTest(`authz-member-a-${domain.split(".")[0]}`)
  const ownerBId = userCreateForTest(`authz-owner-b-${domain.split(".")[0]}`)
  const memberBId = userCreateForTest(`authz-member-b-${domain.split(".")[0]}`)
  const organizationA = organizationCreate({
    context: system,
    database,
    input: { name: "Authorization A", ownerUserId: ownerAId },
    realmId,
  })
  expect(organizationA.success).toBe(true)
  if (!organizationA.success) throw new Error(organizationA.errorMessage)
  const organizationB = organizationCreate({
    context: system,
    database,
    input: { name: "Authorization B", ownerUserId: ownerBId },
    realmId,
  })
  expect(organizationB.success).toBe(true)
  if (!organizationB.success) throw new Error(organizationB.errorMessage)
  const membership = (
    actorId: string,
    organizationId: string,
    memberId: string,
    roles: readonly ["admin"] | readonly ["member"],
  ) =>
    organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, actorId),
      database,
      input: { roles: [...roles], userId: memberId },
      organizationId,
      realmId,
    })
  for (const created of [
    membership(ownerAId, organizationA.data.organization.id, adminAId, ["admin"]),
    membership(ownerAId, organizationA.data.organization.id, memberAId, ["member"]),
    membership(ownerBId, organizationB.data.organization.id, memberBId, ["member"]),
  ]) {
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
  }
  return {
    adminAId,
    memberAId,
    memberBId,
    organizationA: organizationA.data.organization,
    organizationB: organizationB.data.organization,
    ownerAId,
    ownerBId,
    realmId,
  }
}

test("organization owners are denied realm-wide administration without a target", async () => {
  await withDatabase(async (database) => {
    const { memberAId, ownerAId, ownerBId, realmId } = await setupRealm(database, "realm-admin-authz-a-one.example.com")
    const ownerA = actorCreate(realmId, ownerAId)
    for (const permission of ["realm.write", "oidc.write", "user.read", "event.read"] as const) {
      expect(realmAdministratorContextAuthorize({ actor: ownerA, database, permission, realmId }).success).toBe(false)
    }
    expect(sessionAdministratorList({ actor: ownerA, database, realmId, userId: memberAId }).success).toBe(true)
    const other = realmAdministratorContextAuthorize({
      actor: actorCreate(realmId, ownerBId),
      database,
      permission: "user.read",
      realmId,
      targetUserId: memberAId,
    })
    expect(other.success).toBe(false)
  })
})

test("organization owners manage only users fully inside their organizations", async () => {
  await withDatabase(async (database) => {
    const { adminAId, memberAId, memberBId, organizationA, organizationB, ownerAId, ownerBId, realmId } =
      await setupRealm(database, "realm-admin-authz-b-two-x.example.com")
    const ownerA = actorCreate(realmId, ownerAId)
    expect(
      realmAdministratorContextAuthorize({
        actor: ownerA,
        database,
        permission: "user.read",
        realmId,
        targetUserId: memberAId,
      }).success,
    ).toBe(true)
    expect(
      realmAdministratorContextAuthorize({
        actor: ownerA,
        database,
        permission: "user.manage",
        realmId,
        targetUserId: memberAId,
      }).success,
    ).toBe(true)
    expect(
      realmAdministratorContextAuthorize({
        actor: ownerA,
        database,
        permission: "user.impersonate",
        realmId,
        targetUserId: memberAId,
      }).success,
    ).toBe(true)
    expect(
      realmAdministratorContextAuthorize({
        actor: ownerA,
        database,
        permission: "user.manage",
        realmId,
        targetUserId: memberBId,
      }).success,
    ).toBe(false)

    const crossMembership = organizationMembershipCreate({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      input: { roles: ["member"], userId: memberAId },
      organizationId: organizationB.id,
      realmId,
    })
    expect(crossMembership.success).toBe(true)
    expect(
      realmAdministratorContextAuthorize({
        actor: ownerA,
        database,
        permission: "user.manage",
        realmId,
        targetUserId: memberAId,
      }).success,
    ).toBe(false)
    expect(
      realmAdministratorContextAuthorize({
        actor: ownerA,
        database,
        permission: "user.read",
        realmId,
        targetUserId: memberAId,
      }).success,
    ).toBe(true)

    const adminA = actorCreate(realmId, adminAId)
    const adminManageOwner = realmAdministratorContextAuthorize({
      actor: adminA,
      database,
      permission: "user.manage",
      realmId,
      targetUserId: ownerAId,
    })
    expect(adminManageOwner.success).toBe(false)

    const memberAOrgBMembershipRows = organizationRepositoryCreate(database.db).organizationMembershipListByRealmUser(
      realmId,
      memberAId,
    )
    expect(memberAOrgBMembershipRows.success).toBe(true)
    const memberAOrgBMembershipId =
      memberAOrgBMembershipRows.success === true
        ? memberAOrgBMembershipRows.data.find((membership) => membership.organizationId === organizationB.id)?.id
        : undefined
    expect(memberAOrgBMembershipId).toBeString()
    if (memberAOrgBMembershipId !== undefined) {
      const removed = organizationMembershipRemove({
        context: realmTenantContextCreate(realmId, ownerBId),
        database,
        membershipId: memberAOrgBMembershipId,
        organizationId: organizationB.id,
        realmId,
      })
      expect(removed.success).toBe(true)
    }
    const adminManageMember = realmAdministratorContextAuthorize({
      actor: adminA,
      database,
      permission: "user.manage",
      realmId,
      targetUserId: memberAId,
    })
    expect(adminManageMember.success).toBe(true)

    const granted = realmAdministratorGrant({
      context: realmSystemContextCreate("system"),
      database,
      realmId,
      userId: memberBId,
    })
    expect(granted.success).toBe(true)
    expect(
      realmAdministratorContextAuthorize({
        actor: ownerA,
        database,
        permission: "user.manage",
        realmId,
        targetUserId: memberBId,
      }).success,
    ).toBe(false)
    expect(
      oidcConsentList({
        administrator: true,
        context: realmTenantContextCreate(realmId, ownerAId),
        database,
        realmId,
        userId: memberBId,
      }).success,
    ).toBe(false)
    expect(organizationA.id.length).toBeGreaterThan(0)
  })
})

test("realm administrators keep full tenant administration and capabilities", async () => {
  await withDatabase(async (database) => {
    const { memberAId, memberBId, organizationB, ownerAId, ownerBId, realmId } = await setupRealm(
      database,
      "realm-admin-authz-c-three.example.com",
    )
    const granted = realmAdministratorGrant({
      context: realmSystemContextCreate("system"),
      database,
      realmId,
      userId: ownerAId,
    })
    expect(granted.success).toBe(true)
    const administrator = actorCreate(realmId, ownerAId)
    for (const permission of [
      "realm.read",
      "realm.write",
      "oidc.read",
      "oidc.write",
      "event.read",
      "user.read",
      "user.manage",
      "user.impersonate",
    ] as const) {
      expect(realmAdministratorContextAuthorize({ actor: administrator, database, permission, realmId }).success).toBe(
        true,
      )
    }
    expect(
      realmAdministratorContextAuthorize({
        actor: administrator,
        database,
        permission: "user.manage",
        realmId,
        targetUserId: memberBId,
      }).success,
    ).toBe(true)
    expect(sessionAdministratorList({ actor: administrator, database, realmId, userId: memberAId }).success).toBe(true)

    const capabilities = userRealmReadCapabilityResolve({ actor: administrator, database, realmId })
    expect(capabilities).toMatchObject({ success: true, data: { realmAdministrator: true, realmRead: true } })
    const ownerCapabilities = userRealmReadCapabilityResolve({
      actor: actorCreate(realmId, ownerBId),
      database,
      realmId,
    })
    expect(ownerCapabilities).toMatchObject({
      success: true,
      data: { realmAdministrator: false, realmRead: false },
    })
    expect(organizationB.id.length).toBeGreaterThan(0)
  })
})

test("organization owners administer their users through tenant routes", async () => {
  await withDatabase(async (database) => {
    const domain = "realm-admin-authz-d.example.com"
    const { memberAId, memberBId, ownerAId, realmId } = await setupRealm(database, domain)
    const app = userServerAppCreate({ database, publicOrigin: `https://${domain}` })
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
    const token = await sessionFor(ownerAId)
    const ownMember = await app.request(`https://${domain}/realms/${realmId}/users/${memberAId}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(ownMember.status).toBe(200)
    const listDenied = await app.request(`https://${domain}/realms/${realmId}/users`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listDenied.status).toBe(403)
    const foreignMember = await app.request(`https://${domain}/realms/${realmId}/users/${memberBId}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(foreignMember.status).toBe(403)
    const update = await app.request(`https://${domain}/realms/${realmId}/users/${memberAId}/profile`, {
      body: JSON.stringify({ displayName: "Managed Member" }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "PATCH",
    })
    expect(update.status).toBe(200)
  })
})

test("administrators cannot escalate owners through membership role changes outside their scope", async () => {
  await withDatabase(async (database) => {
    const { memberAId, organizationA, ownerAId, ownerBId, realmId } = await setupRealm(
      database,
      "realm-admin-authz-e-five.example.com",
    )
    const repositoryRows = organizationRepositoryCreate(database.db).organizationMembershipListByRealmUser(
      realmId,
      memberAId,
    )
    expect(repositoryRows.success).toBe(true)
    const membershipId =
      repositoryRows.success === true
        ? repositoryRows.data.find((membership) => membership.organizationId === organizationA.id)?.id
        : undefined
    expect(membershipId).toBeString()
    if (membershipId === undefined) return
    const denied = organizationMembershipUpdate({
      context: realmTenantContextCreate(realmId, ownerBId),
      database,
      input: { roles: ["owner"] },
      membershipId,
      organizationId: organizationA.id,
      realmId,
    })
    expect(denied.success).toBe(false)
    const allowed = organizationMembershipUpdate({
      context: realmTenantContextCreate(realmId, ownerAId),
      database,
      input: { roles: ["admin"] },
      membershipId,
      organizationId: organizationA.id,
      realmId,
    })
    expect(allowed.success).toBe(true)
  })
})
