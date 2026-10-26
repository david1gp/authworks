import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passwordEmailVerify } from "../../passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../passwords/actions/passwordRegister.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { emailOtpStart } from "./emailOtpStart.js"
import { emailOtpVerify } from "./emailOtpVerify.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-email-otp-limit-"))
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
  if (!verified.success) throw new Error(verified.errorMessage)
  return { context, realmId, userId: verified.data.user.id }
}

function wrongCodeFor(code: string): string {
  return code === "000000" ? "111111" : "000000"
}

function otpLockoutRowGet(database: StorageDatabase, userId: string) {
  return database.sqlite
    .query("SELECT failed_attempts AS failedAttempts, locked_until AS lockedUntil FROM otp_lockouts WHERE user_id = ?")
    .get(userId) as { failedAttempts: number; lockedUntil: number | null } | undefined
}

function userStateGet(database: StorageDatabase, userId: string) {
  const row = database.sqlite.query("SELECT state FROM users WHERE id = ?").get(userId) as { state: string }
  return row.state
}

function passwordLockoutRowGet(database: StorageDatabase, userId: string) {
  return database.sqlite
    .query("SELECT failed_attempts AS failedAttempts FROM password_lockouts WHERE user_id = ?")
    .get(userId) as { failedAttempts: number } | undefined
}

test("email OTP start bursts are rate limited with retry guidance", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId } = await verifiedUserSeed(database, "email-start-limit.example.com", "a@example.com", "a")
    const start = () =>
      emailOtpStart({
        clientIp: "192.0.2.40",
        context,
        database,
        input: { email: "a@example.com" },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      })
    for (let index = 0; index < 5; index += 1) expect(start().success).toBe(true)
    const limited = start()
    expect(limited.success).toBe(false)
    if (limited.success) return
    expect(limited.code).toBe("email-otp.rate-limited")
    expect(JSON.parse(limited.errorData ?? "{}")).toMatchObject({ retryAfterSeconds: 60 })
  })
})

test("email OTP failures lock the account, expiry unlocks, and password failures are not double counted", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId, userId } = await verifiedUserSeed(
      database,
      "email-lockout.example.com",
      "b@example.com",
      "b",
    )
    let delivery: { challengeId: string; code: string } | undefined
    const started = emailOtpStart({
      clientIp: "192.0.2.41",
      context,
      database,
      input: { email: "b@example.com" },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const wrong = wrongCodeFor(delivery.code)
    for (let index = 0; index < 5; index += 1) {
      const verified = emailOtpVerify({
        clientIp: "192.0.2.41",
        context,
        database,
        input: { challengeId: delivery.challengeId, code: wrong },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      })
      expect(verified).toMatchObject({ code: "email-otp.invalid", success: false })
    }
    expect(userStateGet(database, userId)).toBe("locked")
    expect(otpLockoutRowGet(database, userId)).toMatchObject({ failedAttempts: 5 })
    expect(passwordLockoutRowGet(database, userId)).toBeNull()
    const passwordWhileLocked = passwordLogin({
      context,
      database,
      input: { identifier: "b@example.com", password: "Correct Horse 12" },
      realmId,
      runtime: testkit.runtime,
    })
    expect(passwordWhileLocked).toMatchObject({ code: "passwords.unauthorized", success: false })
    expect(passwordLockoutRowGet(database, userId)).toBeNull()
    testkit.advance(61 * 1_000)
    let lockedDelivery: { challengeId: string; code: string } | undefined
    const lockedStart = emailOtpStart({
      clientIp: "192.0.2.42",
      context,
      database,
      input: { email: "b@example.com" },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
      onDelivery: (value) => {
        lockedDelivery = { challengeId: value.challengeId, code: value.code }
      },
    })
    expect(lockedStart.success).toBe(true)
    if (!lockedStart.success || lockedDelivery === undefined) return
    expect(
      emailOtpVerify({
        clientIp: "192.0.2.42",
        context,
        database,
        input: { challengeId: lockedDelivery.challengeId, code: lockedDelivery.code },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      }),
    ).toMatchObject({ code: "email-otp.invalid", success: false })
    testkit.advance(15 * 60 * 1_000)
    let freshDelivery: { challengeId: string; code: string } | undefined
    const freshStart = emailOtpStart({
      clientIp: "192.0.2.43",
      context,
      database,
      input: { email: "b@example.com" },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
      onDelivery: (value) => {
        freshDelivery = { challengeId: value.challengeId, code: value.code }
      },
    })
    expect(freshStart.success).toBe(true)
    if (!freshStart.success || freshDelivery === undefined) return
    const unlocked = emailOtpVerify({
      clientIp: "192.0.2.43",
      context,
      database,
      input: { challengeId: freshDelivery.challengeId, code: freshDelivery.code },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(unlocked.success).toBe(true)
    expect(userStateGet(database, userId)).toBe("active")
    expect(otpLockoutRowGet(database, userId)).toMatchObject({ failedAttempts: 0, lockedUntil: null })
  })
})

test("a successful email OTP verify resets the failure counter", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId, userId } = await verifiedUserSeed(
      database,
      "email-reset.example.com",
      "c@example.com",
      "c",
    )
    let delivery: { challengeId: string; code: string } | undefined
    const started = emailOtpStart({
      clientIp: "192.0.2.44",
      context,
      database,
      input: { email: "c@example.com" },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const wrong = wrongCodeFor(delivery.code)
    for (let index = 0; index < 2; index += 1) {
      expect(
        emailOtpVerify({
          clientIp: "192.0.2.44",
          context,
          database,
          input: { challengeId: delivery.challengeId, code: wrong },
          rateLimitSecret: "test-rate-secret",
          realmId,
          runtime: testkit.runtime,
        }),
      ).toMatchObject({ code: "email-otp.invalid", success: false })
    }
    expect(otpLockoutRowGet(database, userId)).toMatchObject({ failedAttempts: 2 })
    expect(
      emailOtpVerify({
        clientIp: "192.0.2.44",
        context,
        database,
        input: { challengeId: delivery.challengeId, code: delivery.code },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    expect(otpLockoutRowGet(database, userId)).toMatchObject({ failedAttempts: 0 })
  })
})
