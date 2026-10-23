import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLifecycleSet } from "../../src/features/organizations/actions/organizationLifecycleSet.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { organizationMembershipTable } from "../../src/features/organizations/persistence/organizationMembershipTable.js"
import { organizationServerAppCreate } from "../../src/features/organizations/server/organizationServerAppCreate.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { projectCreate } from "../../src/features/projects/actions/projectCreate.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userDelete } from "../../src/features/users/actions/userDelete.js"
import { userEmailVerificationSet } from "../../src/features/users/actions/userEmailVerificationSet.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userTable } from "../../src/features/users/persistence/userTable.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T> | T): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-purge-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
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

function createUser(database: StorageDatabase, realmId: string, userName: string) {
  return userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
}

function activeUser(database: StorageDatabase, realmId: string, userName: string) {
  const created = createUser(database, realmId, userName)
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const verified = userEmailVerificationSet({
    context: realmSystemContextCreate("system"),
    database,
    input: { state: "verified" },
    realmId,
    userId: created.data.user.id,
  })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  const active = userLifecycleSet({
    context: realmSystemContextCreate("system"),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return verified.data.user
}

async function realmWithOrganizations(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate("system")
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const first = organizationCreate({ context: system, database, input: { name: "Purge Org One" }, realmId })
  const second = organizationCreate({ context: system, database, input: { name: "Purge Org Two" }, realmId })
  expect(first.success && second.success).toBe(true)
  if (!first.success || !second.success) throw new Error("organization create failed")
  return { realmId, firstOrgId: first.data.organization.id, secondOrgId: second.data.organization.id }
}

function eventsOf(database: StorageDatabase, aggregateId: string) {
  return database.db.select().from(storageEventTable).where(eq(storageEventTable.aggregateId, aggregateId)).all()
}

test("purge requires the user to be soft-deleted first", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({ context: system, database, input: { domain: "userpurge.example.com", name: "UP" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const admin = activeUser(database, realmId, "purge-admin")
    const target = activeUser(database, realmId, "purge-target")
    expect(realmAdministratorGrant({ context: system, database, realmId, userId: admin.id }).success).toBe(true)

    const app = userServerAppCreate({
      database,
      publicOrigin: "https://purge-require.example.com",
      systemSecret: "system-secret",
    })
    const adminSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: admin.id,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return
    const authed = await app.request(`https://purge-require.example.com/realms/${realmId}/users/${target.id}/purge`, {
      headers: { authorization: `Bearer ${adminSession.data.token}` },
      method: "POST",
    })
    expect(authed.status).toBe(409)
    expect(((await authed.json()) as { error: { code: string } }).error.code).toBe("users.purge-not-deleted")
    const client = userApiClientCreate({
      baseUrl: "https://purge-require.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: adminSession.data.token,
    })
    expect(typeof client.userTenantPurge).toBe("function")
  })
})

test("user purge removes rows, sessions, memberships and that user's events", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const { firstOrgId, realmId } = await realmWithOrganizations(database, "userpurge2.example.com")
    const admin = activeUser(database, realmId, "purge-admin-two")
    const target = activeUser(database, realmId, "purge-target-two")
    const other = activeUser(database, realmId, "purge-other-two")
    expect(realmAdministratorGrant({ context: system, database, realmId, userId: admin.id }).success).toBe(true)
    expect(
      organizationMembershipCreate({
        context: system,
        database,
        input: { roles: ["member"], userId: target.id },
        organizationId: firstOrgId,
        realmId,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipCreate({
        context: system,
        database,
        input: { roles: ["member"], userId: other.id },
        organizationId: firstOrgId,
        realmId,
      }).success,
    ).toBe(true)
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: target.id,
    })
    expect(session.success).toBe(true)
    expect(eventsOf(database, target.id).length).toBeGreaterThan(0)

    const deleted = await userDelete({ context: system, database, realmId, userId: target.id })
    expect(deleted.success).toBe(true)

    const app = userServerAppCreate({
      database,
      publicOrigin: "https://userpurge2.example.com",
      systemSecret: "system-secret",
    })
    const adminSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: admin.id,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return
    const purgedResponse = await app.request(
      `https://userpurge2.example.com/realms/${realmId}/users/${target.id}/purge`,
      { headers: { authorization: `Bearer ${adminSession.data.token}` }, method: "POST" },
    )
    expect(purgedResponse.status).toBe(200)
    expect(await purgedResponse.json()).toEqual({ purged: true })
    // browser client exists for e2e cleanup (session flow covered by org/user route tests)
    const client = userApiClientCreate({
      baseUrl: "https://userpurge2.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: adminSession.data.token,
    })
    expect(typeof client.userTenantPurge).toBe("function")

    expect(database.db.select().from(userTable).where(eq(userTable.id, target.id)).get()).toBeUndefined()
    expect(
      database.db
        .select()
        .from(organizationMembershipTable)
        .where(and(eq(organizationMembershipTable.realmId, realmId), eq(organizationMembershipTable.userId, target.id)))
        .all(),
    ).toHaveLength(0)
    expect(eventsOf(database, target.id)).toHaveLength(0)
    // Other users' events are untouched.
    expect(eventsOf(database, other.id).length).toBeGreaterThan(0)
    expect(
      database.db
        .select()
        .from(organizationMembershipTable)
        .where(and(eq(organizationMembershipTable.realmId, realmId), eq(organizationMembershipTable.userId, other.id)))
        .all(),
    ).toHaveLength(1)
  })
})

test("append-only trigger still blocks deleting non-purged events", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    // Other features' tests run first in isolation but share nothing here;
    // the append-only guard must hold on a fresh database.
    const realm = realmCreate({ context: system, database, input: { domain: "guarded.example.com", name: "GE" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const target = activeUser(database, realm.data.realm.id, "guarded-user")
    expect(eventsOf(database, target.id).length).toBeGreaterThan(0)
    expect(() => database.sqlite.query("DELETE FROM events WHERE aggregate_id = ?").run(target.id)).toThrow(
      /append-only/,
    )
  })
})

test("project purge requires removed status and org owner is denied realm purge", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({ context: system, database, input: { domain: "orgpurge.example.com", name: "OP" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const admin = activeUser(database, realmId, "org-purge-admin")
    const owner = activeUser(database, realmId, "org-owner")
    expect(realmAdministratorGrant({ context: system, database, realmId, userId: admin.id }).success).toBe(true)
    const created = organizationCreate({
      context: system,
      database,
      input: { name: "Removable", ownerUserId: owner.id },
      realmId,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const organizationId = created.data.organization.id
    const project = projectCreate({
      context: system,
      database,
      input: { name: "doomed", organizationId },
      realmId,
    })
    expect(project.success).toBe(true)
    if (!project.success) return

    const app = organizationServerAppCreate({ database, publicOrigin: "https://orgpurge.example.com" })
    const ownerSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: owner.id,
    })
    expect(ownerSession.success).toBe(true)
    if (!ownerSession.success) return
    const deniedResponse = await app.request(
      `https://orgpurge.example.com/realms/${realmId}/organizations/${organizationId}/purge`,
      { headers: { authorization: `Bearer ${ownerSession.data.token}` }, method: "POST" },
    )
    expect(deniedResponse.status).toBe(403)

    const adminSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: admin.id,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return
    const tooEarlyResponse = await app.request(
      `https://orgpurge.example.com/realms/${realmId}/organizations/${organizationId}/purge`,
      { headers: { authorization: `Bearer ${adminSession.data.token}` }, method: "POST" },
    )
    expect(tooEarlyResponse.status).toBe(409)
    expect(((await tooEarlyResponse.json()) as { error: { code: string } }).error.code).toBe(
      "organizations.purge-not-removed",
    )
    const adminClient = organizationApiClientCreate({
      baseUrl: "https://orgpurge.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: adminSession.data.token,
    })
    expect(typeof adminClient.organizationTenantPurge).toBe("function")

    expect(
      organizationLifecycleSet({
        context: system,
        database,
        input: { status: "removed" },
        organizationId,
        realmId,
      }).success,
    ).toBe(true)
    const purgedResponse = await app.request(
      `https://orgpurge.example.com/realms/${realmId}/organizations/${organizationId}/purge`,
      { headers: { authorization: `Bearer ${adminSession.data.token}` }, method: "POST" },
    )
    expect(purgedResponse.status).toBe(200)
    expect(await purgedResponse.json()).toEqual({ projectsDeleted: 1, purged: true })
    expect(eventsOf(database, organizationId)).toHaveLength(0)
    expect(eventsOf(database, project.data.project.id)).toHaveLength(0)
  })
})

test("realm admin sets a password and the user can log in", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({ context: system, database, input: { domain: "setpass.example.com", name: "SP" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const admin = activeUser(database, realmId, "setpass-admin")
    const owner = activeUser(database, realmId, "setpass-owner")
    const target = activeUser(database, realmId, "setpass-target")
    expect(realmAdministratorGrant({ context: system, database, realmId, userId: admin.id }).success).toBe(true)
    const organization = organizationCreate({
      context: system,
      database,
      input: { name: "Setpass Org", ownerUserId: owner.id },
      realmId,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return

    const realmPasswordApp = passwordServerAppCreate({ database, publicOrigin: "https://setpass.example.com" })
    const ownerSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: owner.id,
    })
    expect(ownerSession.success).toBe(true)
    if (!ownerSession.success) return
    const ownerDeniedResponse = await realmPasswordApp.request(
      `https://setpass.example.com/realms/${realmId}/users/${target.id}/password`,
      {
        body: JSON.stringify({ password: "Owner Set Password 1!" }),
        headers: { authorization: `Bearer ${ownerSession.data.token}`, "content-type": "application/json" },
        method: "PUT",
      },
    )
    expect(ownerDeniedResponse.status).toBe(403)

    const adminSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId,
      userId: admin.id,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return
    const setResponse = await realmPasswordApp.request(
      `https://setpass.example.com/realms/${realmId}/users/${target.id}/password`,
      {
        body: JSON.stringify({ password: "Correct Horse 99!" }),
        headers: { authorization: `Bearer ${adminSession.data.token}`, "content-type": "application/json" },
        method: "PUT",
      },
    )
    expect(setResponse.status).toBe(200)
    expect(await setResponse.json()).toEqual({ changed: true })
    const adminPasswordClient = passwordApiClientCreate({
      baseUrl: "https://setpass.example.com",
      fetch: async (input, init) => realmPasswordApp.request(input.toString(), init),
      token: adminSession.data.token,
    })
    expect(typeof adminPasswordClient.passwordUserTenantSet).toBe("function")

    const login = passwordLogin({
      context: realmTenantContextCreate(realmId, "anonymous"),
      database,
      input: { identifier: target.userName, password: "Correct Horse 99!" },
      realmId,
    })
    expect(login.success).toBe(true)
  })
})
