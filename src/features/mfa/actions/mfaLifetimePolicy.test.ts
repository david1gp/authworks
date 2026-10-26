import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { organizationLoginPolicyGet } from "../../organizations/actions/organizationLoginPolicyGet.js"
import { organizationLoginPolicySet } from "../../organizations/actions/organizationLoginPolicySet.js"
import { organizationRealmLoginPolicySet } from "../../organizations/actions/organizationRealmLoginPolicySet.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { sessionRotate } from "../../sessions/actions/sessionRotate.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userLifecycleSet } from "../../users/actions/userLifecycleSet.js"
import { mfaPrimaryAuthenticationComplete } from "./mfaPrimaryAuthenticationComplete.js"

type Testkit = ReturnType<typeof platformTestkitCreate>

async function withTestkit<T>(operation: (database: StorageDatabase, testkit: Testkit) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-lifetimes-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function realmSeed(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm.id
}

async function userSeed(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const activated = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(activated.success).toBe(true)
  return created.data.user.id
}

async function organizationSeed(database: StorageDatabase, realmId: string, name: string) {
  const created = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.organization.id
}

function realmPolicySeed(
  database: StorageDatabase,
  realmId: string,
  input: Parameters<typeof organizationRealmLoginPolicySet>[0]["input"],
) {
  const saved = organizationRealmLoginPolicySet({ context: realmSystemContextCreate(), database, input, realmId })
  expect(saved.success).toBe(true)
  if (!saved.success) throw new Error(saved.errorMessage)
}

function primaryComplete(
  database: StorageDatabase,
  testkit: Testkit,
  options: {
    organizationId?: string
    primaryAuthenticationMethod: SessionAuthenticationMethod
    realmId: string
    userId: string
  },
) {
  return storageTransactionRun(database, (executor) =>
    mfaPrimaryAuthenticationComplete({
      executor,
      ...(options.organizationId === undefined ? {} : { organizationId: options.organizationId }),
      policyDatabase: database,
      realmId: options.realmId,
      primaryAuthenticationMethod: options.primaryAuthenticationMethod,
      runtime: testkit.runtime,
      sessionCreate: () => resultCreate({ marker: "session" }),
      userId: options.userId,
    }),
  )
}

describe("mfa lifetime policy", () => {
  test("lets a fresh user finish login inside the init-skip lifetime and forces enrollment after it", async () => {
    await withTestkit(async (database, testkit) => {
      const realmId = await realmSeed(database, "skip.example.com")
      const userId = await userSeed(database, realmId, "skip-user")
      realmPolicySeed(database, realmId, { mfaInitSkipLifetimeSeconds: 3_600, requiredMfa: true })

      const allowed = primaryComplete(database, testkit, {
        primaryAuthenticationMethod: "password",
        realmId,
        userId,
      })
      expect(allowed.success).toBe(true)
      if (!allowed.success) return
      expect(allowed.data.session).toEqual({ marker: "session" })
      expect(allowed.data.challenge).toBeUndefined()

      testkit.advance(2 * 3_600 * 1_000)
      expect(
        primaryComplete(database, testkit, { primaryAuthenticationMethod: "password", realmId, userId }),
      ).toMatchObject({ code: "mfa.enrollment-required", success: false })
    })
  })

  test("requires step-up when the second-factor check is stale and passes when it is fresh", async () => {
    await withTestkit(async (database, testkit) => {
      const realmId = await realmSeed(database, "stale.example.com")
      const userId = await userSeed(database, realmId, "stale-user")
      realmPolicySeed(database, realmId, { requiredMfa: true, secondFactorCheckLifetimeSeconds: 60 })

      const issue = (mfaMethod: "passkey" | "totp") =>
        storageTransactionRun(database, (executor) =>
          sessionIssue({
            actorId: userId,
            assurance: "multi_factor",
            authenticationMethod: "password",
            executor,
            mfaMethod,
            realmId,
            runtime: testkit.runtime,
            userId,
          }),
        )
      const stale = issue("totp")
      expect(stale.success).toBe(true)
      if (!stale.success) return
      testkit.advance(61 * 1_000)
      expect(sessionRotate({ database, realmId, token: stale.data.token })).toMatchObject({
        code: "sessions.assurance-required",
        success: false,
      })

      const fresh = issue("totp")
      expect(fresh.success).toBe(true)
      if (!fresh.success) return
      expect(sessionRotate({ database, realmId, token: fresh.data.token }).success).toBe(true)
    })
  })

  test("treats the multi-factor lifetime independently from the second-factor lifetime", async () => {
    await withTestkit(async (database, testkit) => {
      const realmId = await realmSeed(database, "factors.example.com")
      const userId = await userSeed(database, realmId, "factors-user")
      realmPolicySeed(database, realmId, {
        multiFactorCheckLifetimeSeconds: 60,
        requiredMfa: true,
        secondFactorCheckLifetimeSeconds: 3_600,
      })

      const issue = (mfaMethod: "passkey" | "totp") =>
        storageTransactionRun(database, (executor) =>
          sessionIssue({
            actorId: userId,
            assurance: "multi_factor",
            authenticationMethod: "password",
            executor,
            mfaMethod,
            realmId,
            runtime: testkit.runtime,
            userId,
          }),
        )
      const passkey = issue("passkey")
      const totp = issue("totp")
      expect(passkey.success).toBe(true)
      expect(totp.success).toBe(true)
      if (!passkey.success || !totp.success) return
      testkit.advance(61 * 1_000)
      expect(sessionRotate({ database, realmId, token: passkey.data.token })).toMatchObject({
        code: "sessions.assurance-required",
        success: false,
      })
      expect(sessionRotate({ database, realmId, token: totp.data.token }).success).toBe(true)
    })
  })

  test("exempts external-identity logins from required MFA when forceMfaLocalOnly is set", async () => {
    await withTestkit(async (database, testkit) => {
      const realmId = await realmSeed(database, "localonly.example.com")
      const userId = await userSeed(database, realmId, "localonly-user")
      realmPolicySeed(database, realmId, { forceMfaLocalOnly: true, requiredMfa: true })

      const external = primaryComplete(database, testkit, {
        primaryAuthenticationMethod: "external_identity",
        realmId,
        userId,
      })
      expect(external.success).toBe(true)
      if (!external.success) return
      expect(external.data.session).toEqual({ marker: "session" })
      expect(external.data.challenge).toBeUndefined()

      expect(
        primaryComplete(database, testkit, { primaryAuthenticationMethod: "password", realmId, userId }),
      ).toMatchObject({ code: "mfa.enrollment-required", success: false })
    })
  })

  test("lets an organization override beat the realm for MFA lifetimes and local-only enforcement", async () => {
    await withTestkit(async (database, testkit) => {
      const realmId = await realmSeed(database, "override.example.com")
      const userId = await userSeed(database, realmId, "override-user")
      const organizationId = await organizationSeed(database, realmId, "Override Org")
      realmPolicySeed(database, realmId, { requiredMfa: false, secondFactorCheckLifetimeSeconds: 3_600 })
      const saved = organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { requiredMfa: true, secondFactorCheckLifetimeSeconds: 60 },
        organizationId,
        realmId,
      })
      expect(saved.success).toBe(true)
      if (!saved.success) return
      expect(saved.data.policy.requiredMfa).toBe(true)
      expect(saved.data.policy.secondFactorCheckLifetimeSeconds).toBe(60)
      const resolved = organizationLoginPolicyGet({ database, organizationId, realmId })
      expect(resolved).toMatchObject({
        data: { policy: { requiredMfa: true, secondFactorCheckLifetimeSeconds: 60 } },
        success: true,
      })

      expect(
        primaryComplete(database, testkit, {
          organizationId,
          primaryAuthenticationMethod: "password",
          realmId,
          userId,
        }),
      ).toMatchObject({ code: "mfa.enrollment-required", success: false })
      const realmLogin = primaryComplete(database, testkit, {
        primaryAuthenticationMethod: "password",
        realmId,
        userId,
      })
      expect(realmLogin.success).toBe(true)
      if (!realmLogin.success) return
      expect(realmLogin.data.session).toEqual({ marker: "session" })
    })
  })
})
