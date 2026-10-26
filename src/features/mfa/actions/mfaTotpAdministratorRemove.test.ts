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
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import { mfaFactorAvailabilityResolve } from "./mfaFactorAvailabilityResolve.js"
import { mfaTotpAdministratorRemove } from "./mfaTotpAdministratorRemove.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-admin-totp-"))
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

function seedActiveEnrollment(database: StorageDatabase, realmId: string, userId: string, id: string) {
  const now = database.runtime.now()
  const created = mfaRepositoryCreate(database.db).mfaEnrollmentCreate({
    confirmedAt: now,
    createdAt: now,
    encryptedSecret: "test-secret",
    id,
    label: "test",
    realmId,
    status: "active",
    userId,
    version: 1,
  })
  expect(created.success).toBe(true)
}

function seedTotpChallenge(database: StorageDatabase, realmId: string, userId: string, id: string) {
  const now = database.runtime.now()
  const created = mfaRepositoryCreate(database.db).mfaChallengeCreate({
    attempts: 0,
    availableFactors: '["totp"]',
    consumedAt: null,
    createdAt: now,
    expiresAt: now + 300_000,
    factor: "totp",
    id,
    maxAttempts: 5,
    primaryAuthenticationMethod: "password",
    purpose: "login",
    realmId,
    requiredAssurance: "multi_factor",
    tokenHash: mfaChallengeTokenHashCreate(`admin-totp-${id}`),
    userId,
    version: 1,
  })
  expect(created.success).toBe(true)
}

describe("mfa totp administrator remove", () => {
  test("removes every enrollment, hides the totp factor, and consumes totp challenges", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(database, "mfa-admin-totp.example.com", "mfa-admin-totp")
      seedActiveEnrollment(database, realmId, userId, "admin-totp-enrollment")
      seedTotpChallenge(database, realmId, userId, "admin-totp-challenge")
      const before = mfaFactorAvailabilityResolve({
        executor: database.db,
        primaryAuthenticationMethod: "password",
        realmId,
        userId,
      })
      expect(before.success).toBe(true)
      if (!before.success) return
      expect(before.data).toContain("totp")
      const removed = mfaTotpAdministratorRemove({
        actor: authorizationBootstrapAdminActorContextCreate(realmId, "bootstrap-admin"),
        database,
        realmId,
        userId,
      })
      expect(removed.success).toBe(true)
      const enrollments = mfaRepositoryCreate(database.db).mfaEnrollmentList(realmId, userId)
      expect(enrollments.success).toBe(true)
      if (!enrollments.success) return
      expect(enrollments.data.every((enrollment) => enrollment.status === "removed")).toBe(true)
      const after = mfaFactorAvailabilityResolve({
        executor: database.db,
        primaryAuthenticationMethod: "password",
        realmId,
        userId,
      })
      expect(after.success).toBe(true)
      if (!after.success) return
      expect(after.data).not.toContain("totp")
      const challenge = mfaRepositoryCreate(database.db).mfaChallengeGet(realmId, "admin-totp-challenge")
      expect(challenge.success).toBe(true)
      if (!challenge.success) return
      expect(challenge.data?.consumedAt).not.toBeNull()
      const events = database.db
        .select()
        .from(storageEventTable)
        .where(eq(storageEventTable.eventType, "mfa.totp.administrator_removed"))
        .all()
      expect(events).toHaveLength(1)
      expect(events[0]?.payload).toEqual({ enrollmentId: "admin-totp-enrollment", factor: "totp", userId })
    })
  })

  test("reports not-found when no enrollment remains", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(
        database,
        "mfa-admin-totp-empty.example.com",
        "mfa-admin-totp-empty",
      )
      seedActiveEnrollment(database, realmId, userId, "admin-totp-once")
      const actor = authorizationBootstrapAdminActorContextCreate(realmId, "bootstrap-admin")
      expect(mfaTotpAdministratorRemove({ actor, database, realmId, userId }).success).toBe(true)
      const repeated = mfaTotpAdministratorRemove({ actor, database, realmId, userId })
      expect(repeated.success).toBe(false)
      if (repeated.success) return
      expect(repeated.code).toBe("mfa.not-found")
    })
  })

  test("forbids the target user without userManage and denies cross-realm actors", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(
        database,
        "mfa-admin-totp-forbidden.example.com",
        "mfa-admin-totp-forbidden",
      )
      seedActiveEnrollment(database, realmId, userId, "admin-totp-guarded")
      const self = mfaTotpAdministratorRemove({
        actor: authorizationUserActorContextCreate(realmId, userId),
        database,
        realmId,
        userId,
      })
      expect(self.success).toBe(false)
      if (self.success) return
      expect(self.code).toBe("authorization.forbidden")
      const other = await seedRealmUser(database, "mfa-admin-totp-other.example.com", "mfa-admin-totp-other")
      const crossRealm = mfaTotpAdministratorRemove({
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
