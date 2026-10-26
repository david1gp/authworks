import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { mfaPolicySet } from "./mfaPolicySet.js"
import { mfaLoginChallengeStart } from "./mfaLoginChallengeStart.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-mode-"))
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

async function seedRealmUser(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate()
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const created = userCreate({
    context: system,
    database,
    input: { email: `mfa-mode@${domain}`, profile: { displayName: "Mfa Mode" }, userName: `mfa-mode-${Date.now()}` },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const userId = created.data.user.id
  const activated = userLifecycleSet({ context: system, database, input: { state: "active" }, realmId, userId })
  expect(activated.success).toBe(true)
  return { realmId, userId }
}

function policySet(database: StorageDatabase, realmId: string, mode: "disabled" | "optional" | "required") {
  const policy = mfaPolicySet({
    context: realmSystemContextCreate(),
    database,
    input: { lockoutDurationMs: 60_000, maxAttempts: 5, mode, totpWindow: 1 },
    realmId,
  })
  expect(policy.success).toBe(true)
  if (!policy.success) throw new Error(policy.errorMessage)
}

describe("mfaLoginChallengeStart legacy mode", () => {
  test("refuses challenge start while the realm policy is disabled", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(database, "mfa-mode-disabled.example.com")
      policySet(database, realmId, "disabled")
      const refused = mfaLoginChallengeStart({
        database,
        primaryAuthenticationMethod: "password",
        purpose: "login",
        realmId,
        runtimeAvailableFactors: ["totp"],
        userId,
      })
      expect(refused.success).toBe(false)
      if (refused.success) return
      expect(refused.code).toBe("mfa.factor-disabled")
    })
  })

  test("starts a challenge in optional mode only with an enrolled factor", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(database, "mfa-mode-optional.example.com")
      policySet(database, realmId, "optional")
      const unenrolled = mfaLoginChallengeStart({
        database,
        primaryAuthenticationMethod: "password",
        purpose: "login",
        realmId,
        userId,
      })
      expect(unenrolled.success).toBe(false)
      if (unenrolled.success) return
      expect(unenrolled.code).toBe("mfa.enrollment-required")
      const enrolled = mfaLoginChallengeStart({
        database,
        primaryAuthenticationMethod: "password",
        purpose: "login",
        realmId,
        runtimeAvailableFactors: ["totp"],
        userId,
      })
      expect(enrolled.success).toBe(true)
      if (!enrolled.success) return
      expect(enrolled.data.challenge.factor).toBe("totp")
    })
  })

  test("keeps required mode on the current challenge behavior", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(database, "mfa-mode-required.example.com")
      policySet(database, realmId, "required")
      const unenrolled = mfaLoginChallengeStart({
        database,
        primaryAuthenticationMethod: "password",
        purpose: "login",
        realmId,
        userId,
      })
      expect(unenrolled.success).toBe(false)
      if (unenrolled.success) return
      expect(unenrolled.code).toBe("mfa.enrollment-required")
      const enrolled = mfaLoginChallengeStart({
        database,
        primaryAuthenticationMethod: "password",
        purpose: "login",
        realmId,
        runtimeAvailableFactors: ["totp"],
        userId,
      })
      expect(enrolled.success).toBe(true)
    })
  })

  test("rejects dashed legacy factor spellings instead of dropping them", async () => {
    await withDatabase(async (database) => {
      const { realmId, userId } = await seedRealmUser(database, "mfa-mode-dashed.example.com")
      policySet(database, realmId, "required")
      const dashed = mfaLoginChallengeStart({
        database,
        primaryAuthenticationMethod: "password",
        purpose: "login",
        realmId,
        runtimeAvailableFactors: ["email-otp" as unknown as "totp"],
        userId,
      })
      expect(dashed.success).toBe(false)
      if (dashed.success) return
      expect(dashed.code).toBe("mfa.invalid")
    })
  })
})
