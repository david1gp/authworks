import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import {
  mfaPendingEnrollmentExpiryMs,
  mfaUserAuthenticationMethodsRead,
} from "../server/mfaUserAuthenticationMethodsRead.js"
import { mfaTotpEnrollmentConfirm } from "./mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentRemove } from "./mfaTotpEnrollmentRemove.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-pending-expiry-"))
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

async function seedActiveRealmUser(database: StorageDatabase, domain: string, userName: string) {
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

function seedPendingEnrollment(
  database: StorageDatabase,
  realmId: string,
  userId: string,
  id: string,
  createdAt: number,
) {
  const created = mfaRepositoryCreate(database.db).mfaEnrollmentCreate({
    confirmedAt: null,
    createdAt,
    encryptedSecret: "test-secret",
    id,
    label: "Authenticator app",
    lastUsedStep: null,
    realmId,
    status: "pending",
    userId,
    version: 1,
  })
  expect(created.success).toBe(true)
}

describe("mfa pending enrollment expiry", () => {
  test("verification-pending setups disappear from the account surface after one hour", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedActiveRealmUser(
        database,
        "mfa-pending-expiry.example.com",
        "mfa-pending-expiry",
      )
      const now = database.runtime.now()
      seedPendingEnrollment(database, realmId, userId, "pending-expired", now - mfaPendingEnrollmentExpiryMs - 1_000)
      seedPendingEnrollment(database, realmId, userId, "pending-fresh", now - 1_000)
      const methods = mfaUserAuthenticationMethodsRead({ executor: database.db, now, realmId, userId })
      expect(methods.success).toBe(true)
      if (!methods.success) return
      expect(methods.data.enrollments.map((enrollment) => enrollment.id)).toEqual(["pending-fresh"])
    })
  })

  test("an expired verification-pending setup can no longer be confirmed", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedActiveRealmUser(
        database,
        "mfa-pending-confirm.example.com",
        "mfa-pending-confirm",
      )
      const now = database.runtime.now()
      seedPendingEnrollment(database, realmId, userId, "pending-stale", now - mfaPendingEnrollmentExpiryMs - 1_000)
      const confirmed = mfaTotpEnrollmentConfirm({
        database,
        input: { code: "123456", enrollmentId: "pending-stale" },
        realmId,
        runtime: { now: () => now, randomBytes: database.runtime.randomBytes },
        userId,
      })
      expect(confirmed.success).toBe(false)
      if (confirmed.success) return
      expect(confirmed.code).toBe("mfa.not-found")
    })
  })

  test("a verification-pending setup can be discarded without step-up, active ones still require it", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedActiveRealmUser(
        database,
        "mfa-pending-remove.example.com",
        "mfa-pending-remove",
      )
      const now = database.runtime.now()
      seedPendingEnrollment(database, realmId, userId, "pending-removable", now - 1_000)
      const active = mfaRepositoryCreate(database.db).mfaEnrollmentCreate({
        confirmedAt: now,
        createdAt: now,
        encryptedSecret: "test-secret",
        id: "active-kept",
        label: "Authenticator app",
        lastUsedStep: null,
        realmId,
        status: "active",
        userId,
        version: 1,
      })
      expect(active.success).toBe(true)
      const session = sessionIssue({
        actorId: userId,
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        realmId,
        userId,
      })
      expect(session.success).toBe(true)
      if (!session.success) throw new Error(session.errorMessage)
      const pendingRemoved = mfaTotpEnrollmentRemove({
        database,
        enrollmentId: "pending-removable",
        realmId,
        sessionToken: session.data.token,
        userId,
      })
      expect(pendingRemoved.success).toBe(true)
      const activeRemoved = mfaTotpEnrollmentRemove({
        database,
        enrollmentId: "active-kept",
        realmId,
        sessionToken: session.data.token,
        userId,
      })
      expect(activeRemoved.success).toBe(false)
      if (activeRemoved.success) return
      expect(activeRemoved.code).toBe("mfa.unauthorized")
    })
  })
})
