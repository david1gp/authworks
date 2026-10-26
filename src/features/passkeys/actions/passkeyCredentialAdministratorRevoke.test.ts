import { describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { authorizationBootstrapAdminActorContextCreate } from "../../authorization/domain/authorizationBootstrapAdminActorContextCreate.js"
import { authorizationUserActorContextCreate } from "../../authorization/domain/authorizationUserActorContextCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import { passkeyUserFactorAvailable } from "../server/passkeyUserFactorAvailable.js"
import { passkeyCredentialAdministratorRevoke } from "./passkeyCredentialAdministratorRevoke.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-passkey-admin-"))
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

async function seedRealmUser(database: StorageDatabase, domain: string, userName: string) {
  const system = realmSystemContextCreate()
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const created = userCreate({
    context: system,
    database,
    input: { email: `${userName}@${domain}`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const userId = created.data.user.id
  const activated = userLifecycleSet({ context: system, database, input: { state: "active" }, realmId, userId })
  expect(activated.success).toBe(true)
  return { realmId, userId }
}

function seedCredential(database: StorageDatabase, realmId: string, userId: string, id: string) {
  const created = passkeyRepositoryCreate(database.db).passkeyCredentialCreate({
    aaguid: "00000000-0000-0000-0000-000000000000",
    backedUp: 0,
    counter: 0,
    createdAt: database.runtime.now(),
    credentialId: `${id}-webauthn`,
    deviceType: "singleDevice",
    id,
    lastUsedAt: null,
    nickname: null,
    publicKey: Buffer.from([1, 2, 3]),
    realmId,
    revokedAt: null,
    rpId: "passkey-admin.example.com",
    transports: "[]",
    userId,
    version: 1,
  })
  expect(created.success).toBe(true)
}

describe("passkey credential administrator revoke", () => {
  test("revokes the credential so the passkey factor becomes unavailable", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(database, "passkey-admin.example.com", "passkey-admin")
      seedCredential(database, realmId, userId, "admin-revoke-row")
      const availableBefore = passkeyUserFactorAvailable({ executor: database.db, realmId, userId })
      expect(availableBefore.success).toBe(true)
      if (!availableBefore.success) return
      expect(availableBefore.data).toBe(true)
      const revoked = passkeyCredentialAdministratorRevoke({
        actor: authorizationBootstrapAdminActorContextCreate(realmId, "bootstrap-admin"),
        credentialId: "admin-revoke-row",
        database,
        realmId,
        userId,
      })
      expect(revoked.success).toBe(true)
      if (!revoked.success) return
      expect(revoked.data.credential.revokedAt).not.toBeNull()
      const availableAfter = passkeyUserFactorAvailable({ executor: database.db, realmId, userId })
      expect(availableAfter.success).toBe(true)
      if (!availableAfter.success) return
      expect(availableAfter.data).toBe(false)
      const events = database.db
        .select()
        .from(storageEventTable)
        .where(eq(storageEventTable.eventType, "passkey.credential_administrator_revoked"))
        .all()
      expect(events).toHaveLength(1)
      expect(events[0]?.payload).toEqual({ credentialId: "admin-revoke-row", userId })
    })
  })

  test("rejects an already-revoked credential like self-service revocation", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(
        database,
        "passkey-admin-repeat.example.com",
        "passkey-admin-repeat",
      )
      seedCredential(database, realmId, userId, "admin-revoke-once")
      const actor = authorizationBootstrapAdminActorContextCreate(realmId, "bootstrap-admin")
      const first = passkeyCredentialAdministratorRevoke({
        actor,
        credentialId: "admin-revoke-once",
        database,
        realmId,
        userId,
      })
      expect(first.success).toBe(true)
      const repeated = passkeyCredentialAdministratorRevoke({
        actor,
        credentialId: "admin-revoke-once",
        database,
        realmId,
        userId,
      })
      expect(repeated.success).toBe(false)
      if (repeated.success) return
      expect(repeated.code).toBe("passkeys.invalid")
    })
  })

  test("forbids the target user without userManage and denies cross-realm actors", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(
        database,
        "passkey-admin-forbidden.example.com",
        "passkey-admin-forbidden",
      )
      seedCredential(database, realmId, userId, "admin-revoke-guarded")
      const self = passkeyCredentialAdministratorRevoke({
        actor: authorizationUserActorContextCreate(realmId, userId),
        credentialId: "admin-revoke-guarded",
        database,
        realmId,
        userId,
      })
      expect(self.success).toBe(false)
      if (self.success) return
      expect(self.code).toBe("authorization.forbidden")
      const other = await seedRealmUser(database, "passkey-admin-other.example.com", "passkey-admin-other")
      const crossRealm = passkeyCredentialAdministratorRevoke({
        actor: authorizationBootstrapAdminActorContextCreate(other.realmId, "bootstrap-admin"),
        credentialId: "admin-revoke-guarded",
        database,
        realmId,
        userId,
      })
      expect(crossRealm.success).toBe(false)
      if (crossRealm.success) return
      expect(crossRealm.code).toBe("authorization.tenant-mismatch")
    })
  })
})
