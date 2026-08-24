import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { httpErrorResponseSchema } from "../../src/platform/http/httpErrorResponseSchema.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordRegistrationRateLimitConsume } from "../../src/features/passwords/actions/passwordRegistrationRateLimitConsume.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { passwordWhatsappVerify } from "../../src/features/passwords/actions/passwordWhatsappVerify.js"
import type { PasswordWhatsappAvailabilityPort } from "../../src/features/passwords/domain/passwordWhatsappAvailabilityPort.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { userPhoneNumberNormalize } from "../../src/features/users/domain/userPhoneNumberNormalize.js"
import { whatsappOtpResend } from "../../src/features/whatsappOtp/actions/whatsappOtpResend.js"
import { whatsappOtpStart } from "../../src/features/whatsappOtp/actions/whatsappOtpStart.js"
import { whatsappOtpVerify } from "../../src/features/whatsappOtp/actions/whatsappOtpVerify.js"
import { whatsappOtpApiClientCreate } from "../../src/features/whatsappOtp/client/whatsappOtpApiClientCreate.js"
import { whatsappOtpRateLimitConsume } from "../../src/features/whatsappOtp/actions/whatsappOtpRateLimitConsume.js"
import { whatsappOtpCodeCreate } from "../../src/features/whatsappOtp/domain/whatsappOtpCodeCreate.js"
import { whatsappOtpCodeMatches } from "../../src/features/whatsappOtp/domain/whatsappOtpCodeMatches.js"
import type { WhatsappOtpAvailabilityPort } from "../../src/features/whatsappOtp/domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpPhoneHashCreate } from "../../src/features/whatsappOtp/domain/whatsappOtpPhoneHashCreate.js"
import { whatsappOtpCodeHashCreate } from "../../src/features/whatsappOtp/domain/whatsappOtpCodeHashCreate.js"
import { whatsappOtpServerAppCreate } from "../../src/features/whatsappOtp/server/whatsappOtpServerAppCreate.js"
import { whatsappOtpAvailabilityCreate } from "../../src/features/whatsappOtp/server/whatsappOtpAvailabilityCreate.js"
import { whatsappOtpAvailabilityResponseSchema } from "../../src/features/whatsappOtp/public/whatsappOtpAvailabilityResponseSchema.js"
import { whatsappOtpResendResponseSchema } from "../../src/features/whatsappOtp/public/whatsappOtpResendResponseSchema.js"
import { whatsappOtpStartResponseSchema } from "../../src/features/whatsappOtp/public/whatsappOtpStartResponseSchema.js"
import { passwordRegistrationResponseSchema } from "../../src/features/passwords/public/passwordRegistrationResponseSchema.js"
import { wahaHealthCandidateRepositoryCreate } from "../../src/features/waha/persistence/wahaHealthCandidateRepositoryCreate.js"
import { wahaHealthCandidateReaderCreate } from "../../src/features/waha/server/wahaHealthCandidateReaderCreate.js"
import type { WahaConfiguration } from "../../src/features/waha/server/wahaConfiguration.js"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"
import { rateLimitKeyHashCreate } from "../../src/platform/rateLimit/rateLimitKeyHashCreate.js"
import { whatsappOtpRepositoryCreate } from "../../src/features/whatsappOtp/persistence/whatsappOtpRepositoryCreate.js"

const rateLimitSecret = "task-10-rate-limit-secret"
const available: WhatsappOtpAvailabilityPort = {
  whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
}
const registrationAvailable: PasswordWhatsappAvailabilityPort = {
  whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true }),
}

test("WhatsApp OTP unit primitives are deterministic, bounded, and hash-only", () => {
  const code = whatsappOtpCodeCreate({ randomBytes: () => new Uint8Array([0, 0, 0, 0]) })
  expect(code).toEqual({ data: "000000", success: true })
  if (!code.success) return
  const hash = whatsappOtpCodeHashCreate("unit-challenge", code.data)
  expect(hash).not.toContain(code.data)
  expect(whatsappOtpCodeMatches("unit-challenge", code.data, hash)).toBe(true)
  expect(whatsappOtpCodeMatches("unit-challenge", "111111", hash)).toBe(false)
  expect(whatsappOtpCodeCreate({ randomBytes: () => new Uint8Array([0, 0, 0]) })).toMatchObject({
    op: "whatsappOtpCodeCreate",
    success: false,
  })
})

test("WhatsApp OTP persistence is realm-scoped and CAS protects attempts, consumption, and replay", async () => {
  await withDatabasePair(async (first, second, testkit) => {
    const alpha = await createRealm(first, "otp-persistence-alpha.example.com")
    const beta = await createRealm(first, "otp-persistence-beta.example.com")
    const phoneHash = whatsappOtpPhoneHashCreate("+14155552671")
    const repository = whatsappOtpRepositoryCreate(first.db)
    const inserted = repository.whatsappOtpChallengeCreate({
      attempts: 0,
      codeHash: whatsappOtpCodeHashCreate("persistence-challenge", "123456"),
      consumedAt: null,
      cooldownUntil: testkit.runtime.now() + 60_000,
      createdAt: testkit.runtime.now(),
      expiresAt: testkit.runtime.now() + 10 * 60_000,
      id: "persistence-challenge",
      maxAttempts: 5,
      organizationId: null,
      phoneHash,
      purpose: "sign_in",
      realmId: alpha.id,
      userId: null,
      version: 1,
    })
    expect(inserted.success).toBe(true)
    expect(repository.whatsappOtpChallengeGet(beta.id, "persistence-challenge")).toEqual({
      data: null,
      success: true,
    })

    const alphaLatest = repository.whatsappOtpChallengeLatestGet(alpha.id, phoneHash, "sign_in")
    const betaLatest = repository.whatsappOtpChallengeLatestGet(beta.id, phoneHash, "sign_in")
    expect(alphaLatest).toMatchObject({ success: true, data: { id: "persistence-challenge" } })
    expect(betaLatest).toEqual({ data: null, success: true })

    const firstRepository = whatsappOtpRepositoryCreate(first.db)
    const secondRepository = whatsappOtpRepositoryCreate(second.db)
    const attempts = await runConcurrent(2, (index) =>
      (index === 0 ? firstRepository : secondRepository).whatsappOtpChallengeAttemptRecord({
        attempts: 1,
        consumedAt: null,
        expectedVersion: 1,
        id: "persistence-challenge",
        realmId: alpha.id,
        version: 2,
      }),
    )
    expect(attempts.filter((result) => result.success && result.data !== null)).toHaveLength(1)
    expect(attempts.filter((result) => result.success && result.data === null)).toHaveLength(1)

    const consumed = await runConcurrent(2, (index) =>
      (index === 0 ? firstRepository : secondRepository).whatsappOtpChallengeConsume(
        alpha.id,
        "persistence-challenge",
        2,
        testkit.runtime.now(),
      ),
    )
    expect(consumed.filter((result) => result.success && result.data !== null)).toHaveLength(1)
    expect(consumed.filter((result) => result.success && result.data === null)).toHaveLength(1)
    expect(repository.whatsappOtpChallengeGet(alpha.id, "persistence-challenge")).toMatchObject({
      success: true,
      data: { attempts: 1, consumedAt: testkit.runtime.now(), version: 3 },
    })

    const replay = whatsappOtpRepositoryCreate(first.db).whatsappOtpChallengeConsume(
      alpha.id,
      "persistence-challenge",
      3,
      testkit.runtime.now(),
    )
    expect(replay).toEqual({ data: null, success: true })

    const previous = repository.whatsappOtpChallengeCreate({
      attempts: 0,
      codeHash: whatsappOtpCodeHashCreate("previous-challenge", "123456"),
      consumedAt: null,
      cooldownUntil: testkit.runtime.now(),
      createdAt: testkit.runtime.now() - 120_000,
      expiresAt: testkit.runtime.now() + 10 * 60_000,
      id: "previous-challenge",
      maxAttempts: 5,
      organizationId: null,
      phoneHash: whatsappOtpPhoneHashCreate("+14155552672"),
      purpose: "sign_in",
      realmId: alpha.id,
      userId: null,
      version: 1,
    })
    expect(previous.success).toBe(true)
    expect(
      repository.whatsappOtpChallengeExpirePrevious(
        alpha.id,
        whatsappOtpPhoneHashCreate("+14155552672"),
        "sign_in",
        testkit.runtime.now(),
      ),
    ).toEqual({ data: undefined, success: true })
    expect(repository.whatsappOtpChallengeGet(alpha.id, "previous-challenge")).toMatchObject({
      success: true,
      data: { consumedAt: testkit.runtime.now() },
    })
  })
})

test("WhatsApp OTP keeps verified-phone lookup, challenges, and expiry isolated across realms", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createVerifiedPhoneUser(database, "otp-cross-realm-alpha.example.com")
    const beta = await createVerifiedPhoneUser(database, "otp-cross-realm-beta.example.com")
    const repository = userRepositoryCreate(database.db)
    const betaUser = repository.userGet(beta.realm.id, beta.userId)
    expect(betaUser).toMatchObject({ success: true, data: { phoneNumberVerifiedAt: testkit.runtime.now() } })
    if (!betaUser.success || betaUser.data === null) return
    expect(
      repository.userUpdate(beta.realm.id, beta.userId, {
        phoneNumberVerifiedAt: null,
        updatedAt: testkit.runtime.now(),
        version: betaUser.data.version + 1,
      }),
    ).toMatchObject({ success: true })

    let alphaDelivery: { challengeId: string; code: string } | undefined
    const alphaStarted = whatsappOtpStart({
      clientIp: "192.0.2.101",
      context: alpha.context,
      database,
      input: { phoneNumber: "+491701234567" },
      onDelivery: ({ challengeId, code }) => {
        alphaDelivery = { challengeId, code }
      },
      rateLimitSecret,
      realmId: alpha.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(alphaStarted.success).toBe(true)
    expect(alphaDelivery).toBeDefined()

    const hiddenBetaStart = whatsappOtpStart({
      clientIp: "192.0.2.102",
      context: beta.context,
      database,
      input: { phoneNumber: "+491701234567" },
      rateLimitSecret,
      realmId: beta.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(hiddenBetaStart).toMatchObject({ data: { accepted: true }, success: true })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 2 })

    const currentBetaUser = repository.userGet(beta.realm.id, beta.userId)
    expect(currentBetaUser.success).toBe(true)
    if (!currentBetaUser.success || currentBetaUser.data === null) return
    expect(
      repository.userUpdate(beta.realm.id, beta.userId, {
        phoneNumberVerifiedAt: testkit.runtime.now(),
        updatedAt: testkit.runtime.now(),
        version: currentBetaUser.data.version + 1,
      }),
    ).toMatchObject({ success: true })
    testkit.advance(60_000)
    testkit.advance(1)

    let betaDelivery: { challengeId: string; code: string } | undefined
    const betaStarted = whatsappOtpStart({
      clientIp: "192.0.2.103",
      context: beta.context,
      database,
      input: { phoneNumber: "+491701234567" },
      onDelivery: ({ challengeId, code }) => {
        betaDelivery = { challengeId, code }
      },
      rateLimitSecret,
      realmId: beta.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(betaStarted.success).toBe(true)
    expect(betaDelivery).toBeDefined()
    if (alphaDelivery === undefined || betaDelivery === undefined) return
    expect(betaDelivery.challengeId).not.toBe(alphaDelivery.challengeId)

    const crossRealm = whatsappOtpVerify({
      clientIp: "192.0.2.104",
      context: beta.context,
      database,
      input: alphaDelivery,
      rateLimitSecret,
      realmId: beta.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(crossRealm).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(alphaDelivery.challengeId),
    ).toEqual({ consumed_at: null })

    testkit.advance(599_999)
    const expiredAlpha = whatsappOtpVerify({
      clientIp: "192.0.2.105",
      context: alpha.context,
      database,
      input: alphaDelivery,
      rateLimitSecret,
      realmId: alpha.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    const verifiedBeta = whatsappOtpVerify({
      clientIp: "192.0.2.106",
      context: beta.context,
      database,
      input: betaDelivery,
      rateLimitSecret,
      realmId: beta.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(expiredAlpha).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(verifiedBeta.success).toBe(true)
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(alphaDelivery.challengeId),
    ).toEqual({ consumed_at: testkit.runtime.now() })
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(betaDelivery.challengeId),
    ).toEqual({ consumed_at: testkit.runtime.now() })
    expect(database.sqlite.query("SELECT realm_id FROM sessions").all()).toEqual([{ realm_id: beta.realm.id }])
  })
})

test("five failed WhatsApp OTP attempts reject the correct code", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-exhausted-correct.example.com")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      clientIp: "192.0.2.110",
      context: fixture.context,
      database,
      input: { phoneNumber: "+491701234567" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    const invalidCode = delivery.code === "000000" ? "111111" : "000000"
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        whatsappOtpVerify({
          clientIp: `192.0.2.${111 + attempt}`,
          context: fixture.context,
          database,
          input: { challengeId: delivery.challengeId, code: invalidCode },
          rateLimitSecret,
          realmId: fixture.realm.id,
          runtime: testkit.runtime,
          availability: available,
        }),
      ).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    }
    expect(
      database.sqlite
        .query("SELECT attempts, consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(delivery.challengeId),
    ).toEqual({ attempts: 5, consumed_at: testkit.runtime.now() })

    testkit.advance(60_000)
    const correctAfterExhaustion = whatsappOtpVerify({
      clientIp: "192.0.2.120",
      context: fixture.context,
      database,
      input: delivery,
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(correctAfterExhaustion).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 })
  })
})

test("concurrent WhatsApp OTP replay creates one session", async () => {
  await withDatabasePair(async (first, second, testkit) => {
    const fixture = await createVerifiedPhoneUser(first, "otp-concurrent-replay.example.com")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      context: fixture.context,
      database: first,
      input: { phoneNumber: "+491701234567" },
      onDelivery: ({ challengeId, code }) => {
        delivery = { challengeId, code }
      },
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    if (delivery === undefined) return
    const replayInput = delivery

    const verified = await runConcurrent(2, (index) =>
      whatsappOtpVerify({
        clientIp: `192.0.2.${121 + index}`,
        context: fixture.context,
        database: index === 0 ? first : second,
        input: replayInput,
        rateLimitSecret,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(verified.filter((result) => result.success)).toHaveLength(1)
    expect(verified.filter((result) => !result.success && result.code === "whatsapp-otp.invalid")).toHaveLength(1)
    expect(first.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 })
    expect(
      first.sqlite.query("SELECT consumed_at FROM whatsapp_otp_challenges WHERE id = ?").get(delivery.challengeId),
    ).toEqual({ consumed_at: testkit.runtime.now() })
  })
})

test("WhatsApp registration challenges remain realm-isolated and expire independently", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "passwords-cross-realm-alpha.example.com")
    const beta = await createRealm(database, "passwords-cross-realm-beta.example.com")
    const alphaContext = realmTenantContextCreate(alpha.id, "anonymous")
    const betaContext = realmTenantContextCreate(beta.id, "anonymous")
    let alphaCode = ""
    const alphaRegistered = passwordRegister({
      clientIp: "192.0.2.130",
      context: alphaContext,
      database,
      input: {
        email: "cross-realm-alpha@example.com",
        password: "Correct Horse 12",
        phoneNumber: "+14155552671",
        profile: {},
        userName: "cross-realm-alpha",
        verificationMethod: "whatsapp",
      },
      rateLimitSecret,
      realmId: alpha.id,
      runtime: testkit.runtime,
      whatsappAvailability: registrationAvailable,
      whatsappDelivery: {
        sendText: async ({ text }) => {
          alphaCode = text.match(/(\d{6})/)?.[1] ?? ""
          return { data: undefined, success: true as const }
        },
      },
    })
    expect(alphaRegistered.success).toBe(true)
    testkit.advance(1)
    let betaCode = ""
    const betaRegistered = passwordRegister({
      clientIp: "192.0.2.131",
      context: betaContext,
      database,
      input: {
        email: "cross-realm-beta@example.com",
        password: "Correct Horse 12",
        phoneNumber: "+14155552671",
        profile: {},
        userName: "cross-realm-beta",
        verificationMethod: "whatsapp",
      },
      rateLimitSecret,
      realmId: beta.id,
      runtime: testkit.runtime,
      whatsappAvailability: registrationAvailable,
      whatsappDelivery: {
        sendText: async ({ text }) => {
          betaCode = text.match(/(\d{6})/)?.[1] ?? ""
          return { data: undefined, success: true as const }
        },
      },
    })
    expect(betaRegistered.success).toBe(true)
    if (
      !alphaRegistered.success ||
      !betaRegistered.success ||
      alphaRegistered.data.challengeId === undefined ||
      betaRegistered.data.challengeId === undefined
    )
      return
    expect(alphaCode).toHaveLength(6)
    expect(betaCode).toHaveLength(6)
    expect(alphaRegistered.data.challengeId).not.toBe(betaRegistered.data.challengeId)

    const crossRealm = passwordWhatsappVerify({
      clientIp: "192.0.2.132",
      context: betaContext,
      database,
      input: { challengeId: alphaRegistered.data.challengeId, code: alphaCode },
      rateLimitSecret,
      realmId: beta.id,
      runtime: testkit.runtime,
    })
    expect(crossRealm).toMatchObject({ code: "passwords.invalid", success: false })
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM password_registration_challenges WHERE id = ?")
        .get(alphaRegistered.data.challengeId),
    ).toEqual({ consumed_at: null })

    testkit.advance(599_999)
    const expiredAlpha = passwordWhatsappVerify({
      clientIp: "192.0.2.133",
      context: alphaContext,
      database,
      input: { challengeId: alphaRegistered.data.challengeId, code: alphaCode },
      rateLimitSecret,
      realmId: alpha.id,
      runtime: testkit.runtime,
    })
    const verifiedBeta = passwordWhatsappVerify({
      clientIp: "192.0.2.134",
      context: betaContext,
      database,
      input: { challengeId: betaRegistered.data.challengeId, code: betaCode },
      rateLimitSecret,
      realmId: beta.id,
      runtime: testkit.runtime,
    })
    expect(expiredAlpha).toMatchObject({ code: "passwords.invalid", success: false })
    expect(verifiedBeta.success).toBe(true)
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM password_registration_challenges WHERE id = ?")
        .get(alphaRegistered.data.challengeId),
    ).toEqual({ consumed_at: testkit.runtime.now() })
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM password_registration_challenges WHERE id = ?")
        .get(betaRegistered.data.challengeId),
    ).toEqual({ consumed_at: testkit.runtime.now() })
    expect(database.sqlite.query("SELECT realm_id, state FROM users ORDER BY email").all()).toEqual([
      { realm_id: alpha.id, state: "initial" },
      { realm_id: beta.id, state: "active" },
    ])
  })
})

test("five failed WhatsApp registration attempts reject the correct code", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "passwords-exhausted-correct.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let code = ""
    const registered = passwordRegister({
      clientIp: "192.0.2.140",
      context,
      database,
      input: {
        email: "exhausted-correct@example.com",
        password: "Correct Horse 12",
        phoneNumber: "+14155552671",
        profile: {},
        userName: "exhausted-correct",
        verificationMethod: "whatsapp",
      },
      rateLimitSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      whatsappAvailability: registrationAvailable,
      whatsappDelivery: {
        sendText: async ({ text }) => {
          code = text.match(/(\d{6})/)?.[1] ?? ""
          return { data: undefined, success: true as const }
        },
      },
    })
    expect(registered.success).toBe(true)
    expect(code).toHaveLength(6)
    if (!registered.success || registered.data.challengeId === undefined) return
    const invalidCode = code === "000000" ? "111111" : "000000"
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        passwordWhatsappVerify({
          clientIp: `192.0.2.${141 + attempt}`,
          context,
          database,
          input: { challengeId: registered.data.challengeId, code: invalidCode },
          rateLimitSecret,
          realmId: realm.id,
          runtime: testkit.runtime,
        }),
      ).toMatchObject({ code: "passwords.invalid", success: false })
    }
    expect(
      database.sqlite
        .query("SELECT attempts, consumed_at FROM password_registration_challenges WHERE id = ?")
        .get(registered.data.challengeId),
    ).toEqual({ attempts: 5, consumed_at: testkit.runtime.now() })

    testkit.advance(60_000)
    const correctAfterExhaustion = passwordWhatsappVerify({
      clientIp: "192.0.2.150",
      context,
      database,
      input: { challengeId: registered.data.challengeId, code },
      rateLimitSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(correctAfterExhaustion).toMatchObject({ code: "passwords.invalid", success: false })
    expect(
      database.sqlite.query("SELECT state, phone_number_verified_at, registration_verified_at FROM users").get(),
    ).toEqual({ registration_verified_at: null, phone_number_verified_at: null, state: "initial" })
  })
})

test("concurrent WhatsApp registration replay verifies one user exactly once", async () => {
  await withDatabasePair(async (first, second, testkit) => {
    const realm = await createRealm(first, "passwords-concurrent-replay.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let code = ""
    const registered = passwordRegister({
      context,
      database: first,
      input: {
        email: "concurrent-replay@example.com",
        password: "Correct Horse 12",
        phoneNumber: "+14155552671",
        profile: {},
        userName: "concurrent-replay",
        verificationMethod: "whatsapp",
      },
      rateLimitSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      whatsappAvailability: registrationAvailable,
      whatsappDelivery: {
        sendText: async ({ text }) => {
          code = text.match(/(\d{6})/)?.[1] ?? ""
          return { data: undefined, success: true as const }
        },
      },
    })
    expect(registered.success).toBe(true)
    if (!registered.success || registered.data.challengeId === undefined) return
    const replayChallengeId = registered.data.challengeId

    const verified = await runConcurrent(2, (index) =>
      passwordWhatsappVerify({
        clientIp: `192.0.2.${151 + index}`,
        context,
        database: index === 0 ? first : second,
        input: { challengeId: replayChallengeId, code },
        rateLimitSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
    )
    expect(verified.filter((result) => result.success)).toHaveLength(1)
    expect(verified.filter((result) => !result.success && result.code === "passwords.invalid")).toHaveLength(1)
    expect(first.sqlite.query("SELECT COUNT(*) AS count FROM users WHERE state = 'active'").get()).toEqual({ count: 1 })
    expect(
      first.sqlite
        .query("SELECT attempts, consumed_at FROM password_registration_challenges WHERE id = ?")
        .get(replayChallengeId),
    ).toEqual({ attempts: 0, consumed_at: testkit.runtime.now() })
  })
})

test("concurrent registration, start, resend, and verify requests cannot bypass five-request or five-attempt limits", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-concurrency.example.com")
    const realm = fixture.realm
    const context = fixture.context
    expect(
      database.sqlite.query("SELECT phone_number, phone_number_verified_at, state FROM users").all(),
    ).toMatchObject([{ phone_number: "+491701234567", state: "active" }])
    const delivered: Array<{ challengeId: string; code: string }> = []
    const delivery = {
      sendText: async () => ({ data: undefined, success: true as const }),
    }

    const started = await runConcurrent(6, (index) =>
      whatsappOtpStart({
        clientIp: "192.0.2.10",
        context,
        database,
        delivery,
        input: { phoneNumber: "+491701234567" },
        onDelivery: ({ challengeId, code }) => {
          delivered.push({ challengeId, code })
        },
        rateLimitSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(started.filter((result) => result.success)).toHaveLength(5)
    expect(started.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    expect(delivered).toHaveLength(1)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 1 })
    const originalChallengeId = delivered[0]?.challengeId
    expect(originalChallengeId).toBeDefined()
    if (originalChallengeId === undefined) return

    testkit.advance(60_000)
    delivered.length = 0
    const resent = await runConcurrent(6, (index) =>
      whatsappOtpResend({
        clientIp: "192.0.2.11",
        context,
        database,
        delivery,
        input: { challengeId: originalChallengeId },
        onDelivery: ({ challengeId, code }) => {
          delivered.push({ challengeId, code })
        },
        rateLimitSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(resent.filter((result) => result.success)).toHaveLength(5)
    expect(resent.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    expect(delivered).toHaveLength(1)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 2 })
    const replacementChallengeId = delivered[0]?.challengeId
    expect(replacementChallengeId).toBeDefined()
    if (replacementChallengeId === undefined) return

    testkit.advance(60_000)
    const invalidCode = delivered[0]?.code === "000000" ? "111111" : "000000"
    const verified = await runConcurrent(6, (index) =>
      whatsappOtpVerify({
        clientIp: `192.0.2.${20 + index}`,
        context,
        database,
        input: { challengeId: replacementChallengeId, code: invalidCode },
        rateLimitSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(verified.filter((result) => !result.success && result.code === "whatsapp-otp.invalid")).toHaveLength(5)
    expect(verified.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    expect(
      database.sqlite
        .query("SELECT attempts, consumed_at FROM whatsapp_otp_challenges WHERE id = ?")
        .get(replacementChallengeId),
    ).toEqual({
      attempts: 5,
      consumed_at: testkit.runtime.now(),
    })

    testkit.advance(60_000)
    let registrationCode = ""
    const registrations = await runConcurrent(6, (index) =>
      passwordRegister({
        clientIp: "192.0.2.30",
        context,
        database,
        input: {
          email: `concurrent-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: "+14155552672",
          profile: {},
          userName: `concurrent-${index}`,
          verificationMethod: "whatsapp",
        },
        rateLimitSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        whatsappAvailability: registrationAvailable,
        whatsappDelivery: {
          sendText: async ({ text }) => {
            registrationCode = text.match(/(\d{6})/)?.[1] ?? ""
            return { data: undefined, success: true as const }
          },
        },
      }),
    )
    expect(registrations.filter((result) => result.success)).toHaveLength(5)
    expect(registrations.filter((result) => !result.success && result.code === "passwords.rate-limited")).toHaveLength(
      1,
    )
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 2 })
    const registration = registrations.find((result) => result.success)
    expect(registration?.success).toBe(true)
    if (!registration?.success || registration.data.challengeId === undefined) return
    const registrationChallengeId = registration.data.challengeId

    testkit.advance(60_000)
    const invalidRegistrationCode = registrationCode === "000000" ? "111111" : "000000"
    const registrationVerifications = await runConcurrent(6, (index) =>
      passwordWhatsappVerify({
        clientIp: `192.0.2.${40 + index}`,
        context,
        database,
        input: { challengeId: registrationChallengeId, code: invalidRegistrationCode },
        rateLimitSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
      }),
    )
    expect(
      registrationVerifications.filter((result) => !result.success && result.code === "passwords.invalid"),
    ).toHaveLength(5)
    expect(
      registrationVerifications.filter((result) => !result.success && result.code === "passwords.rate-limited"),
    ).toHaveLength(1)
    expect(
      database.sqlite
        .query("SELECT attempts, consumed_at FROM password_registration_challenges WHERE id = ?")
        .get(registrationChallengeId),
    ).toEqual({ attempts: 5, consumed_at: testkit.runtime.now() })
  })
})

test("separate SQLite connections keep concurrent WhatsApp actions atomic and scope-isolated", async () => {
  await withDatabasePair(async (first, second, testkit) => {
    const fixture = await createVerifiedPhoneUser(first, "otp-action-sqlite-pair.example.com")
    const databases = [first, second]

    const registrations = await runConcurrent(6, (index) =>
      passwordRegister({
        clientIp: "198.51.100.60",
        context: fixture.context,
        database: databases[index % databases.length] ?? first,
        input: {
          email: `pair-registration-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: `+1415556${String(100 + index).padStart(3, "0")}`,
          profile: {},
          userName: `pair-registration-${index}`,
          verificationMethod: "whatsapp",
        },
        rateLimitSecret,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        whatsappAvailability: registrationAvailable,
        whatsappDelivery: { sendText: async () => ({ data: undefined, success: true as const }) },
      }),
    )
    expect(registrations.filter((result) => result.success)).toHaveLength(5)
    expect(registrations.filter((result) => !result.success && result.code === "passwords.rate-limited")).toHaveLength(
      1,
    )

    testkit.advance(60_000)
    const isolatedRegistrations = await runConcurrent(6, (index) =>
      passwordRegister({
        clientIp: `198.51.100.${70 + index}`,
        context: fixture.context,
        database: databases[index % databases.length] ?? first,
        input: {
          email: `pair-isolated-registration-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: `+1415557${String(100 + index).padStart(3, "0")}`,
          profile: {},
          userName: `pair-isolated-registration-${index}`,
          verificationMethod: "whatsapp",
        },
        rateLimitSecret,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        whatsappAvailability: registrationAvailable,
        whatsappDelivery: { sendText: async () => ({ data: undefined, success: true as const }) },
      }),
    )
    expect(isolatedRegistrations.every((result) => result.success)).toBe(true)
    expect(isolatedRegistrations.some((result) => !result.success && result.code === "passwords.rate-limited")).toBe(
      false,
    )

    const started = await runConcurrent(6, (index) =>
      whatsappOtpStart({
        clientIp: "198.51.100.80",
        context: fixture.context,
        database: databases[index % databases.length] ?? first,
        input: { phoneNumber: "+491701234567" },
        rateLimitSecret,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(started.filter((result) => result.success)).toHaveLength(5)
    expect(started.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    const originalChallenge = first.sqlite
      .query("SELECT id FROM whatsapp_otp_challenges ORDER BY created_at DESC LIMIT 1")
      .get() as { id: string } | null
    expect(originalChallenge).not.toBeNull()
    if (originalChallenge === null) return

    testkit.advance(60_000)
    let replacementCode = ""
    const resent = await runConcurrent(6, (index) =>
      whatsappOtpResend({
        clientIp: "198.51.100.80",
        context: fixture.context,
        database: databases[index % databases.length] ?? first,
        input: { challengeId: originalChallenge.id },
        onDelivery: ({ code }) => {
          replacementCode = code
        },
        rateLimitSecret,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(resent.filter((result) => result.success)).toHaveLength(5)
    expect(resent.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    expect(replacementCode).toHaveLength(6)
    const replacementChallenge = first.sqlite
      .query("SELECT id FROM whatsapp_otp_challenges ORDER BY created_at DESC LIMIT 1")
      .get() as { id: string } | null
    expect(replacementChallenge).not.toBeNull()
    if (replacementChallenge === null) return

    testkit.advance(60_000)
    const verified = await runConcurrent(6, (index) =>
      whatsappOtpVerify({
        clientIp: "198.51.100.80",
        context: fixture.context,
        database: databases[index % databases.length] ?? first,
        input: { challengeId: replacementChallenge.id, code: replacementCode === "000000" ? "111111" : "000000" },
        rateLimitSecret,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(verified.filter((result) => !result.success && result.code === "whatsapp-otp.invalid")).toHaveLength(5)
    expect(verified.filter((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toHaveLength(1)
    expect(
      first.sqlite.query("SELECT attempts FROM whatsapp_otp_challenges WHERE id = ?").get(replacementChallenge.id),
    ).toEqual({ attempts: 5 })

    const isolatedStarts = await runConcurrent(6, (index) =>
      whatsappOtpStart({
        clientIp: `198.51.100.${90 + index}`,
        context: fixture.context,
        database: databases[index % databases.length] ?? first,
        input: { phoneNumber: `+1415558${String(100 + index).padStart(3, "0")}` },
        rateLimitSecret,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        availability: available,
      }),
    )
    expect(isolatedStarts.every((result) => result.success)).toBe(true)
    expect(isolatedStarts.some((result) => !result.success && result.code === "whatsapp-otp.rate-limited")).toBe(false)
  })
})

test("concurrent WhatsApp routes expose atomic limits and trusted-IP scope isolation", async () => {
  await withDatabasePair(async (first, second, testkit) => {
    const fixture = await createVerifiedPhoneUser(first, "otp-route-sqlite-pair.example.com")
    const trustedProxy = "203.0.113.10"
    const passwordApps = [first, second].map((database) =>
      passwordServerAppCreate({
        clientIpResolve: () => trustedProxy,
        database,
        rateLimitSecret,
        trustedProxyAddresses: [trustedProxy],
        whatsappAvailability: registrationAvailable,
        whatsappDelivery: { sendText: async () => ({ data: undefined, success: true as const }) },
      }),
    )
    const otpApps = [first, second].map((database) =>
      whatsappOtpServerAppCreate({
        clientIpResolve: () => trustedProxy,
        database,
        rateLimitSecret,
        trustedProxyAddresses: [trustedProxy],
        availability: available,
      }),
    )
    const passwordUrl = `https://otp-route-sqlite-pair.example.com/realms/${fixture.realm.id}/password/register`
    const otpBaseUrl = `https://otp-route-sqlite-pair.example.com/realms/${fixture.realm.id}/whatsapp-otp`
    const passwordRequest = async (index: number, input: unknown, forwardedFor: string) =>
      passwordApps[index % passwordApps.length]!.request(passwordUrl, {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        method: "POST",
      })
    const otpRequest = async (index: number, path: string, input: unknown, forwardedFor: string) =>
      otpApps[index % otpApps.length]!.request(`${otpBaseUrl}/${path}`, {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        method: "POST",
      })

    const registrations = await runConcurrentAsync(6, (index) =>
      passwordRequest(
        index,
        {
          email: `route-pair-registration-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: `+1415560${String(100 + index).padStart(3, "0")}`,
          profile: {},
          userName: `route-pair-registration-${index}`,
          verificationMethod: "whatsapp",
        },
        "198.51.100.110",
      ),
    )
    expect(registrations.filter((response) => response.status === 200)).toHaveLength(5)
    const limitedRegistrations = registrations.filter((response) => response.status === 429)
    expect(limitedRegistrations).toHaveLength(1)
    for (const response of limitedRegistrations) await expectRateLimited(response)

    testkit.advance(60_000)
    const isolatedRegistrations = await runConcurrentAsync(6, (index) =>
      passwordRequest(
        index,
        {
          email: `route-pair-isolated-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: `+1415561${String(100 + index).padStart(3, "0")}`,
          profile: {},
          userName: `route-pair-isolated-${index}`,
          verificationMethod: "whatsapp",
        },
        `198.51.100.${120 + index}`,
      ),
    )
    expect(isolatedRegistrations.every((response) => response.status === 200)).toBe(true)

    let deliveredCode = ""
    const otpDelivery = {
      sendText: async ({ text }: { text: string }) => {
        deliveredCode = text.match(/(\d{6})/)?.[1] ?? ""
        return { data: undefined, success: true as const }
      },
    }
    const otpWithDeliveryApps = [first, second].map((database) =>
      whatsappOtpServerAppCreate({
        clientIpResolve: () => trustedProxy,
        database,
        delivery: otpDelivery,
        onDelivery: ({ code }) => {
          deliveredCode = code
        },
        rateLimitSecret,
        trustedProxyAddresses: [trustedProxy],
        availability: available,
      }),
    )
    const otpRequestWithDelivery = async (index: number, path: string, input: unknown, forwardedFor: string) =>
      otpWithDeliveryApps[index % otpWithDeliveryApps.length]!.request(`${otpBaseUrl}/${path}`, {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        method: "POST",
      })

    const starts = await runConcurrentAsync(6, (index) =>
      otpRequestWithDelivery(index, "start", { phoneNumber: "+491701234567" }, "198.51.100.130"),
    )
    expect(starts.filter((response) => response.status === 200)).toHaveLength(5)
    const limitedStarts = starts.filter((response) => response.status === 429)
    expect(limitedStarts).toHaveLength(1)
    for (const response of limitedStarts) await expectRateLimited(response)
    const startSuccess = starts.find((response) => response.status === 200)
    expect(startSuccess).toBeDefined()
    if (startSuccess === undefined) return
    const startBody = (await startSuccess.json()) as { challengeId: string }
    expect(startBody.challengeId).toBeString()

    testkit.advance(60_000)
    const resends = await runConcurrentAsync(6, (index) =>
      otpRequestWithDelivery(index, "resend", { challengeId: startBody.challengeId }, "198.51.100.130"),
    )
    expect(resends.filter((response) => response.status === 200)).toHaveLength(5)
    const limitedResends = resends.filter((response) => response.status === 429)
    expect(limitedResends).toHaveLength(1)
    for (const response of limitedResends) await expectRateLimited(response)
    const resendSuccess = resends.find((response) => response.status === 200)
    expect(resendSuccess).toBeDefined()
    if (resendSuccess === undefined) return
    const resendBody = (await resendSuccess.json()) as { challengeId: string }
    expect(resendBody.challengeId).toBeString()

    testkit.advance(60_000)
    const invalidCode = deliveredCode === "000000" ? "111111" : "000000"
    const verifications = await runConcurrentAsync(6, (index) =>
      otpRequestWithDelivery(
        index,
        "verify",
        { challengeId: resendBody.challengeId, code: invalidCode },
        "198.51.100.130",
      ),
    )
    expect(verifications.filter((response) => response.status === 400)).toHaveLength(5)
    const limitedVerifications = verifications.filter((response) => response.status === 429)
    expect(limitedVerifications).toHaveLength(1)
    for (const response of limitedVerifications) await expectRateLimited(response)

    const isolatedStarts = await runConcurrentAsync(6, (index) =>
      otpRequest(
        index,
        "start",
        { phoneNumber: `+1415562${String(100 + index).padStart(3, "0")}` },
        `198.51.100.${140 + index}`,
      ),
    )
    expect(isolatedStarts.every((response) => response.status === 200)).toBe(true)
  })
})

test("identifier, IP, operation, tenant, and secret scopes remain isolated", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "otp-rate-scope.example.com")
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        passwordRegistrationRateLimitConsume(database.db, {
          clientIp: "198.51.100.1",
          delivery: false,
          identifier: "phone-a",
          now: testkit.runtime.now(),
          rateLimitSecret,
          realmId: realm.id,
          verify: false,
        }),
      ).toMatchObject({ data: { allowed: true }, success: true })
    }
    expect(
      passwordRegistrationRateLimitConsume(database.db, {
        clientIp: "198.51.100.1",
        delivery: false,
        identifier: "phone-a",
        now: testkit.runtime.now(),
        rateLimitSecret,
        realmId: realm.id,
        verify: false,
      }),
    ).toMatchObject({ data: { allowed: false }, success: true })
    expect(
      passwordRegistrationRateLimitConsume(database.db, {
        clientIp: "198.51.100.2",
        delivery: false,
        identifier: "phone-b",
        now: testkit.runtime.now(),
        rateLimitSecret,
        realmId: realm.id,
        verify: false,
      }),
    ).toMatchObject({ data: { allowed: true }, success: true })
    expect(
      passwordRegistrationRateLimitConsume(database.db, {
        clientIp: "198.51.100.2",
        delivery: false,
        identifier: "phone-a",
        now: testkit.runtime.now(),
        rateLimitSecret,
        realmId: realm.id,
        verify: true,
      }),
    ).toMatchObject({ data: { allowed: true }, success: true })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        whatsappOtpRateLimitConsume(database.db, {
          clientIp: "198.51.100.3",
          identifier: "challenge-a",
          now: testkit.runtime.now(),
          operation: "start",
          rateLimitSecret,
          realmId: realm.id,
        }),
      ).toMatchObject({ data: { allowed: true }, success: true })
    }
    expect(
      whatsappOtpRateLimitConsume(database.db, {
        clientIp: "198.51.100.3",
        identifier: "challenge-a",
        now: testkit.runtime.now(),
        operation: "start",
        rateLimitSecret,
        realmId: realm.id,
      }),
    ).toMatchObject({ data: { allowed: false }, success: true })
    expect(
      whatsappOtpRateLimitConsume(database.db, {
        clientIp: "198.51.100.3",
        identifier: "challenge-a",
        now: testkit.runtime.now(),
        operation: "verify",
        rateLimitSecret,
        realmId: realm.id,
      }),
    ).toMatchObject({ data: { allowed: true }, success: true })
    expect(
      whatsappOtpRateLimitConsume(database.db, {
        clientIp: "198.51.100.4",
        identifier: "challenge-b",
        now: testkit.runtime.now(),
        operation: "start",
        rateLimitSecret,
        realmId: realm.id,
      }),
    ).toMatchObject({ data: { allowed: true }, success: true })

    const rawValues = ["phone-a", "challenge-a", "198.51.100.1", "198.51.100.3", "task@example.com"]
    const rateLimitRows = database.sqlite.query("SELECT key_hash FROM rate_limits").all() as Array<{ key_hash: string }>
    expect(rateLimitRows.every((row) => rawValues.every((value) => !row.key_hash.includes(value)))).toBe(true)
    expect(rateLimitKeyHashCreate(rateLimitSecret, "realm:operation:identifier:phone-a")).not.toContain("phone-a")
  })
})

test("password registration consumes both mixed scopes and concurrent windows before denying", async () => {
  await withDatabasePair(async (first, second, testkit) => {
    const realm = await createRealm(first, "password-rate-limit-mixed-scope.example.com")
    const startedAt = testkit.runtime.now()
    const consume = (database: StorageDatabase, identifier: string, clientIp: string) =>
      passwordRegistrationRateLimitConsume(database.db, {
        clientIp,
        delivery: false,
        identifier,
        now: testkit.runtime.now(),
        rateLimitSecret,
        realmId: realm.id,
        verify: false,
      })

    for (let attempt = 0; attempt < 5; attempt += 1)
      expect(consume(first, "mixed-identifier", `198.51.100.${attempt}`)).toMatchObject({
        data: { allowed: true },
        success: true,
      })

    testkit.advance(30_000)
    const laterScopeStartedAt = testkit.runtime.now()
    for (let attempt = 0; attempt < 5; attempt += 1)
      expect(consume(second, `other-identifier-${attempt}`, "198.51.100.50")).toMatchObject({
        data: { allowed: true },
        success: true,
      })

    const mixed = consume(first, "mixed-identifier", "198.51.100.50")
    expect(mixed).toMatchObject({
      data: { allowed: false, retryAt: laterScopeStartedAt + 60_000 },
      success: true,
    })
    const onlyIdentifier = consume(second, "mixed-identifier", "198.51.100.51")
    expect(onlyIdentifier).toMatchObject({
      data: { allowed: false, retryAt: startedAt + 60_000 },
      success: true,
    })

    const identifierHash = rateLimitKeyHashCreate(
      rateLimitSecret,
      `${realm.id}:registration:identifier:mixed-identifier`,
    )
    const lateIpHash = rateLimitKeyHashCreate(rateLimitSecret, `${realm.id}:registration:ip:198.51.100.50`)
    const newIpHash = rateLimitKeyHashCreate(rateLimitSecret, `${realm.id}:registration:ip:198.51.100.51`)
    expect(
      first.sqlite
        .query("SELECT count FROM rate_limits WHERE scope = ? AND key_hash = ?")
        .get("password.registration.registration.identifier", identifierHash),
    ).toEqual({ count: 7 })
    expect(
      first.sqlite
        .query("SELECT count FROM rate_limits WHERE scope = ? AND key_hash = ?")
        .get("password.registration.registration.ip", lateIpHash),
    ).toEqual({ count: 6 })
    expect(
      first.sqlite
        .query("SELECT count FROM rate_limits WHERE scope = ? AND key_hash = ?")
        .get("password.registration.registration.ip", newIpHash),
    ).toEqual({ count: 1 })

    const concurrentResults = await runConcurrent(6, (index) =>
      consume(index % 2 === 0 ? first : second, "concurrent-identifier", "198.51.100.60"),
    )
    expect(concurrentResults.filter((result) => result.success && result.data.allowed)).toHaveLength(5)
    expect(concurrentResults.filter((result) => result.success && !result.data.allowed)).toHaveLength(1)
    const concurrentIdentifierHash = rateLimitKeyHashCreate(
      rateLimitSecret,
      `${realm.id}:registration:identifier:concurrent-identifier`,
    )
    const concurrentIpHash = rateLimitKeyHashCreate(rateLimitSecret, `${realm.id}:registration:ip:198.51.100.60`)
    expect(
      first.sqlite
        .query("SELECT count FROM rate_limits WHERE scope = ? AND key_hash = ?")
        .get("password.registration.registration.identifier", concurrentIdentifierHash),
    ).toEqual({ count: 6 })
    expect(
      first.sqlite
        .query("SELECT count FROM rate_limits WHERE scope = ? AND key_hash = ?")
        .get("password.registration.registration.ip", concurrentIpHash),
    ).toEqual({ count: 6 })
  })
})

test("route rate limits expose 429, exact rate_limited, and Retry-After for start, resend, and verify", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-route-limits.example.com")
    let deliveryCalls = 0
    let deliveredCode = ""
    const app = whatsappOtpServerAppCreate({
      clientIpResolve: () => "203.0.113.10",
      database,
      delivery: {
        sendText: async ({ text }) => {
          deliveryCalls += 1
          deliveredCode = text.match(/(\d{6})/)?.[1] ?? ""
          return { data: undefined, success: true as const }
        },
      },
      rateLimitSecret,
      availability: available,
    })
    const url = `https://otp-route-limits.example.com/realms/${fixture.realm.id}/whatsapp-otp`
    const post = (path: string, body: unknown) =>
      app.request(`${url}/${path}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
      })

    const first = await post("start", { phoneNumber: "+491701234567" })
    expect(first.status).toBe(200)
    const challengeId = ((await first.json()) as { challengeId: string }).challengeId
    expect(deliveryCalls).toBe(1)
    for (let request = 0; request < 4; request += 1) {
      expect((await post("start", { phoneNumber: "+491701234567" })).status).toBe(200)
    }
    const limitedStart = await post("start", { phoneNumber: "+491701234567" })
    await expectRateLimited(limitedStart)

    for (let request = 0; request < 5; request += 1) {
      expect((await post("resend", { challengeId })).status).toBe(200)
    }
    const limitedResend = await post("resend", { challengeId })
    await expectRateLimited(limitedResend)

    const invalidCode = deliveredCode === "000000" ? "111111" : "000000"
    for (let request = 0; request < 5; request += 1) {
      expect((await post("verify", { challengeId, code: invalidCode })).status).toBe(400)
    }
    const limitedVerify = await post("verify", { challengeId, code: invalidCode })
    await expectRateLimited(limitedVerify)
    expect(testkit.runtime.now()).toBe(1_700_000_000_000)
  })
})

test("known and unknown phone starts share repeated-call responses without linking unknown codes", async () => {
  await withDatabase(async (database) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-enumeration-route.example.com")
    const deliveries: string[] = []
    const app = whatsappOtpServerAppCreate({
      database,
      onDelivery: ({ challengeId }) => {
        deliveries.push(challengeId)
      },
      rateLimitSecret,
      availability: available,
    })
    const url = `https://otp-enumeration-route.example.com/realms/${fixture.realm.id}/whatsapp-otp/start`
    const request = (phoneNumber: string) =>
      app.request(url, {
        body: JSON.stringify({ phoneNumber }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    const known = await request("+491701234567")
    const unknown = await request("+491701234568")
    const knownAgain = await request("+491701234567")
    const unknownAgain = await request("+491701234568")
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(knownAgain.status).toBe(200)
    expect(unknownAgain.status).toBe(200)
    const knownBody = (await known.json()) as Record<string, unknown>
    const unknownBody = (await unknown.json()) as Record<string, unknown>
    const knownAgainBody = (await knownAgain.json()) as Record<string, unknown>
    const unknownAgainBody = (await unknownAgain.json()) as Record<string, unknown>
    expect(Object.keys(knownBody).sort()).toEqual(Object.keys(unknownBody).sort())
    expect(Object.keys(unknownBody)).toEqual(["accepted", "challengeId", "expiresAt", "retryAt"])
    expect(knownBody.challengeId).not.toBe(unknownBody.challengeId)
    expect(knownBody.expiresAt).toBe(unknownBody.expiresAt)
    expect(knownBody.retryAt).toBe(unknownBody.retryAt)
    expect(knownAgainBody).toEqual(knownBody)
    expect(unknownAgainBody).toEqual(unknownBody)
    expect(deliveries).toEqual([knownBody.challengeId as string])
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 2 })
    expect(
      database.sqlite
        .query("SELECT user_id FROM whatsapp_otp_challenges WHERE id = ?")
        .get(knownBody.challengeId as string),
    ).toEqual({ user_id: fixture.userId })
    expect(
      database.sqlite
        .query("SELECT user_id FROM whatsapp_otp_challenges WHERE id = ?")
        .get(unknownBody.challengeId as string),
    ).toEqual({ user_id: null })
  })
})

test("API clients validate before fetch and preserve non-JSON and rate_limited HTTP failures", async () => {
  const requests: Array<{ body?: string; url: string }> = []
  let response: Response = Response.json({ available: true })
  const client = whatsappOtpApiClientCreate({
    baseUrl: "https://otp-client.example.com",
    fetch: async (input, init) => {
      requests.push({ body: typeof init?.body === "string" ? init.body : undefined, url: input.toString() })
      return response
    },
  })
  expect((await client.whatsappOtpStart("realm/id", { phoneNumber: "12" })).success).toBe(false)
  expect((await client.whatsappOtpResend("realm/id", { challengeId: "" })).success).toBe(false)
  expect((await client.whatsappOtpVerify("realm/id", { challengeId: "challenge", code: "bad" })).success).toBe(false)
  expect(requests).toHaveLength(0)

  expect(await client.whatsappOtpAvailabilityGet("realm/id", "organization/id")).toEqual({
    data: { available: true },
    success: true,
  })
  expect(requests[0]?.url).toBe(
    "https://otp-client.example.com/realms/realm%2Fid/whatsapp-otp/availability?organizationId=organization%2Fid",
  )

  response = Response.json(
    {
      error: {
        code: "rate_limited",
        details: { retryAfterSeconds: 17 },
        message: "Too many requests.",
        requestId: "request-id",
        retryable: true,
        status: 429,
      },
    },
    { headers: { "retry-after": "17" }, status: 429 },
  )
  const limited = await client.whatsappOtpStart("realm/id", { phoneNumber: "+14155552671" })
  expect(limited).toMatchObject({ code: "platform.rate-limited", statusCode: 429, success: false })
  if (!limited.success) expect(limited.errorData).toContain('"retryAfter":"17"')

  response = new Response("not-json", { status: 503 })
  const invalid = await client.whatsappOtpStart("realm/id", { phoneNumber: "+14155552671" })
  expect(invalid).toMatchObject({ code: "platform.http", statusCode: 503, success: false })
})

test("WhatsApp OTP CLI exposes separately scoped availability, start, resend, and verify commands", async () => {
  for (const command of ["availability", "start", "resend", "verify"]) {
    const child = Bun.spawn(["bun", "src/outputs/cli.ts", "whatsapp-otp", command, "--help"], {
      stderr: "pipe",
      stdout: "pipe",
    })
    const [exitCode, stderr, stdout] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ])
    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    expect(stdout).toContain("--realm-id")
    if (command === "availability") expect(stdout).toContain("--organization-id")
    if (command === "start") expect(stdout).toContain("--phone-number")
    if (command === "resend" || command === "verify") expect(stdout).toContain("--challenge-id")
    if (command === "verify") expect(stdout).toContain("--code")
  }
})

test("delivery failures happen after committed OTP state and replay never creates a second session", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-delivery-commit.example.com")
    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      context: fixture.context,
      database,
      delivery: {
        sendText: async () => {
          throw new Error("WAHA is offline")
        },
      },
      input: { phoneNumber: "+491701234567" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(started.success).toBe(true)
    expect(delivery).toBeDefined()
    await Promise.resolve()
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM whatsapp_otp_challenges").get()).toEqual({ count: 1 })
    if (delivery === undefined) return

    const verified = whatsappOtpVerify({
      context: fixture.context,
      database,
      input: delivery,
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(verified).toMatchObject({
      success: true,
      data: { session: { session: { authenticationMethod: "whatsapp_otp" } } },
    })
    const replay = whatsappOtpVerify({
      clientIp: "198.51.100.99",
      context: fixture.context,
      database,
      input: delivery,
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(replay).toMatchObject({ code: "whatsapp-otp.invalid", success: false })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 })
  })
})

test("registration delivery failure cannot roll back the committed user or registration challenge", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "otp-registration-delivery-task10.example.com")
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let code = ""
    const registered = passwordRegister({
      clientIp: "198.51.100.91",
      context,
      database,
      input: {
        email: "registration-delivery-task10@example.com",
        password: "Correct Horse 12",
        phoneNumber: "+14155552671",
        profile: {},
        userName: "registration-delivery-task10",
        verificationMethod: "whatsapp",
      },
      rateLimitSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      whatsappAvailability: registrationAvailable,
      whatsappDelivery: {
        sendText: async ({ text }) => {
          code = text.match(/(\d{6})/)?.[1] ?? ""
          throw new Error("WAHA is offline")
        },
      },
    })
    expect(registered).toMatchObject({ success: true, data: { accepted: true, verificationMethod: "whatsapp" } })
    expect(code).toHaveLength(6)
    expect(JSON.stringify(registered)).not.toContain(code)
    await Promise.resolve()
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual({ count: 1 })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM password_registration_challenges").get()).toEqual({
      count: 1,
    })
    if (!registered.success || registered.data.challengeId === undefined) return
    expect(
      passwordWhatsappVerify({
        context,
        database,
        input: { challengeId: registered.data.challengeId, code },
        rateLimitSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
  })
})

test("WhatsApp OTP follows required MFA and session semantics", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-mfa.example.com")
    const policy = mfaPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { lockoutDurationMs: 900_000, maxAttempts: 5, mode: "required", totpWindow: 1 },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(policy.success).toBe(true)
    const enrollment = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "otp-mfa-secret",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(enrollment.success).toBe(true)
    if (!enrollment.success) return
    const enrollmentCode = mfaTotpCodeCreate(enrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(enrollmentCode.success).toBe(true)
    if (!enrollmentCode.success) return
    expect(
      mfaTotpEnrollmentConfirm({
        database,
        encryptionSecret: "otp-mfa-secret",
        input: { code: enrollmentCode.data, enrollmentId: enrollment.data.enrollment.id },
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(true)

    let delivery: { challengeId: string; code: string } | undefined
    const started = whatsappOtpStart({
      context: fixture.context,
      database,
      input: { phoneNumber: "+491701234567" },
      onDelivery: (value) => {
        delivery = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(started.success).toBe(true)
    if (delivery === undefined) return
    const verified = whatsappOtpVerify({
      context: fixture.context,
      database,
      input: delivery,
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(verified).toMatchObject({
      success: true,
      data: { challenge: { challenge: { requiredAssurance: "multi_factor" } } },
    })
    if (verified.success) expect(verified.data.session).toBeUndefined()
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 })
    expect(database.sqlite.query("SELECT primary_authentication_method FROM mfa_challenges").get()).toEqual({
      primary_authentication_method: "whatsapp_otp",
    })
    if (!verified.success || verified.data.challenge === undefined) return

    testkit.advance(30_000)
    const completionCode = mfaTotpCodeCreate(enrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(completionCode.success).toBe(true)
    if (!completionCode.success) return
    const completed = mfaChallengeComplete({
      database,
      encryptionSecret: "otp-mfa-secret",
      input: { code: completionCode.data, token: verified.data.challenge.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(completed).toMatchObject({ success: true, data: { session: { session: { assurance: "multi_factor" } } } })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 })
  })
})

test("unknown, disabled, and stale cached availability fail consistently without exposing health internals", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-availability-task10.example.com")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Availability task ten" },
      realmId: fixture.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const configuration: WahaConfiguration = {
      endpoints: [{ client: { baseUrl: "https://waha-task10.example.test" }, id: "primary" }],
      freshnessTtlMs: 60_000,
      refreshIntervalMs: 30_000,
    }
    const repository = wahaHealthCandidateRepositoryCreate(database.db)
    const reader = wahaHealthCandidateReaderCreate({ repository })
    const availability = whatsappOtpAvailabilityCreate({ configuration, database, reader, runtime: testkit.runtime })
    const app = whatsappOtpServerAppCreate({ availability, database, rateLimitSecret })
    const availabilityUrl = `https://otp-availability-task10.example.com/realms/${fixture.realm.id}/whatsapp-otp/availability?organizationId=${organization.data.organization.id}`
    const startUrl = `https://otp-availability-task10.example.com/realms/${fixture.realm.id}/whatsapp-otp/start`
    const requestStart = () =>
      app.request(startUrl, {
        body: JSON.stringify({ organizationId: organization.data.organization.id, phoneNumber: "+491701234567" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })

    const initiallyUnavailable = await app.request(availabilityUrl)
    expect(await initiallyUnavailable.json()).toEqual({ available: false })
    expect(Object.keys((await app.request(availabilityUrl)).headers)).toBeDefined()
    expect((await requestStart()).status).toBe(503)

    const now = testkit.runtime.now()
    expect(
      repository.wahaHealthCandidateCreate({
        checkedAt: now,
        createdAt: now,
        endpointId: "primary",
        expiresAt: now + configuration.freshnessTtlMs,
        failureAt: null,
        failureCode: null,
        failureMessage: null,
        sessionName: "working",
        status: "healthy",
        updatedAt: now,
        version: 1,
      }),
    ).toMatchObject({ success: true })
    expect(await (await app.request(availabilityUrl)).json()).toEqual({ available: true })

    const disabled = organizationLoginPolicySet({
      context: realmSystemContextCreate(),
      database,
      input: { allowWhatsappOtp: false },
      organizationId: organization.data.organization.id,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)
    const disabledAvailability = await app.request(availabilityUrl)
    expect(await disabledAvailability.json()).toEqual({ available: false })
    const disabledStart = await requestStart()
    expect(disabledStart.status).toBe(409)
    expect(await disabledStart.text()).not.toContain("waha-task10.example.test")

    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowWhatsappOtp: true },
        organizationId: organization.data.organization.id,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    testkit.advance(configuration.freshnessTtlMs)
    const staleAvailability = await app.request(availabilityUrl)
    expect(await staleAvailability.json()).toEqual({ available: false })
    expect((await requestStart()).status).toBe(503)
  })
})

test("password WhatsApp registration and WhatsApp OTP routes trust forwarded IPs only from configured proxies", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "otp-trusted-proxy-task10.example.com")
    const passwordApp = passwordServerAppCreate({
      clientIpResolve: () => "203.0.113.10",
      database,
      rateLimitSecret,
      trustedProxyAddresses: [],
      whatsappAvailability: registrationAvailable,
      whatsappDelivery: { sendText: async () => ({ data: undefined, success: true as const }) },
    })
    const passwordUrl = `https://otp-trusted-proxy-task10.example.com/realms/${realm.id}/password/register`
    const passwordRequest = (index: number, forwardedFor: string) =>
      passwordApp.request(passwordUrl, {
        body: JSON.stringify({
          email: `untrusted-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: `+14155553${String(index).padStart(3, "0")}`,
          profile: {},
          userName: `untrusted-${index}`,
          verificationMethod: "whatsapp",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        method: "POST",
      })
    const untrustedStatuses: number[] = []
    for (let index = 0; index < 6; index += 1)
      untrustedStatuses.push((await passwordRequest(index, `198.51.100.${10 + index}`)).status)
    expect(untrustedStatuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
    expect(untrustedStatuses[5]).toBe(429)

    const trustedPasswordApp = passwordServerAppCreate({
      clientIpResolve: () => "203.0.113.20",
      database,
      rateLimitSecret,
      trustedProxyAddresses: ["203.0.113.20"],
      whatsappAvailability: registrationAvailable,
      whatsappDelivery: { sendText: async () => ({ data: undefined, success: true as const }) },
    })
    const trustedPasswordRequest = (index: number, forwardedFor: string) =>
      trustedPasswordApp.request(passwordUrl, {
        body: JSON.stringify({
          email: `trusted-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: `+14155554${String(index).padStart(3, "0")}`,
          profile: {},
          userName: `trusted-${index}`,
          verificationMethod: "whatsapp",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        method: "POST",
      })
    const trustedPasswordStatuses: number[] = []
    for (let index = 0; index < 6; index += 1)
      trustedPasswordStatuses.push((await trustedPasswordRequest(index, `198.51.100.${30 + index}`)).status)
    expect(trustedPasswordStatuses).toEqual([200, 200, 200, 200, 200, 200])

    const otpApp = whatsappOtpServerAppCreate({
      clientIpResolve: () => "203.0.113.30",
      database,
      rateLimitSecret,
      trustedProxyAddresses: [],
      availability: available,
    })
    const otpUrl = `https://otp-trusted-proxy-task10.example.com/realms/${realm.id}/whatsapp-otp/start`
    const otpRequest = (index: number, forwardedFor: string) =>
      otpApp.request(otpUrl, {
        body: JSON.stringify({ phoneNumber: `+14155555${String(index).padStart(3, "0")}` }),
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        method: "POST",
      })
    const untrustedOtpStatuses: number[] = []
    for (let index = 0; index < 6; index += 1)
      untrustedOtpStatuses.push((await otpRequest(index, `198.51.100.${50 + index}`)).status)
    expect(untrustedOtpStatuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
    expect(untrustedOtpStatuses[5]).toBe(429)

    const trustedOtpApp = whatsappOtpServerAppCreate({
      clientIpResolve: () => "203.0.113.40",
      database,
      rateLimitSecret,
      trustedProxyAddresses: ["203.0.113.40"],
      availability: available,
    })
    const trustedOtpRequest = (index: number, forwardedFor: string) =>
      trustedOtpApp.request(otpUrl, {
        body: JSON.stringify({ phoneNumber: `+14155556${String(index).padStart(3, "0")}` }),
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        method: "POST",
      })
    const trustedOtpStatuses: number[] = []
    for (let index = 0; index < 6; index += 1)
      trustedOtpStatuses.push((await trustedOtpRequest(index, `198.51.100.${70 + index}`)).status)
    expect(trustedOtpStatuses).toEqual([200, 200, 200, 200, 200, 200])
  })
})

test("availability and mutation public responses reject and omit WAHA internals and phone numbers", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "otp-public-boundary-task10.example.com")
    const endpointId = "private-endpoint-task10"
    const sessionName = "private-session-task10"
    const apiKey = "private-api-key-task10"
    const wahaUrl = "https://private-waha-task10.example.test"
    const phoneNumber = "+14155559001"
    const failingAvailability: WhatsappOtpAvailabilityPort = {
      whatsappOtpAvailabilityGet: () => ({
        code: "whatsapp-otp.read-failed",
        errorData: JSON.stringify({
          apiKey,
          endpointId,
          healthDetails: "private health response",
          phoneNumber,
          sessionName,
          url: wahaUrl,
        }),
        errorMessage: "The WhatsApp OTP availability could not be read.",
        op: "privateWahaHealthReader",
        success: false,
      }),
    }
    const otpApp = whatsappOtpServerAppCreate({ database, rateLimitSecret, availability: failingAvailability })
    const availabilityResponse = await otpApp.request(
      `https://otp-public-boundary-task10.example.com/realms/${realm.id}/whatsapp-otp/availability`,
    )
    const availabilityBody = await availabilityResponse.json()
    expect(v.safeParse(httpErrorResponseSchema, availabilityBody).success).toBe(true)
    expectPublicResponseSafe(availabilityBody, [
      endpointId,
      sessionName,
      apiKey,
      "private health response",
      wahaUrl,
      phoneNumber,
    ])
    expect((availabilityBody as { error?: { details?: unknown } }).error?.details).toBeUndefined()

    const otpMutationResponse = await otpApp.request(
      `https://otp-public-boundary-task10.example.com/realms/${realm.id}/whatsapp-otp/start`,
      {
        body: JSON.stringify({ phoneNumber }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    const otpMutationBody = await otpMutationResponse.json()
    expect(v.safeParse(httpErrorResponseSchema, otpMutationBody).success).toBe(true)
    expectPublicResponseSafe(otpMutationBody, [
      endpointId,
      sessionName,
      apiKey,
      "private health response",
      wahaUrl,
      phoneNumber,
    ])

    const passwordApp = passwordServerAppCreate({
      database,
      rateLimitSecret,
      whatsappAvailability: failingAvailability,
      whatsappDelivery: { sendText: async () => ({ data: undefined, success: true as const }) },
    })
    const passwordMutationResponse = await passwordApp.request(
      `https://otp-public-boundary-task10.example.com/realms/${realm.id}/password/register`,
      {
        body: JSON.stringify({
          email: "public-boundary@example.com",
          password: "Correct Horse 12",
          phoneNumber,
          profile: {},
          userName: "public-boundary",
          verificationMethod: "whatsapp",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    const passwordMutationBody = await passwordMutationResponse.json()
    expect(v.safeParse(httpErrorResponseSchema, passwordMutationBody).success).toBe(true)
    expectPublicResponseSafe(passwordMutationBody, [
      endpointId,
      sessionName,
      apiKey,
      "private health response",
      wahaUrl,
      phoneNumber,
    ])

    expect(
      v.safeParse(whatsappOtpAvailabilityResponseSchema, {
        available: false,
        endpointId,
        healthDetails: "private health response",
        sessionName,
      }).success,
    ).toBe(false)
    const mutationResponse = { accepted: true, challengeId: "challenge", expiresAt: 1, retryAt: 1, phoneNumber }
    expect(v.safeParse(whatsappOtpStartResponseSchema, mutationResponse).success).toBe(false)
    expect(v.safeParse(whatsappOtpResendResponseSchema, mutationResponse).success).toBe(false)
    expect(
      v.safeParse(passwordRegistrationResponseSchema, {
        accepted: true,
        endpointId,
        verificationRequired: true,
      }).success,
    ).toBe(false)
  })
})

test("enabled composition refreshes once at startup and mutations use cached health without synchronous scans", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-task10-composition-"))
  const databasePath = join(directory, "authworks.sqlite")
  const testkit = platformTestkitCreate()
  const seeded = storageDatabaseOpen(databasePath, testkit.runtime)
  expect(seeded.success).toBe(true)
  if (!seeded.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const realm = await createRealm(seeded.data, "otp-composition-task10.example.com")
  seeded.data.close()

  const originalFetch = globalThis.fetch
  const requests: string[] = []
  let releaseHealth: (() => void) | undefined
  let healthStarted!: () => void
  const healthStartedPromise = new Promise<void>((resolve) => {
    healthStarted = resolve
  })
  const healthGate = new Promise<void>((resolve) => {
    releaseHealth = resolve
  })
  globalThis.fetch = (async (input) => {
    const url = input.toString()
    requests.push(url)
    if (url.endsWith("/health")) {
      healthStarted()
      await healthGate
      return Response.json({ status: "ok" })
    }
    return Response.json([
      {
        name: "default",
        presence: null,
        status: "WORKING",
        timestamps: { activity: null },
      },
    ])
  }) as typeof fetch

  try {
    const created = serverApplicationCreate({
      databasePath,
      runtime: testkit.runtime,
      systemSecret: rateLimitSecret,
      wahaConfiguration: {
        endpoints: [{ client: { baseUrl: "https://waha-composition-task10.example.test" }, id: "primary" }],
        freshnessTtlMs: 60_000,
        refreshIntervalMs: 30_000,
      },
      whatsappDelivery: { sendText: async () => ({ data: undefined, success: true }) },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    await healthStartedPromise
    const immediate = await created.data.request(
      `https://otp-composition-task10.example.com/realms/${realm.id}/whatsapp-otp/availability`,
    )
    expect(await immediate.json()).toEqual({ available: false })
    expect(requests).toEqual(["https://waha-composition-task10.example.test/health"])

    releaseHealth?.()
    let availableBody: unknown = undefined
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const refreshed = await created.data.request(
        `https://otp-composition-task10.example.com/realms/${realm.id}/whatsapp-otp/availability`,
      )
      availableBody = await refreshed.json()
      if (JSON.stringify(availableBody) === JSON.stringify({ available: true })) break
    }
    expect(availableBody).toEqual({ available: true })
    expect(requests).toEqual([
      "https://waha-composition-task10.example.test/health",
      "https://waha-composition-task10.example.test/api/sessions?all=true",
    ])
    created.data.stop()
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { force: true, recursive: true })
  }
})

test("public OTP results and persistence never disclose phone, code, IP, or configured secrets", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createVerifiedPhoneUser(database, "otp-secrets-task10.example.com")
    let delivered: { challengeId: string; code: string } | undefined
    const phoneNumber = "+491701234567"
    const started = whatsappOtpStart({
      clientIp: "198.51.100.90",
      context: fixture.context,
      database,
      input: { phoneNumber },
      onDelivery: (value) => {
        delivered = { challengeId: value.challengeId, code: value.code }
      },
      rateLimitSecret,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      availability: available,
    })
    expect(started.success).toBe(true)
    expect(JSON.stringify(started)).not.toContain(phoneNumber)
    if (delivered === undefined) return
    expect(JSON.stringify(started)).not.toContain(delivered.code)
    expect(
      JSON.stringify(database.sqlite.query("SELECT code_hash, phone_hash FROM whatsapp_otp_challenges").all()),
    ).not.toContain(phoneNumber)
    expect(JSON.stringify(database.sqlite.query("SELECT key_hash FROM rate_limits").all())).not.toContain(
      "198.51.100.90",
    )
    expect(JSON.stringify(database.sqlite.query("SELECT payload FROM events").all())).not.toContain(delivered.code)
    expect(JSON.stringify(database.sqlite.query("SELECT payload FROM events").all())).not.toContain(phoneNumber)
    expect(JSON.stringify(whatsappOtpCodeHashCreate(delivered.challengeId, delivered.code))).not.toContain(
      delivered.code,
    )
    expect(JSON.stringify(whatsappOtpPhoneHashCreate(phoneNumber))).not.toContain(phoneNumber)
  })
})

async function expectRateLimited(response: Response): Promise<void> {
  expect(response.status).toBe(429)
  expect(response.headers.get("retry-after")).toBe("60")
  expect(await response.json()).toMatchObject({ error: { code: "rate_limited", status: 429 } })
}

function expectPublicResponseSafe(body: unknown, forbiddenValues: readonly string[]): void {
  const serialized = JSON.stringify(body)
  for (const value of forbiddenValues) expect(serialized).not.toContain(value)
}

async function createVerifiedPhoneUser(database: StorageDatabase, domain: string) {
  const realm = await createRealm(database, domain)
  const context = realmTenantContextCreate(realm.id, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${domain.replaceAll(".", "-")}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "Task ten user" },
      userName: domain.replaceAll(".", "-"),
    },
    realmId: realm.id,
    onVerificationToken: (value) => {
      token = value.token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId: realm.id })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  const user = userRepositoryCreate(database.db).userGet(realm.id, verified.data.user.id)
  expect(user.success).toBe(true)
  if (!user.success || user.data === null) throw new Error("The task ten user was not created")
  const normalizedPhone = userPhoneNumberNormalize("+491701234567")
  expect(normalizedPhone.success).toBe(true)
  if (!normalizedPhone.success) throw new Error(normalizedPhone.errorMessage)
  const updated = userRepositoryCreate(database.db).userUpdate(realm.id, user.data.id, {
    phoneNumber: normalizedPhone.data,
    phoneNumberVerifiedAt: database.runtime.now(),
    updatedAt: database.runtime.now(),
    version: user.data.version + 1,
  })
  expect(updated.success).toBe(true)
  return { context, realm, userId: user.data.id }
}

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-task10-"))
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

async function withDatabasePair<T>(
  operation: (
    first: StorageDatabase,
    second: StorageDatabase,
    testkit: ReturnType<typeof platformTestkitCreate>,
  ) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-whatsapp-task10-pair-"))
  const testkit = platformTestkitCreate()
  const path = join(directory, "authworks.sqlite")
  const first = storageDatabaseOpen(path, testkit.runtime)
  expect(first.success).toBe(true)
  if (!first.success) throw new Error(first.errorMessage)
  const second = storageDatabaseOpen(path, testkit.runtime)
  expect(second.success).toBe(true)
  if (!second.success) {
    first.data.close()
    throw new Error(second.errorMessage)
  }
  try {
    return await operation(first.data, second.data, testkit)
  } finally {
    first.data.close()
    second.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function runConcurrent<T>(count: number, operation: (index: number) => T): Promise<T[]> {
  return Promise.all(
    Array.from(
      { length: count },
      (_, index) =>
        new Promise<T>((resolve, reject) => {
          setTimeout(() => {
            try {
              resolve(operation(index))
            } catch (error) {
              reject(error)
            }
          }, 0)
        }),
    ),
  )
}

async function runConcurrentAsync<T>(count: number, operation: (index: number) => Promise<T>): Promise<T[]> {
  return Promise.all(
    Array.from(
      { length: count },
      (_, index) =>
        new Promise<T>((resolve, reject) => {
          setTimeout(() => {
            void operation(index).then(resolve, reject)
          }, 0)
        }),
    ),
  )
}
