import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmAdministratorList } from "../../src/features/realms/actions/realmAdministratorList.js"
import { realmAdministratorRevoke } from "../../src/features/realms/actions/realmAdministratorRevoke.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmAdministratorTable } from "../../src/features/realms/persistence/realmAdministratorTable.js"
import { realmAdministratorIs } from "../../src/features/realms/server/realmAdministratorIs.js"
import { realmServerAppCreate } from "../../src/features/realms/server/realmServerAppCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userDelete } from "../../src/features/users/actions/userDelete.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDataMigrationTable } from "../../src/platform/storage/storageDataMigrationTable.js"
import { storageSchemaCreate } from "../../src/platform/storage/storageSchemaCreate.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const MARKER = "realm_administrators_backfill_v1"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-realm-administrators-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function createUser(database: StorageDatabase, realmId: string, userName: string, email: string) {
  return userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email, profile: { displayName: userName }, userName },
    realmId,
  })
}

function activateUser(database: StorageDatabase, realmId: string, userId: string) {
  return userLifecycleSet({
    context: realmSystemContextCreate("system"),
    database,
    input: { state: "active" },
    realmId,
    userId,
  })
}

test("backfill promotes the oldest active organization owners exactly once", async () => {
  await withDatabase(async (database, testkit) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({ context: system, database, input: { domain: "admins.example.com", name: "Admins" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const first = createUser(database, realmId, "owner-one", "owner-one@example.com")
    const second = createUser(database, realmId, "owner-two", "owner-two@example.com")
    const guest = createUser(database, realmId, "guest-one", "guest-one@example.com")
    expect(first.success && second.success && guest.success).toBe(true)
    if (!first.success || !second.success || !guest.success) return
    expect(activateUser(database, realmId, first.data.user.id).success).toBe(true)
    expect(activateUser(database, realmId, second.data.user.id).success).toBe(true)
    const firstOrg = organizationCreate({ context: system, database, input: { name: "first-org" }, realmId })
    expect(firstOrg.success).toBe(true)
    if (!firstOrg.success) return
    testkit.advance(1_000)
    const secondOrg = organizationCreate({ context: system, database, input: { name: "second-org" }, realmId })
    expect(secondOrg.success).toBe(true)
    if (!secondOrg.success) return
    expect(
      organizationMembershipCreate({
        context: system,
        database,
        input: { roles: ["owner"], userId: first.data.user.id },
        organizationId: firstOrg.data.organization.id,
        realmId,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipCreate({
        context: system,
        database,
        input: { roles: ["owner"], userId: second.data.user.id },
        organizationId: secondOrg.data.organization.id,
        realmId,
      }).success,
    ).toBe(true)
    expect(
      organizationMembershipCreate({
        context: system,
        database,
        input: { roles: ["guest"], userId: guest.data.user.id },
        organizationId: firstOrg.data.organization.id,
        realmId,
      }).success,
    ).toBe(true)

    expect(realmAdministratorIsValue(realmAdministratorIs({ database, realmId, userId: first.data.user.id }))).toBe(
      false,
    )
    // Simulate the upgrade path: the marker was written at open, so clear it
    // (and any relic rows) before re-running the schema, like an old database
    // would the first time it sees the new DDL.
    database.db.delete(realmAdministratorTable).run()
    database.db.delete(storageDataMigrationTable).where(eq(storageDataMigrationTable.name, MARKER)).run()
    storageDatabaseOpenReapply(database)
    const listed = realmAdministratorList({ context: system, database, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.map((item) => item.userId)).toEqual([first.data.user.id])
    expect(listed.data.items[0]?.user.userName).toBe("owner-one")
    expect(realmAdministratorIsValue(realmAdministratorIs({ database, realmId, userId: first.data.user.id }))).toBe(
      true,
    )

    // Revoking the only administrator is protected; grant the second owner first.
    const grantedExtra = realmAdministratorGrant({ context: system, database, realmId, userId: second.data.user.id })
    expect(grantedExtra.success).toBe(true)

    const revoked = realmAdministratorRevoke({
      context: system,
      database,
      realmId,
      userId: first.data.user.id,
    })
    expect(revoked.success).toBe(true)
    expect(realmAdministratorIsValue(realmAdministratorIs({ database, realmId, userId: first.data.user.id }))).toBe(
      false,
    )

    storageDatabaseOpenReapply(database)
    // The second administrator keeps its row; the revoked first row must not
    // come back because the marker was already written before the revoke.
    expect(realmAdministratorIsValue(realmAdministratorIs({ database, realmId, userId: first.data.user.id }))).toBe(
      false,
    )
    expect(realmAdministratorIsValue(realmAdministratorIs({ database, realmId, userId: second.data.user.id }))).toBe(
      true,
    )
  })
})

test("grant, list, duplicate, revoke, last-administrator, deleted-user, and not-found behaviors", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({ context: system, database, input: { domain: "grant.example.com", name: "Grant" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const first = createUser(database, realmId, "admin-one", "admin-one@example.com")
    const second = createUser(database, realmId, "admin-two", "admin-two@example.com")
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(activateUser(database, realmId, first.data.user.id).success).toBe(true)
    expect(activateUser(database, realmId, second.data.user.id).success).toBe(true)

    const granted = realmAdministratorGrant({ context: system, database, realmId, userId: first.data.user.id })
    expect(granted.success).toBe(true)
    if (!granted.success) return
    expect(granted.data.administrator.userId).toBe(first.data.user.id)
    expect(granted.data.administrator.user.userName).toBe("admin-one")

    const duplicate = realmAdministratorGrant({ context: system, database, realmId, userId: first.data.user.id })
    expect(duplicate).toMatchObject({ code: "realms.administrator-exists", success: false })

    const grantedSecond = realmAdministratorGrant({ context: system, database, realmId, userId: second.data.user.id })
    expect(grantedSecond.success).toBe(true)

    const listed = realmAdministratorList({ context: system, database, realmId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.map((item) => item.userId).sort()).toEqual(
      [first.data.user.id, second.data.user.id].sort(),
    )

    expect(realmAdministratorRevoke({ context: system, database, realmId, userId: first.data.user.id }).success).toBe(
      true,
    )
    expect(realmAdministratorRevoke({ context: system, database, realmId, userId: second.data.user.id })).toMatchObject(
      { code: "realms.administrator-last", success: false },
    )
    expect(realmAdministratorRevoke({ context: system, database, realmId, userId: "missing-user" })).toMatchObject({
      code: "realms.administrator-not-found",
      success: false,
    })

    const deleted = await userDelete({ context: system, database, realmId, userId: second.data.user.id })
    expect(deleted.success).toBe(true)
    expect(realmAdministratorGrant({ context: system, database, realmId, userId: second.data.user.id })).toMatchObject({
      code: "realms.not-found",
      success: false,
    })
  })
})

test("system routes manage administrators and tenant routes require authorization", async () => {
  await withDatabase(async (database) => {
    const system = realmSystemContextCreate("system")
    const realm = realmCreate({ context: system, database, input: { domain: "routes.example.com", name: "Routes" } })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const user = createUser(database, realmId, "route-admin", "route-admin@example.com")
    expect(user.success).toBe(true)
    if (!user.success) return
    expect(activateUser(database, realmId, user.data.user.id).success).toBe(true)

    const app = realmServerAppCreate({ database, systemSecret: "system-secret" })
    const unauthorized = await app.request(`http://server.test/system/realms/${realmId}/administrators`, {
      headers: { host: "server.test" },
    })
    expect(unauthorized.status).toBe(401)

    const client = realmApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const initialList = await client.realmAdministratorList(realmId)
    expect(initialList.success ? initialList.data.items : undefined).toEqual([])
    const granted = await client.realmAdministratorGrant(realmId, { userId: user.data.user.id })
    expect(granted.success).toBe(true)
    const listed = await client.realmAdministratorList(realmId)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.map((item) => item.userId)).toEqual([user.data.user.id])
    expect(listed.data.items[0]?.user.email).toBe("route-admin@example.com")
    const duplicate = await client.realmAdministratorGrant(realmId, { userId: user.data.user.id })
    expect(duplicate.success).toBe(false)
    const anonymous = await app.request(`http://server.test/realms/${realmId}/administrators`, {
      headers: { host: "routes.example.com" },
    })
    expect(anonymous.status).toBe(401)
    const lastRevoke = await client.realmAdministratorRevoke(realmId, user.data.user.id)
    expect(lastRevoke.success).toBe(false)
  })
})

function realmAdministratorIsValue(result: { readonly success: boolean; readonly data?: boolean }): boolean {
  return result.success ? (result.data ?? false) : false
}

function storageDatabaseOpenReapply(database: StorageDatabase): void {
  const created = storageSchemaCreate(database.db)
  expect(created.success).toBe(true)
}
