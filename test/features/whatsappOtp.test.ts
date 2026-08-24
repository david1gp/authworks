import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { realmUpdate } from "../../src/features/realms/actions/realmUpdate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { whatsappOtpResend as whatsappOtpResendAction } from "../../src/features/whatsappOtp/actions/whatsappOtpResend.js"
import { whatsappOtpStart } from "../../src/features/whatsappOtp/actions/whatsappOtpStart.js"
import { whatsappOtpVerify as whatsappOtpVerifyAction } from "../../src/features/whatsappOtp/actions/whatsappOtpVerify.js"
import { whatsappOtpCliCommands } from "../../src/features/whatsappOtp/cli/whatsappOtpCliCommands.js"
import { whatsappOtpApiClientCreate } from "../../src/features/whatsappOtp/client/whatsappOtpApiClientCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../../src/features/whatsappOtp/domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpServerAppCreate } from "../../src/features/whatsappOtp/server/whatsappOtpServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-otp-"))
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

async function createVerifiedPhoneUser(database: StorageDatabase) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain: "whatsapp-otp.example.com", name: "WhatsApp OTP" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "otp@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "WhatsApp OTP User" },
      userName: "whatsapp-otp-user",
    },
    realmId: realm.data.realm.id,
    onVerificationToken: (value) => {
      token = value.token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({
    context,
    database,
    input: { token },
    realmId: realm.data.realm.id,
  })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  const user = userRepositoryCreate(database.db).userGet(realm.data.realm.id, verified.data.user.id)
  expect(user.success).toBe(true)
  if (!user.success || user.data === null) throw new Error("User was not created")
  const updated = userRepositoryCreate(database.db).userUpdate(realm.data.realm.id, user.data.id, {
    phoneNumber: "+491701234567",
    phoneNumberVerifiedAt: database.runtime.now(),
    updatedAt: database.runtime.now(),
    version: user.data.version + 1,
  })
  expect(updated.success).toBe(true)
  return { context, realm: realm.data.realm, userId: user.data.id }
}

async function createOrganization(database: StorageDatabase, realmId: string, name = "WhatsApp OTP Organization") {
  const created = organizationCreate({
    context: realmSystemContextCreate(),
    database,
    input: { name },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.organization
}

function whatsappOtpAvailabilityAllowCreate(): WhatsappOtpAvailabilityPort {
  return {
    whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
  }
}

function whatsappOtpStartForTest(
  options: Omit<Parameters<typeof whatsappOtpStart>[0], "availability">,
): ReturnType<typeof whatsappOtpStart> {
  return whatsappOtpStart({ ...options, availability: whatsappOtpAvailabilityAllowCreate() })
}

function whatsappOtpResend(
  options: Omit<Parameters<typeof whatsappOtpResendAction>[0], "availability">,
): ReturnType<typeof whatsappOtpResendAction> {
  return whatsappOtpResendAction({ ...options, availability: whatsappOtpAvailabilityAllowCreate() })
}

function whatsappOtpVerify(
  options: Omit<Parameters<typeof whatsappOtpVerifyAction>[0], "availability">,
): ReturnType<typeof whatsappOtpVerifyAction> {
  return whatsappOtpVerifyAction({ ...options, availability: whatsappOtpAvailabilityAllowCreate() })
}

function expectWhatsappOtpStartRateLimited(result: ReturnType<typeof whatsappOtpStart>): void {
  expect(result).toMatchObject({ code: "whatsapp-otp.rate-limited", success: false })
  if (!result.success) expect(result.errorData).toContain('"retryAfterSeconds":60')
}

test("WhatsApp OTP starts, resends after cooldown, verifies once, and stores only hashes", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    let first: { challengeId: string; code: string } | undefined
    let deliveryCalls = 0
    const started = whatsappOtpStartForTest({
      clientIp: "192.0.2.10",
      context,
      database,
      delivery: {
        sendText: async ({ text }) => {
          deliveryCalls += 1
          expect(text).toContain(".")
          return { success: false, op: "fakeDelivery", errorMessage: "offline" }
        },
      },
      input: { phoneNumber: " +491701234567 " },
      onDelivery: (value) => {
        first = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    expect(first).toBeDefined()
    expect(deliveryCalls).toBe(1)
    if (!started.success || first === undefined) return
    expect(database.sqlite.query("SELECT phone_hash, code_hash FROM whatsapp_otp_challenges").get()).not.toEqual({
      phone_hash: "+491701234567",
      code_hash: first.code,
    })

    const cooldown = whatsappOtpStartForTest({
      clientIp: "192.0.2.10",
      context,
      database,
      input: { phoneNumber: "+491701234567" },
      onDelivery: () => {
        throw new Error("cooldown must not deliver")
      },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(cooldown).toEqual(started)

    testkit.advance(60_000)
    let replacement: { challengeId: string; code: string } | undefined
    const resent = whatsappOtpResend({
      clientIp: "192.0.2.10",
      context,
      database,
      input: { challengeId: first.challengeId },
      onDelivery: (value) => {
        replacement = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(resent.success).toBe(true)
    expect(replacement?.challengeId).not.toBe(first.challengeId)
    if (!resent.success || replacement === undefined) return
    expect(
      whatsappOtpVerify({
        clientIp: "192.0.2.10",
        context,
        database,
        input: { challengeId: first.challengeId, code: first.code },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    const verified = whatsappOtpVerify({
      clientIp: "192.0.2.10",
      context,
      database,
      input: { challengeId: replacement.challengeId, code: replacement.code },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(verified.success).toBe(true)
    if (verified.success) expect(verified.data.session?.session.authenticationMethod).toBe("whatsapp_otp")
  })
})

test("WhatsApp OTP is enumeration-resistant, tenant-scoped, and rate-limited", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const known = whatsappOtpStartForTest({
      clientIp: "192.0.2.11",
      context,
      database,
      input: { phoneNumber: "+491701234567" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const unknown = whatsappOtpStartForTest({
      clientIp: "192.0.2.12",
      context,
      database,
      input: { phoneNumber: "+491701234568" },
      onDelivery: () => {
        throw new Error("unknown phone must not receive delivery")
      },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(known.success).toBe(true)
    expect(unknown.success).toBe(true)
    if (!known.success || !unknown.success) return
    expect(Object.keys(known.data)).toEqual(Object.keys(unknown.data))
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = whatsappOtpVerify({
        clientIp: `192.0.2.${20 + attempt}`,
        context,
        database,
        input: { challengeId: known.data.challengeId, code: "999999" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(failed.success).toBe(false)
    }
    expect(
      whatsappOtpVerify({
        clientIp: "192.0.2.30",
        context,
        database,
        input: { challengeId: known.data.challengeId, code: "999999" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
  })
})

test("WhatsApp OTP applies the same cooldown to unknown and unverified phones without delivering or linking them", async () => {
  await withDatabase(async (database, testkit) => {
    const createdRealm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "whatsapp-otp-unverified.example.com", name: "WhatsApp OTP Unverified" },
    })
    expect(createdRealm.success).toBe(true)
    if (!createdRealm.success) return
    const { realm } = createdRealm.data
    const context = realmTenantContextCreate(realm.id, "anonymous")
    for (const { email, userName } of [
      { email: "unverified-first@example.com", userName: "unverified-first" },
      { email: "unverified-duplicate@example.com", userName: "unverified-duplicate" },
    ]) {
      const duplicate = userCreate({
        context,
        database,
        input: {
          email,
          phoneNumber: " +491701234567 ",
          profile: { displayName: userName },
          userName,
        },
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(duplicate.success).toBe(true)
    }

    let deliveryCalls = 0
    const unknown = whatsappOtpStartForTest({
      clientIp: "192.0.2.70",
      context,
      database,
      input: { phoneNumber: "+491701234568" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const unknownAgain = whatsappOtpStartForTest({
      clientIp: "192.0.2.72",
      context,
      database,
      input: { phoneNumber: "+491701234568" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const unverified = whatsappOtpStartForTest({
      clientIp: "192.0.2.71",
      context,
      database,
      delivery: {
        sendText: async () => {
          deliveryCalls += 1
          return { success: true, data: undefined }
        },
      },
      input: { phoneNumber: " +491701234567 " },
      onDelivery: () => {
        deliveryCalls += 1
      },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const unverifiedAgain = whatsappOtpStartForTest({
      clientIp: "192.0.2.73",
      context,
      database,
      input: { phoneNumber: " +491701234567 " },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })

    expect(unknown.success).toBe(true)
    expect(unknownAgain.success).toBe(true)
    expect(unverified.success).toBe(true)
    expect(unverifiedAgain.success).toBe(true)
    if (!unknown.success || !unknownAgain.success || !unverified.success || !unverifiedAgain.success) return
    expect(Object.keys(unverified.data)).toEqual(Object.keys(unknown.data))
    expect(unknownAgain.data).toEqual(unknown.data)
    expect(unverifiedAgain.data).toEqual(unverified.data)
    expect(unverified.data.challengeId).not.toBe(unknown.data.challengeId)
    expect(unverified.data.accepted).toBe(true)
    expect(unverified.data.expiresAt).toBe(unknown.data.expiresAt)
    expect(unverified.data.retryAt).toBe(unknown.data.retryAt)
    expect(deliveryCalls).toBe(0)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 2 })
    expect(database.sqlite.query("SELECT user_id FROM whatsapp_otp_challenges ORDER BY created_at").all()).toEqual([
      { user_id: null },
      { user_id: null },
    ])
  })
})

test("WhatsApp OTP malformed phone starts consume both request windows", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const start = () =>
      whatsappOtpStartForTest({
        clientIp: "192.0.2.80",
        context,
        database,
        input: { phoneNumber: "not-a-phone" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      })

    for (let request = 0; request < 5; request += 1)
      expect(start()).toMatchObject({ data: { accepted: true }, success: true })
    expectWhatsappOtpStartRateLimited(start())
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.start.%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.start.identifier", requests: 6 },
      { scope: "whatsapp-otp.start.ip", requests: 6 },
    ])
    const keyHashes = database.sqlite.query("SELECT key_hash FROM rate_limits").all() as Array<{ key_hash: string }>
    expect(keyHashes.every(({ key_hash }) => !key_hash.includes("not-a-phone"))).toBe(true)
  })
})

test("WhatsApp OTP inactive realms consume start request windows before generic responses", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const inactive = realmUpdate({
      context: realmSystemContextCreate(),
      database,
      input: { status: "disabled" },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(inactive.success).toBe(true)
    const start = () =>
      whatsappOtpStartForTest({
        clientIp: "192.0.2.81",
        context,
        database,
        input: { phoneNumber: "+491701234567" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      })

    for (let request = 0; request < 5; request += 1)
      expect(start()).toMatchObject({ data: { accepted: true }, success: true })
    expectWhatsappOtpStartRateLimited(start())
  })
})

test("WhatsApp OTP policy-denied starts consume request windows before conflict responses", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const organization = await createOrganization(database, realm.id)
    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)
    const start = () =>
      whatsappOtpStartForTest({
        clientIp: "192.0.2.82",
        context,
        database,
        input: { organizationId: organization.id, phoneNumber: "+491701234567" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      })

    for (let request = 0; request < 5; request += 1)
      expect(start()).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expectWhatsappOtpStartRateLimited(start())
  })
})

test("WhatsApp OTP unavailable starts consume request windows before unavailable responses", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const unavailable: WhatsappOtpAvailabilityPort = {
      whatsappOtpAvailabilityGet: () => ({ data: { available: false }, success: true }),
    }
    const start = () =>
      whatsappOtpStart({
        availability: unavailable,
        clientIp: "192.0.2.83",
        context,
        database,
        input: { phoneNumber: "+491701234567" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      })

    for (let request = 0; request < 5; request += 1)
      expect(start()).toMatchObject({ code: "whatsapp-otp.unavailable", success: false })
    expectWhatsappOtpStartRateLimited(start())
  })
})

test("WhatsApp OTP actions enforce the organization policy without disclosing phone eligibility", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const organization = await createOrganization(database, realm.id)
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStartForTest({
      context,
      database,
      input: { organizationId: organization.id, phoneNumber: "+491701234567" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (!started.success || delivery === undefined) return

    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)

    const deniedStart = whatsappOtpStartForTest({
      context,
      database,
      input: { organizationId: organization.id, phoneNumber: "+491701234567" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const deniedUnknownStart = whatsappOtpStartForTest({
      context,
      database,
      input: { organizationId: organization.id, phoneNumber: "+491701234568" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(deniedStart).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(deniedUnknownStart).toMatchObject({ code: "whatsapp-otp.conflict", success: false })

    const deniedResend = whatsappOtpResend({
      context,
      database,
      input: { challengeId: delivery.challengeId, organizationId: organization.id },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const deniedVerify = whatsappOtpVerify({
      context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code, organizationId: organization.id },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(deniedResend).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(deniedVerify).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(
      database.sqlite.query("SELECT consumed_at FROM whatsapp_otp_challenges WHERE id = ?").get(delivery.challengeId),
    ).toEqual({ consumed_at: null })
  })
})

test("WhatsApp OTP policy denial precedes explicit-organization challenge access", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const organization = await createOrganization(database, realm.id)
    const started = whatsappOtpStartForTest({
      context,
      database,
      input: { organizationId: organization.id, phoneNumber: "+491701234567" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return

    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)

    const before = database.sqlite
      .query("SELECT * FROM whatsapp_otp_challenges WHERE id = ?")
      .get(started.data.challengeId)
    const deniedResendExisting = whatsappOtpResend({
      context,
      database,
      input: { challengeId: started.data.challengeId, organizationId: organization.id },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const deniedResendMissing = whatsappOtpResend({
      context,
      database,
      input: { challengeId: "missing-whatsapp-challenge", organizationId: organization.id },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const deniedVerifyExisting = whatsappOtpVerify({
      context,
      database,
      input: { challengeId: started.data.challengeId, code: "000000", organizationId: organization.id },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const deniedVerifyMissing = whatsappOtpVerify({
      context,
      database,
      input: { challengeId: "missing-whatsapp-challenge", code: "000000", organizationId: organization.id },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })

    expect(deniedResendExisting).toEqual(deniedResendMissing)
    expect(deniedVerifyExisting).toEqual(deniedVerifyMissing)
    expect(deniedResendExisting).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(deniedVerifyExisting).toMatchObject({ code: "whatsapp-otp.conflict", success: false })
    expect(
      database.sqlite.query("SELECT * FROM whatsapp_otp_challenges WHERE id = ?").get(started.data.challengeId),
    ).toEqual(before)
  })
})

test("WhatsApp OTP does not disclose policy-denied challenge existence when organization is omitted", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const organization = await createOrganization(database, realm.id)
    const started = whatsappOtpStartForTest({
      context,
      database,
      input: { organizationId: organization.id, phoneNumber: "+491701234567" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return

    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)

    const existingResend = whatsappOtpResend({
      clientIp: "192.0.2.50",
      context,
      database,
      input: { challengeId: started.data.challengeId },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const missingResend = whatsappOtpResend({
      clientIp: "192.0.2.51",
      context,
      database,
      input: { challengeId: "missing-whatsapp-challenge" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(existingResend.success).toBe(true)
    expect(missingResend.success).toBe(true)
    if (!existingResend.success || !missingResend.success) return
    expect(Object.keys(existingResend.data)).toEqual(Object.keys(missingResend.data))
    expect(existingResend.data.accepted).toBe(true)
    expect(missingResend.data.accepted).toBe(true)

    const existingVerify = whatsappOtpVerify({
      clientIp: "192.0.2.52",
      context,
      database,
      input: { challengeId: started.data.challengeId, code: "000000" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    const missingVerify = whatsappOtpVerify({
      clientIp: "192.0.2.53",
      context,
      database,
      input: { challengeId: "missing-whatsapp-challenge", code: "000000" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(existingVerify).toEqual(missingVerify)
    expect(existingVerify).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
  })
})

test("WhatsApp OTP generic resend and verify denials consume challenge and IP limits", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedPhoneUser(database)
    const disabledOrganization = await createOrganization(database, realm.id)
    const mismatchOrganization = await createOrganization(database, realm.id, "WhatsApp OTP Mismatch Organization")
    const started = whatsappOtpStartForTest({
      context,
      database,
      input: { organizationId: disabledOrganization.id, phoneNumber: "+491701234567" },
      rateLimitSecret: "test-rate-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return

    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: disabledOrganization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)

    const resendCases = [
      whatsappOtpResend({
        clientIp: "192.0.2.60",
        context,
        database,
        input: { challengeId: started.data.challengeId },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
      whatsappOtpResend({
        clientIp: "192.0.2.61",
        context,
        database,
        input: { challengeId: "missing-whatsapp-challenge" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
      whatsappOtpResend({
        clientIp: "192.0.2.62",
        context,
        database,
        input: { challengeId: started.data.challengeId, organizationId: mismatchOrganization.id },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
    ]
    expect(resendCases.every((result) => result.success)).toBe(true)
    if (resendCases.some((result) => !result.success)) return
    expect(
      new Set(resendCases.map((result) => (result.success ? Object.keys(result.data).join(",") : "error"))).size,
    ).toBe(1)
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.resend.%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.resend.identifier", requests: 3 },
      { scope: "whatsapp-otp.resend.ip", requests: 3 },
    ])

    const verifyCases = [
      whatsappOtpVerify({
        clientIp: "192.0.2.63",
        context,
        database,
        input: { challengeId: started.data.challengeId, code: "000000" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
      whatsappOtpVerify({
        clientIp: "192.0.2.64",
        context,
        database,
        input: { challengeId: "missing-whatsapp-challenge", code: "000000" },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
      whatsappOtpVerify({
        clientIp: "192.0.2.65",
        context,
        database,
        input: { challengeId: started.data.challengeId, code: "000000", organizationId: mismatchOrganization.id },
        rateLimitSecret: "test-rate-secret",
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
    ]
    expect(verifyCases[0]).toEqual(verifyCases[1])
    expect(verifyCases[1]).toEqual(verifyCases[2])
    expect(verifyCases[0]).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(
      database.sqlite
        .query(
          "SELECT scope, SUM(count) AS requests FROM rate_limits WHERE scope LIKE 'whatsapp-otp.verify.%' GROUP BY scope ORDER BY scope",
        )
        .all(),
    ).toEqual([
      { scope: "whatsapp-otp.verify.identifier", requests: 3 },
      { scope: "whatsapp-otp.verify.ip", requests: 3 },
    ])
  })
})

test("WhatsApp OTP routes enforce organization policy on start, resend, and verify", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm } = await createVerifiedPhoneUser(database)
    const organization = await createOrganization(database, realm.id)
    let delivery: { challengeId: string; code: string } | undefined
    const app = whatsappOtpServerAppCreate({
      database,
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret: "test-rate-secret",
      availability: whatsappOtpAvailabilityAllowCreate(),
    })
    const url = `https://whatsapp-otp.example.com/realms/${realm.id}/whatsapp-otp`
    const request = (path: string, body: unknown) =>
      app.request(`${url}/${path}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
      })

    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)
    const deniedStart = await request("start", {
      organizationId: organization.id,
      phoneNumber: "+491701234567",
    })
    expect(deniedStart.status).toBe(409)
    expect((await deniedStart.json()) as { error?: { code?: string } }).toMatchObject({
      error: { code: "whatsapp-otp.conflict" },
    })

    const enabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: true },
      organizationId: organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(enabled.success).toBe(true)
    const allowedStart = await request("start", {
      organizationId: organization.id,
      phoneNumber: "+491701234567",
    })
    expect(allowedStart.status).toBe(200)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return

    const disabledAgain = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabledAgain.success).toBe(true)
    const deniedResend = await request("resend", {
      challengeId: delivery.challengeId,
      organizationId: organization.id,
    })
    const deniedVerify = await request("verify", {
      challengeId: delivery.challengeId,
      code: delivery.code,
      organizationId: organization.id,
    })
    expect(deniedResend.status).toBe(409)
    expect(deniedVerify.status).toBe(409)
    expect((await deniedResend.json()) as { error?: { code?: string } }).toMatchObject({
      error: { code: "whatsapp-otp.conflict" },
    })
    expect((await deniedVerify.json()) as { error?: { code?: string } }).toMatchObject({
      error: { code: "whatsapp-otp.conflict" },
    })
  })
})

test("WhatsApp OTP route and client expose start, resend, and verify contracts", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm } = await createVerifiedPhoneUser(database)
    let code = ""
    const app = whatsappOtpServerAppCreate({
      clientIpResolve: () => "192.0.2.40",
      database,
      onDelivery: ({ code: delivered }) => {
        code = delivered
      },
      rateLimitSecret: "test-rate-secret",
      availability: whatsappOtpAvailabilityAllowCreate(),
    })
    const client = whatsappOtpApiClientCreate({
      baseUrl: "https://whatsapp-otp.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const started = await client.whatsappOtpStart(realm.id, { phoneNumber: "+491701234567" })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(JSON.stringify(started.data)).not.toContain(code)
    const resent = await client.whatsappOtpResend(realm.id, { challengeId: started.data.challengeId })
    expect(resent.success).toBe(true)
    const verified = await client.whatsappOtpVerify(realm.id, { challengeId: started.data.challengeId, code })
    expect(verified.success).toBe(true)
    expect(whatsappOtpCliCommands).toBeDefined()
    expect(testkit.runtime.now()).toBe(1_700_000_000_000)
  })
})
