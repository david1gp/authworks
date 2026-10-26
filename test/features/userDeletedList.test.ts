import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userDelete } from "../../src/features/users/actions/userDelete.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-deleted-list-"))
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

async function setupRealm(database: StorageDatabase) {
  const system = realmSystemContextCreate("system")
  const realm = realmCreate({
    context: system,
    database,
    input: { domain: "deleted-list.example.com", name: "DeletedList" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const userNames = ["deleted-list-admin", "deleted-list-owner", "deleted-list-target"] as const
  const ids: Record<(typeof userNames)[number], string> = {
    "deleted-list-admin": "",
    "deleted-list-owner": "",
    "deleted-list-target": "",
  }
  for (const userName of userNames) {
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
    ids[userName] = created.data.user.id
  }
  expect(
    realmAdministratorGrant({ context: system, database, realmId, userId: ids["deleted-list-admin"] }).success,
  ).toBe(true)
  const organization = organizationCreate({
    context: system,
    database,
    input: { name: "Deleted List Org", ownerUserId: ids["deleted-list-owner"] },
    realmId,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  expect(
    organizationMembershipCreate({
      context: system,
      database,
      input: { roles: ["member"], userId: ids["deleted-list-target"] },
      organizationId: organization.data.organization.id,
      realmId,
    }).success,
  ).toBe(true)
  const deleted = await userDelete({ context: system, database, realmId, userId: ids["deleted-list-target"] })
  expect(deleted.success).toBe(true)
  return { realmId, ...ids }
}

function sessionToken(database: StorageDatabase, realmId: string, userId: string) {
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

test("realm administrators see deleted users with state=deleted while the default list stays unchanged", async () => {
  await withDatabase(async (database) => {
    const { realmId, "deleted-list-admin": adminId, "deleted-list-target": targetId } = await setupRealm(database)
    const app = userServerAppCreate({
      database,
      publicOrigin: "https://deleted-list.example.com",
      systemSecret: "system-secret",
    })
    const deletedResponse = await app.request(
      `https://deleted-list.example.com/realms/${realmId}/users?state=deleted`,
      { headers: { authorization: `Bearer ${sessionToken(database, realmId, adminId)}` } },
    )
    expect(deletedResponse.status).toBe(200)
    const deletedBody = (await deletedResponse.json()) as { items: { id: string; state: string }[] }
    expect(deletedBody.items.map((item) => item.id)).toEqual([targetId])
    expect(deletedBody.items.every((item) => item.state === "deleted")).toBe(true)

    const defaultResponse = await app.request(`https://deleted-list.example.com/realms/${realmId}/users`, {
      headers: { authorization: `Bearer ${sessionToken(database, realmId, adminId)}` },
    })
    expect(defaultResponse.status).toBe(200)
    const defaultBody = (await defaultResponse.json()) as { items: { id: string }[] }
    expect(defaultBody.items.some((item) => item.id === targetId)).toBe(false)
  })
})

test("organization owners are denied the deleted user list", async () => {
  await withDatabase(async (database) => {
    const { realmId, "deleted-list-owner": ownerId } = await setupRealm(database)
    const app = userServerAppCreate({
      database,
      publicOrigin: "https://deleted-list.example.com",
      systemSecret: "system-secret",
    })
    const deniedResponse = await app.request(`https://deleted-list.example.com/realms/${realmId}/users?state=deleted`, {
      headers: { authorization: `Bearer ${sessionToken(database, realmId, ownerId)}` },
    })
    expect(deniedResponse.status).toBe(403)
    expect(((await deniedResponse.json()) as { error: { code: string } }).error.code).toBe("authorization.forbidden")
  })
})

test("an invalid state value is rejected", async () => {
  await withDatabase(async (database) => {
    const { realmId, "deleted-list-admin": adminId } = await setupRealm(database)
    const app = userServerAppCreate({
      database,
      publicOrigin: "https://deleted-list.example.com",
      systemSecret: "system-secret",
    })
    const invalidResponse = await app.request(
      `https://deleted-list.example.com/realms/${realmId}/users?state=retired`,
      {
        headers: { authorization: `Bearer ${sessionToken(database, realmId, adminId)}` },
      },
    )
    expect(invalidResponse.status).toBe(400)
    const invalidVerifiedResponse = await app.request(
      `https://deleted-list.example.com/realms/${realmId}/users?emailVerified=yes`,
      {
        headers: { authorization: `Bearer ${sessionToken(database, realmId, adminId)}` },
      },
    )
    expect(invalidVerifiedResponse.status).toBe(400)
    const activeResponse = await app.request(`https://deleted-list.example.com/realms/${realmId}/users?state=active`, {
      headers: { authorization: `Bearer ${sessionToken(database, realmId, adminId)}` },
    })
    expect(activeResponse.status).toBe(200)
    const activeBody = (await activeResponse.json()) as { items: { id: string; state: string }[] }
    expect(activeBody.items.length).toBeGreaterThan(0)
    expect(activeBody.items.every((item) => item.state === "active")).toBe(true)
  })
})
