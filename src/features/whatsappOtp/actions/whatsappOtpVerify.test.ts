import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../organizations/actions/organizationLoginPolicySet.js"
import { organizationMembershipCreate } from "../../organizations/actions/organizationMembershipCreate.js"
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
import type { WhatsappOtpSecurityNotification } from "../public/whatsappOtpSecurityNotificationSchema.js"
import { whatsappOtpStart } from "./whatsappOtpStart.js"
import { whatsappOtpVerify } from "./whatsappOtpVerify.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-otp-verify-"))
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

async function phoneUserSeed(database: StorageDatabase) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain: "whatsapp-otp-verify.example.com", name: "WhatsApp OTP Verify" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "otp@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "WhatsApp OTP User" },
      userName: "whatsapp-otp-verify-user",
    },
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
    phoneNumber: "+491701234567",
    phoneNumberVerifiedAt: database.runtime.now(),
    updatedAt: database.runtime.now(),
    version: user.data.version + 1,
  })
  expect(updated.success).toBe(true)
  return { context, realmId, userId: user.data.id }
}

async function organizationSeed(database: StorageDatabase, realmId: string, name: string) {
  const created = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(JSON.stringify(created))
  return created.data.organization
}

function challengeStateGet(
  database: StorageDatabase,
  challengeId: string,
): { attempts: number; consumedAt: number | null } {
  const row = database.sqlite
    .query("SELECT attempts, consumed_at AS consumedAt FROM whatsapp_otp_challenges WHERE id = ?")
    .get(challengeId) as { attempts: number; consumedAt: number | null }
  return row
}

test("a WhatsApp OTP verify in a disabled organization is rejected before the transaction without consuming the attempt", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId } = await phoneUserSeed(database)
    const organization = await organizationSeed(database, realmId, "No WhatsApp OTP")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      availability: availabilityAllow(),
      clientIp: "192.0.2.101",
      context,
      database,
      input: { organizationId: organization.id, phoneNumber: "+491701234567" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.id,
      realmId,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)
    const before = challengeStateGet(database, delivery.challengeId)
    const notifications: WhatsappOtpSecurityNotification[] = []

    const denied = whatsappOtpVerify({
      availability: availabilityAllow(),
      clientIp: "192.0.2.102",
      context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code },
      onSecurityNotification: (notification) => {
        notifications.push(notification)
      },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(denied).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(challengeStateGet(database, delivery.challengeId)).toEqual(before)
    expect(notifications).toEqual([])
  })
})

test("a WhatsApp OTP verify in an enabled organization succeeds without repeating the organization", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realmId, userId } = await phoneUserSeed(database)
    const organization = await organizationSeed(database, realmId, "WhatsApp OTP Allowed")
    const member = organizationMembershipCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { roles: ["member"], userId },
      organizationId: organization.id,
      realmId,
    })
    expect(member.success).toBe(true)
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      availability: availabilityAllow(),
      clientIp: "192.0.2.111",
      context,
      database,
      input: { organizationId: organization.id, phoneNumber: "+491701234567" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const allowed = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { allowWhatsappOtp: true },
      organizationId: organization.id,
      realmId,
      runtime: testkit.runtime,
    })
    expect(allowed.success).toBe(true)

    const verified = whatsappOtpVerify({
      availability: availabilityAllow(),
      clientIp: "192.0.2.112",
      context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code },
      rateLimitSecret: "test-rate-secret",
      realmId,
      runtime: testkit.runtime,
    })
    expect(verified.success).toBe(true)
  })
})
