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
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import { mfaRecoveryCodesAdministratorInvalidate } from "./mfaRecoveryCodesAdministratorInvalidate.js"
import { mfaRecoveryCodesGenerate } from "./mfaRecoveryCodesGenerate.js"
import { mfaRecoveryCodeVerify } from "./mfaRecoveryCodeVerify.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-admin-recovery-"))
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
  const now = database.runtime.now()
  const enrollment = mfaRepositoryCreate(database.db).mfaEnrollmentCreate({
    confirmedAt: now,
    createdAt: now,
    encryptedSecret: "test-secret",
    id: `recovery-enrollment-${userName}`,
    label: "test",
    realmId,
    status: "active",
    userId,
    version: 1,
  })
  expect(enrollment.success).toBe(true)
  return { realmId, userId }
}

describe("mfa recovery codes administrator invalidate", () => {
  test("invalidates every remaining code so old codes are rejected", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(database, "mfa-admin-recovery.example.com", "mfa-admin-recovery")
      const generated = mfaRecoveryCodesGenerate({ database, realmId, userId })
      expect(generated.success).toBe(true)
      if (!generated.success) return
      const invalidated = mfaRecoveryCodesAdministratorInvalidate({
        actor: authorizationBootstrapAdminActorContextCreate(realmId, "bootstrap-admin"),
        database,
        realmId,
        userId,
      })
      expect(invalidated.success).toBe(true)
      if (!invalidated.success) return
      expect(invalidated.data).toEqual({ invalidated: true, invalidatedCount: 10 })
      const rejected = mfaRecoveryCodeVerify({ code: generated.data.codes[0]!, database, realmId, userId })
      expect(rejected.success).toBe(false)
      if (rejected.success) return
      expect(rejected.code).toBe("mfa.not-found")
      const events = database.db
        .select()
        .from(storageEventTable)
        .where(eq(storageEventTable.eventType, "mfa.recovery_codes.invalidated"))
        .all()
      expect(events).toHaveLength(1)
      expect(events[0]?.payload).toEqual({ codeCount: 10, userId })
      expect(JSON.stringify(events[0]?.payload)).not.toContain(generated.data.codes[0])
    })
  })

  test("reports not-found when no code remains", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(
        database,
        "mfa-admin-recovery-empty.example.com",
        "mfa-admin-recovery-empty",
      )
      const generated = mfaRecoveryCodesGenerate({ database, realmId, userId })
      expect(generated.success).toBe(true)
      const actor = authorizationBootstrapAdminActorContextCreate(realmId, "bootstrap-admin")
      expect(mfaRecoveryCodesAdministratorInvalidate({ actor, database, realmId, userId }).success).toBe(true)
      const repeated = mfaRecoveryCodesAdministratorInvalidate({ actor, database, realmId, userId })
      expect(repeated.success).toBe(false)
      if (repeated.success) return
      expect(repeated.code).toBe("mfa.not-found")
    })
  })

  test("forbids the target user without userManage and denies cross-realm actors", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(
        database,
        "mfa-admin-recovery-forbidden.example.com",
        "mfa-admin-recovery-forbidden",
      )
      expect(mfaRecoveryCodesGenerate({ database, realmId, userId }).success).toBe(true)
      const self = mfaRecoveryCodesAdministratorInvalidate({
        actor: authorizationUserActorContextCreate(realmId, userId),
        database,
        realmId,
        userId,
      })
      expect(self.success).toBe(false)
      if (self.success) return
      expect(self.code).toBe("authorization.forbidden")
      const other = await seedRealmUser(database, "mfa-admin-recovery-other.example.com", "mfa-admin-recovery-other")
      const crossRealm = mfaRecoveryCodesAdministratorInvalidate({
        actor: authorizationBootstrapAdminActorContextCreate(other.realmId, "bootstrap-admin"),
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
