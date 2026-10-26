import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passwordEmailVerify } from "./passwordEmailVerify.js"
import { passwordLogin } from "./passwordLogin.js"
import { passwordRecoveryComplete } from "./passwordRecoveryComplete.js"
import { passwordRecoveryRequest } from "./passwordRecoveryRequest.js"
import { passwordRegister } from "./passwordRegister.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-password-login-rate-limit-"))
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

async function verifiedUserSeed(database: StorageDatabase, domain: string, email: string, userName: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const context = realmTenantContextCreate(realmId, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: { email, password: "Correct Horse 12", profile: { displayName: userName }, userName },
    realmId,
    onVerificationToken: ({ token }) => {
      verificationToken = token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId })
  expect(verified.success).toBe(true)
  return { context, realmId }
}

test("password login bursts are rate limited with retry guidance while threshold traffic passes", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId } = await verifiedUserSeed(database, "login-limit.example.com", "ada@example.com", "ada")
    const attempt = () =>
      passwordLogin({
        clientIp: "192.0.2.10",
        context,
        database,
        input: { identifier: "ada", password: "Correct Horse 12" },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      })
    for (let index = 0; index < 20; index += 1) expect(attempt().success).toBe(true)
    const limited = attempt()
    expect(limited.success).toBe(false)
    if (limited.success) return
    expect(limited.code).toBe("passwords.rate-limited")
    const details = JSON.parse(limited.errorData ?? "{}") as { retryAfterSeconds?: unknown }
    expect(details.retryAfterSeconds).toBe(60)
    testkit.advance(61 * 1_000)
    expect(attempt().success).toBe(true)
  })
})

test("password recovery requests stop delivering tokens when limited and completion bursts are rejected", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId } = await verifiedUserSeed(
      database,
      "recovery-limit.example.com",
      "grace@example.com",
      "grace",
    )
    const tokens: string[] = []
    const request = () =>
      passwordRecoveryRequest({
        clientIp: "192.0.2.20",
        context,
        database,
        input: { email: "grace@example.com" },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
        onRecoveryToken: (delivery) => {
          tokens.push(delivery.token)
        },
      })
    for (let index = 0; index < 6; index += 1) {
      const requested = request()
      expect(requested).toEqual({ data: { accepted: true }, success: true })
    }
    expect(tokens).toHaveLength(5)
    const complete = (token: string) =>
      passwordRecoveryComplete({
        clientIp: "192.0.2.30",
        context,
        database,
        input: { newPassword: "Correct Horse 34", token },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      })
    for (let index = 0; index < 5; index += 1) {
      const completed = complete("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
      expect(completed).toMatchObject({ code: "passwords.invalid", success: false })
    }
    expect(complete("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toMatchObject({
      code: "passwords.rate-limited",
      success: false,
    })
  })
})
