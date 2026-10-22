import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { authorizationUserActorContextCreate } from "../../src/features/authorization/domain/authorizationUserActorContextCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { realmAdministratorContextAuthorize } from "../../src/features/realms/actions/realmAdministratorContextAuthorize.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAdministratorList } from "../../src/features/sessions/actions/sessionAdministratorList.js"
import { sessionAdministratorRevoke } from "../../src/features/sessions/actions/sessionAdministratorRevoke.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userAuthenticationMethodsAdministratorGet } from "../../src/features/users/actions/userAuthenticationMethodsAdministratorGet.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-cross-org-admin-"))
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

async function createActiveUser(database: StorageDatabase, realmId: string, userName: string) {
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

async function setupRealm(database: StorageDatabase, domain: string = "cross-org-scope.example.com") {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id

  const ownerAId = await createActiveUser(database, realmId, `owner-a-${domain.split(".")[0]}`)
  const ownerBId = await createActiveUser(database, realmId, `owner-b-${domain.split(".")[0]}`)
  const memberAId = await createActiveUser(database, realmId, `member-a-${domain.split(".")[0]}`)
  const memberBId = await createActiveUser(database, realmId, `member-b-${domain.split(".")[0]}`)

  const organizationA = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name: "Organization A", ownerUserId: ownerAId },
    realmId,
  })
  expect(organizationA.success).toBe(true)
  if (!organizationA.success) throw new Error(organizationA.errorMessage)
  const organizationB = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name: "Organization B", ownerUserId: ownerBId },
    realmId,
  })
  expect(organizationB.success).toBe(true)
  if (!organizationB.success) throw new Error(organizationB.errorMessage)

  const ownerA = realmTenantContextCreate(realmId, ownerAId)
  const memberA = organizationMembershipCreate({
    context: ownerA,
    database,
    input: { roles: ["member"], userId: memberAId },
    organizationId: organizationA.data.organization.id,
    realmId,
  })
  expect(memberA.success).toBe(true)
  const ownerB = realmTenantContextCreate(realmId, ownerBId)
  const memberB = organizationMembershipCreate({
    context: ownerB,
    database,
    input: { roles: ["member"], userId: memberBId },
    organizationId: organizationB.data.organization.id,
    realmId,
  })
  expect(memberB.success).toBe(true)
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

test("administrators cannot list or revoke sessions of users outside their organizations", async () => {
  await withDatabase(async (database) => {
    const { memberAId, memberBId, ownerAId, ownerBId, realmId } = await setupRealm(database)
    const actorA = authorizationUserActorContextCreate(realmId, ownerAId)
    const actorB = authorizationUserActorContextCreate(realmId, ownerBId)

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      subjectId: memberBId,
      userId: memberBId,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    expect(sessionAdministratorList({ actor: actorA, database, realmId, userId: memberBId }).success).toBe(false)
    expect(sessionAdministratorList({ actor: actorB, database, realmId, userId: memberBId }).success).toBe(true)
    expect(sessionAdministratorList({ actor: actorA, database, realmId, userId: memberAId }).success).toBe(true)

    expect(
      sessionAdministratorRevoke({
        actor: actorA,
        database,
        realmId,
        sessionId: issued.data.session.id,
        userId: memberBId,
      }).success,
    ).toBe(false)
    expect(
      sessionAdministratorRevoke({
        actor: actorB,
        database,
        realmId,
        sessionId: issued.data.session.id,
        userId: memberBId,
      }).success,
    ).toBe(true)
  })
})

test("administrators cannot read authentication methods of users outside their organizations", async () => {
  await withDatabase(async (database) => {
    const { memberBId, ownerAId, ownerBId, realmId } = await setupRealm(database)
    const actorA = authorizationUserActorContextCreate(realmId, ownerAId)
    const actorB = authorizationUserActorContextCreate(realmId, ownerBId)

    expect(
      userAuthenticationMethodsAdministratorGet({ actor: actorA, database, realmId, userId: memberBId }).success,
    ).toBe(false)
    expect(
      userAuthenticationMethodsAdministratorGet({ actor: actorB, database, realmId, userId: memberBId }).success,
    ).toBe(true)
  })
})

test("realm administrator checks scope target users to shared organizations", async () => {
  await withDatabase(async (database) => {
    const { memberAId, memberBId, ownerAId, realmId } = await setupRealm(database)
    const actorA = authorizationUserActorContextCreate(realmId, ownerAId)

    expect(
      realmAdministratorContextAuthorize({
        actor: actorA,
        database,
        permission: "user.read",
        realmId,
        targetUserId: memberBId,
      }).success,
    ).toBe(false)
    expect(
      realmAdministratorContextAuthorize({
        actor: actorA,
        database,
        permission: "user.read",
        realmId,
        targetUserId: memberAId,
      }).success,
    ).toBe(true)
    expect(
      realmAdministratorContextAuthorize({ actor: actorA, database, permission: "user.read", realmId }).success,
    ).toBe(true)
  })
})

test("user administrator routes scope target users to shared organizations", async () => {
  await withDatabase(async (database) => {
    const domain = "cross-org-user-routes.example.com"
    const { memberAId, memberBId, ownerAId, ownerBId, realmId } = await setupRealm(database, domain)

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
      if (!issued.success) throw new Error("The admin session could not be issued.")
      return issued.data.token
    }
    const tokenA = await sessionFor(ownerAId)
    const tokenB = await sessionFor(ownerBId)

    const foreign = await app.request(`https://${domain}/realms/${realmId}/users/${memberBId}`, {
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(foreign.status).toBe(403)
    const sameOrg = await app.request(`https://${domain}/realms/${realmId}/users/${memberBId}`, {
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(sameOrg.status).toBe(200)
    const ownOrg = await app.request(`https://${domain}/realms/${realmId}/users/${memberAId}`, {
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(ownOrg.status).toBe(200)
  })
})
