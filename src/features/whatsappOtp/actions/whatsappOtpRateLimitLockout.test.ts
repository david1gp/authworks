import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passwordEmailVerify } from "../../passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../passwords/actions/passwordRegister.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpStart } from "./whatsappOtpStart.js"
import { whatsappOtpVerify } from "./whatsappOtpVerify.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-otp-limit-"))
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

function availabilityAllow(): WhatsappOtpAvailabilityPort {
  return {
    whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
  }
}

async function phoneUserSeed(
  database: StorageDatabase,
  domain: string,
  email: string,
  userName: string,
  phone: string,
) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: { email, password: "Correct Horse 12", profile: { displayName: userName }, userName },
    realmId,
    onVerificationToken: (value) => {
      token = value.token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  const users = userRepositoryCreate(database.db)
  const user = users.userGet(realmId, verified.data.user.id)
  expect(user.success).toBe(true)
  if (!user.success || user.data === null) throw new Error("The seeded user was not found.")
  const updated = users.userUpdate(realmId, user.data.id, {
    phoneNumber: phone,
    phoneNumberVerifiedAt: database.runtime.now(),
    updatedAt: database.runtime.now(),
    version: user.data.version + 1,
  })
  expect(updated.success).toBe(true)
  return { context, realmId, userId: user.data.id }
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

test("whatsapp OTP verify bursts are rate limited and failures lock the account without password double counting", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId, userId } = await phoneUserSeed(
      database,
      "wa-limit.example.com",
      "wa@example.com",
      "wa-user",
      "+491701111111",
    )
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      availability: availabilityAllow(),
      clientIp: "192.0.2.50",
      context,
      database,
      input: { phoneNumber: "+491701111111" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const wrong = wrongCodeFor(delivery.code)
    for (let index = 0; index < 5; index += 1) {
      const verified = whatsappOtpVerify({
        availability: availabilityAllow(),
        clientIp: "192.0.2.50",
        context,
        database,
        input: { challengeId: delivery.challengeId, code: wrong },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      })
      expect(verified).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    }
    expect(userStateGet(database, userId)).toBe("locked")
    expect(otpLockoutRowGet(database, userId)).toMatchObject({ failedAttempts: 5 })
    expect(database.sqlite.query("SELECT user_id FROM password_lockouts WHERE user_id = ?").get(userId)).toBeNull()
    const rateLimited = whatsappOtpVerify({
      availability: availabilityAllow(),
      clientIp: "192.0.2.50",
      context,
      database,
      input: { challengeId: delivery.challengeId, code: wrong },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(rateLimited).toMatchObject({ code: "whatsapp-otp.rate-limited", success: false })
  })
})

test("a correct whatsapp OTP is rejected while locked and succeeds after expiry with a reset counter", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId, userId } = await phoneUserSeed(
      database,
      "wa-unlock.example.com",
      "wb@example.com",
      "wb-user",
      "+491702222222",
    )
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      availability: availabilityAllow(),
      clientIp: "192.0.2.51",
      context,
      database,
      input: { phoneNumber: "+491702222222" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const wrong = wrongCodeFor(delivery.code)
    for (let index = 0; index < 5; index += 1) {
      expect(
        whatsappOtpVerify({
          availability: availabilityAllow(),
          clientIp: "192.0.2.51",
          context,
          database,
          input: { challengeId: delivery.challengeId, code: wrong },
          rateLimitSecret: "test-rate-secret",
          realmId,
          runtime: testkit.runtime,
        }),
      ).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    }
    expect(userStateGet(database, userId)).toBe("locked")
    testkit.advance(61 * 1_000)
    let lockedDelivery: { challengeId: string; code: string } | undefined
    const lockedStart = whatsappOtpStart({
      availability: availabilityAllow(),
      clientIp: "192.0.2.52",
      context,
      database,
      input: { phoneNumber: "+491702222222" },
      onDelivery: (value) => {
        lockedDelivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(lockedStart.success).toBe(true)
    if (!lockedStart.success || lockedDelivery === undefined) return
    expect(
      whatsappOtpVerify({
        availability: availabilityAllow(),
        clientIp: "192.0.2.52",
        context,
        database,
        input: { challengeId: lockedDelivery.challengeId, code: lockedDelivery.code },
        rateLimitSecret: "test-rate-secret",
        realmId,
        runtime: testkit.runtime,
      }),
    ).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(userStateGet(database, userId)).toBe("locked")
    testkit.advance(15 * 60 * 1_000)
    let freshDelivery: { challengeId: string; code: string } | undefined
    const freshStart = whatsappOtpStart({
      availability: availabilityAllow(),
      clientIp: "192.0.2.53",
      context,
      database,
      input: { phoneNumber: "+491702222222" },
      onDelivery: (value) => {
        freshDelivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(freshStart.success).toBe(true)
    if (!freshStart.success || freshDelivery === undefined) return
    const unlocked = whatsappOtpVerify({
      availability: availabilityAllow(),
      clientIp: "192.0.2.53",
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
