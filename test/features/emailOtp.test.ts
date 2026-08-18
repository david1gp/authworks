import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { emailOtpApiClientCreate } from "../../src/features/emailOtp/client/emailOtpApiClientCreate.js"
import { emailOtpStart } from "../../src/features/emailOtp/actions/emailOtpStart.js"
import { emailOtpVerify } from "../../src/features/emailOtp/actions/emailOtpVerify.js"
import { emailOtpServerAppCreate } from "../../src/features/emailOtp/server/emailOtpServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-email-otp-"))
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

async function createVerifiedUser(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const context = realmTenantContextCreate(created.data.realm.id, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "otp@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "OTP User" },
      userName: "otp-user",
    },
    realmId: created.data.realm.id,
    onVerificationToken: ({ token }) => {
      verificationToken = token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({
    context,
    database,
    input: { token: verificationToken },
    realmId: created.data.realm.id,
  })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return { context, realm: created.data.realm, userId: verified.data.user.id }
}

test("email OTP authenticates once, applies cooldown, and calls ports after commit", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedUser(database, "email-otp.example.com")
    let delivery: { challengeId: string; code: string } | undefined
    const notifications: string[] = []
    const started = emailOtpStart({
      context,
      database,
      input: { email: " OTP@example.com " },
      realmId: realm.id,
      onDelivery: (value) => {
        delivery = value
        throw new Error("delivery must not roll back committed state")
      },
      onSecurityNotification: (value) => {
        notifications.push(value.kind)
        if (value.kind === "verified") throw new Error("notification must not roll back committed state")
      },
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    expect(started.data.challengeId).toBe(delivery.challengeId)
    expect(notifications).toEqual(["requested"])
    expect(database.sqlite.query("SELECT email_hash, code_hash FROM email_otp_challenges").get()).not.toEqual({
      email_hash: "OTP@example.com",
      code_hash: delivery.code,
    })
    expect(JSON.stringify(database.db.select().from(storageEventTable).all())).not.toContain(delivery.code)

    let resendCount = 0
    const cooldown = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      realmId: realm.id,
      onDelivery: () => {
        resendCount += 1
      },
      runtime: testkit.runtime,
    })
    expect(cooldown).toEqual(started)
    expect(resendCount).toBe(0)

    const beforeVerify = database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()
    const verified = emailOtpVerify({
      context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code },
      realmId: realm.id,
      onSecurityNotification: (value) => {
        notifications.push(value.kind)
      },
      runtime: testkit.runtime,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.session).toBeDefined()
    if (verified.data.session === undefined) return
    expect(verified.data.session.session.authenticationMethod).toBe("email_otp")
    expect(verified.data.session.session.assurance).toBe("authenticated")
    expect(notifications).toEqual(["requested", "verified"])
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).not.toEqual(beforeVerify)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: verified.data.session.token }).success).toBe(true)
    expect(
      emailOtpVerify({
        context,
        database,
        input: { challengeId: delivery.challengeId, code: delivery.code },
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)

    testkit.advance(60_000)
    let replacement: { challengeId: string; code: string } | undefined
    const resent = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      realmId: realm.id,
      onDelivery: (value) => {
        replacement = value
      },
      runtime: testkit.runtime,
    })
    expect(resent.success).toBe(true)
    expect(replacement?.challengeId).not.toBe(delivery.challengeId)
  })
})

test("required MFA turns email OTP authentication into a TOTP challenge", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm, userId } = await createVerifiedUser(database, "email-mfa.example.com")
    const enrollment = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "mfa-test-secret",
      realmId: realm.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(enrollment.success).toBe(true)
    if (!enrollment.success) return
    const enrollmentCode = mfaTotpCodeCreate(enrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(enrollmentCode.success).toBe(true)
    if (!enrollmentCode.success) return
    expect(
      mfaTotpEnrollmentConfirm({
        database,
        encryptionSecret: "mfa-test-secret",
        input: { code: enrollmentCode.data, enrollmentId: enrollment.data.enrollment.id },
        realmId: realm.id,
        runtime: testkit.runtime,
        userId,
      }).success,
    ).toBe(true)
    expect(
      mfaPolicySet({
        context: realmSystemContextCreate("system"),
        database,
        input: { lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 },
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)

    let delivery: { challengeId: string; code: string } | undefined
    const started = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      realmId: realm.id,
      onDelivery: (value) => {
        delivery = value
      },
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success || delivery === undefined) return
    const verified = emailOtpVerify({
      context,
      database,
      input: { challengeId: delivery.challengeId, code: delivery.code },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.challenge).toBeDefined()
    expect(verified.data.session).toBeUndefined()
    if (verified.data.challenge === undefined) return
    testkit.advance(30_000)
    const challengeCode = mfaTotpCodeCreate(enrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(challengeCode.success).toBe(true)
    if (!challengeCode.success) return
    const completed = mfaChallengeComplete({
      database,
      encryptionSecret: "mfa-test-secret",
      input: { code: challengeCode.data, token: verified.data.challenge.token },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(completed).toMatchObject({
      success: true,
      data: { session: { session: { assurance: "multi_factor", authenticationMethod: "email_otp" } } },
    })
  })
})

test("email OTP resists enumeration, tenant crossover, expiry, and attempts", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createVerifiedUser(database, "email-otp-alpha.example.com")
    const beta = await createVerifiedUser(database, "email-otp-beta.example.com")
    const failedNotifications: Array<{
      attempts?: number
      challengeId: string
      realmId: string
      kind: "failed" | "requested" | "verified"
      userId: string
    }> = []
    let knownCode = ""
    const known = emailOtpStart({
      context: alpha.context,
      database,
      input: { email: "otp@example.com" },
      realmId: alpha.realm.id,
      onDelivery: ({ code }) => {
        knownCode = code
      },
      runtime: testkit.runtime,
    })
    const unknown = emailOtpStart({
      context: alpha.context,
      database,
      input: { email: "missing@example.com" },
      realmId: alpha.realm.id,
      onDelivery: () => {
        throw new Error("unknown users must not receive delivery")
      },
      runtime: testkit.runtime,
    })
    expect(known.success).toBe(true)
    expect(unknown.success).toBe(true)
    if (!known.success || !unknown.success) return
    expect(Object.keys(known.data)).toEqual(Object.keys(unknown.data))
    expect(
      emailOtpVerify({
        context: beta.context,
        database,
        input: { challengeId: known.data.challengeId, code: knownCode },
        realmId: beta.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        emailOtpVerify({
          context: alpha.context,
          database,
          input: { challengeId: known.data.challengeId, code: "999999" },
          realmId: alpha.realm.id,
          onSecurityNotification: (value) => {
            failedNotifications.push(value)
          },
          runtime: testkit.runtime,
        }).success,
      ).toBe(false)
    }
    expect(failedNotifications).toEqual(
      Array.from({ length: 5 }, (_, index) => ({
        attempts: index + 1,
        challengeId: known.data.challengeId,
        realmId: alpha.realm.id,
        kind: "failed",
        userId: alpha.userId,
      })),
    )
    expect(
      emailOtpVerify({
        context: alpha.context,
        database,
        input: { challengeId: known.data.challengeId, code: knownCode },
        realmId: alpha.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT attempts, consumed_at FROM email_otp_challenges").all()).toContainEqual({
      attempts: 5,
      consumed_at: 1_700_000_000_000,
    })

    testkit.advance(60_001)
    let expiredChallenge = ""
    emailOtpStart({
      context: alpha.context,
      database,
      input: { email: "otp@example.com" },
      realmId: alpha.realm.id,
      onDelivery: ({ challengeId }) => {
        expiredChallenge = challengeId
      },
      runtime: testkit.runtime,
    })
    testkit.advance(10 * 60 * 1_000)
    expect(
      emailOtpVerify({
        context: alpha.context,
        database,
        input: { challengeId: expiredChallenge, code: "000000" },
        realmId: alpha.realm.id,
        onSecurityNotification: (value) => {
          failedNotifications.push(value)
        },
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(failedNotifications.at(-1)).toEqual({
      attempts: 0,
      challengeId: expiredChallenge,
      realmId: alpha.realm.id,
      kind: "failed",
      userId: alpha.userId,
    })
  })
})

test("email OTP invalidates an unconsumed challenge before issuing a replacement", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedUser(database, "email-otp-replay.example.com")
    let first: { challengeId: string; code: string } | undefined
    const firstStarted = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      realmId: realm.id,
      onDelivery: (value) => {
        first = value
      },
      runtime: testkit.runtime,
    })
    expect(firstStarted.success).toBe(true)
    expect(first).toBeDefined()
    if (!firstStarted.success || first === undefined) return

    testkit.advance(60_000)
    let replacement: { challengeId: string; code: string } | undefined
    const replacementStarted = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      realmId: realm.id,
      onDelivery: (value) => {
        replacement = value
      },
      runtime: testkit.runtime,
    })
    expect(replacementStarted.success).toBe(true)
    expect(replacement).toBeDefined()
    if (!replacementStarted.success || replacement === undefined) return

    expect(
      emailOtpVerify({
        context,
        database,
        input: { challengeId: first.challengeId, code: first.code },
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(
      emailOtpVerify({
        context,
        database,
        input: { challengeId: replacement.challengeId, code: replacement.code },
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
  })
})

test("email OTP challenge and session writes roll back with event failures", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedUser(database, "email-otp-atomic.example.com")
    database.sqlite.run(
      "CREATE TRIGGER reject_email_otp_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'email_otp' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const rejected = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(rejected.success).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM email_otp_challenges").get()).toEqual({ count: 0 })
    database.sqlite.run("DROP TRIGGER reject_email_otp_events")

    let code = ""
    const started = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      realmId: realm.id,
      onDelivery: (value) => {
        code = value.code
      },
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    database.sqlite.run(
      "CREATE TRIGGER reject_email_otp_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'email_otp' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const before = database.sqlite.query("SELECT consumed_at, version FROM email_otp_challenges").get()
    const sessionCount = database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()
    expect(
      emailOtpVerify({
        context,
        database,
        input: { challengeId: started.data.challengeId, code },
        realmId: realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT consumed_at, version FROM email_otp_challenges").get()).toEqual(before)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual(sessionCount)
  })
})

test("email OTP HTTP and client contracts expose no code material", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm } = await createVerifiedUser(database, "email-otp-api.example.com")
    let code = ""
    const app = emailOtpServerAppCreate({
      database,
      onDelivery: ({ code: delivered }) => {
        code = delivered
      },
    })
    const client = emailOtpApiClientCreate({
      baseUrl: "https://email-otp-api.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const started = await client.emailOtpStart(realm.id, { email: "otp@example.com" })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(JSON.stringify(started.data)).not.toContain(code)
    const verified = await client.emailOtpVerify(realm.id, { challengeId: started.data.challengeId, code })
    expect(verified.success).toBe(true)
    expect(testkit.runtime.now()).toBe(1_700_000_000_000)
  })
})
