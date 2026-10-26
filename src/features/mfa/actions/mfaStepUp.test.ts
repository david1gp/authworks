import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userEmailVerificationSet } from "../../users/actions/userEmailVerificationSet.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { passkeyRepositoryCreate } from "../../passkeys/persistence/passkeyRepositoryCreate.js"
import type { MfaEmailOtpDelivery } from "../public/mfaEmailOtpDeliverySchema.js"
import { mfaEmailOtpStart } from "./mfaEmailOtpStart.js"
import { mfaLoginChallengeStart } from "./mfaLoginChallengeStart.js"
import { mfaPasskeyComplete } from "./mfaPasskeyComplete.js"
import { mfaPolicySet } from "./mfaPolicySet.js"
import { mfaStepUpComplete } from "./mfaStepUpComplete.js"
import { mfaStepUpStart } from "./mfaStepUpStart.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-step-up-"))
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

async function seedVerifiedRealmUser(database: StorageDatabase, domain: string, userName: string) {
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
  const verified = userEmailVerificationSet({
    context: system,
    database,
    input: { state: "verified" },
    realmId,
    userId,
  })
  expect(verified.success).toBe(true)
  const policy = mfaPolicySet({
    context: system,
    database,
    input: { lockoutDurationMs: 60_000, maxAttempts: 5, mode: "required", totpWindow: 1 },
    realmId,
  })
  expect(policy.success).toBe(true)
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
  return { realmId, session: session.data, userId }
}

describe("mfa step-up ceremonies", () => {
  test("completes an email-otp step-up through the unified challenge path", async () => {
    await withDatabase(async (database) => {
      const { realmId, session, userId } = await seedVerifiedRealmUser(
        database,
        "mfa-step-up-email.example.com",
        "mfa-step-up-email",
      )
      const started = mfaStepUpStart({ database, realmId, sessionId: session.session.id, userId })
      expect(started.success).toBe(true)
      if (!started.success) return
      expect(started.data.challenge.purpose).toBe("step_up")
      let delivery: MfaEmailOtpDelivery | undefined
      const otp = mfaEmailOtpStart({
        challengeToken: started.data.token,
        database,
        onDelivery: (sent) => {
          delivery = sent
        },
        realmId,
      })
      expect(otp.success).toBe(true)
      if (!otp.success) return
      expect(delivery).toBeDefined()
      if (delivery === undefined) return
      const completed = mfaStepUpComplete({
        database,
        input: { code: delivery.code, token: started.data.token },
        realmId,
        sessionToken: session.token,
      })
      expect(completed.success).toBe(true)
      if (!completed.success) return
      expect(completed.data.authentication.userId).toBe(userId)
      expect(completed.data.session?.session.assurance).toBe("multi_factor")
    })
  })

  test("completes a passkey step-up through the unified challenge path", async () => {
    await withDatabase(async (database) => {
      const { realmId, session, userId } = await seedVerifiedRealmUser(
        database,
        "mfa-step-up-passkey.example.com",
        "mfa-step-up-passkey",
      )
      const seeded = storageTransactionRun(database, (transaction) => {
        const created = passkeyRepositoryCreate(transaction).passkeyCredentialCreate({
          aaguid: "00000000-0000-0000-0000-000000000000",
          backedUp: 0,
          counter: 0,
          createdAt: database.runtime.now(),
          credentialId: "step-up-credential",
          deviceType: "singleDevice",
          id: "step-up-credential-row",
          lastUsedAt: null,
          nickname: null,
          publicKey: Buffer.from([1, 2, 3]),
          realmId,
          revokedAt: null,
          rpId: "mfa-step-up-passkey.example.com",
          transports: "[]",
          userId,
          version: 1,
        })
        if (!created.success) return created
        return { data: created.data, success: true as const }
      })
      expect(seeded.success).toBe(true)
      const started = mfaLoginChallengeStart({
        database,
        factor: "passkey",
        policyDatabase: database,
        purpose: "step_up",
        realmId,
        sessionId: session.session.id,
        userId,
      })
      expect(started.success).toBe(true)
      if (!started.success) return
      expect(started.data.challenge.factor).toBe("passkey")
      expect(started.data.challenge.purpose).toBe("step_up")
      const completed = storageTransactionRun(database, (transaction) =>
        mfaPasskeyComplete({
          challengeId: started.data.challenge.id,
          database: transaction,
          policyDatabase: database,
          realmId,
          runtime: database.runtime,
          userId,
        }),
      )
      expect(completed.success).toBe(true)
      if (!completed.success) return
      expect(completed.data.authentication.userId).toBe(userId)
    })
  })
})
