import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { emailOtpApiClientCreate } from "../../src/features/emailOtp/client/emailOtpApiClientCreate.js"
import { emailOtpStart } from "../../src/features/emailOtp/actions/emailOtpStart.js"
import { emailOtpVerify } from "../../src/features/emailOtp/actions/emailOtpVerify.js"
import { emailOtpServerAppCreate } from "../../src/features/emailOtp/server/emailOtpServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-email-otp-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), testkit.runtime)
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
  const created = instanceCreate({
    context: instanceSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const context = instanceTenantContextCreate(created.data.instance.id, "anonymous")
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
    instanceId: created.data.instance.id,
    onVerificationToken: ({ token }) => {
      verificationToken = token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({
    context,
    database,
    input: { token: verificationToken },
    instanceId: created.data.instance.id,
  })
  expect(verified.success).toBe(true)
  return { context, instance: created.data.instance }
}

test("email OTP authenticates once, applies cooldown, and calls ports after commit", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, instance } = await createVerifiedUser(database, "email-otp.example.com")
    let delivery: { challengeId: string; code: string } | undefined
    const notifications: string[] = []
    const started = emailOtpStart({
      context,
      database,
      input: { email: " OTP@example.com " },
      instanceId: instance.id,
      onDelivery: (value) => {
        delivery = value
        throw new Error("delivery must not roll back committed state")
      },
      onSecurityNotification: (value) => {
        notifications.push(value.kind)
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
      instanceId: instance.id,
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
      instanceId: instance.id,
      onSecurityNotification: (value) => {
        notifications.push(value.kind)
      },
      runtime: testkit.runtime,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.session.session.authenticationMethod).toBe("email_otp")
    expect(verified.data.session.session.assurance).toBe("authenticated")
    expect(notifications).toEqual(["requested", "verified"])
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).not.toEqual(beforeVerify)
    expect(sessionAuthenticate({ database, instanceId: instance.id, token: verified.data.session.token }).success).toBe(
      true,
    )
    expect(
      emailOtpVerify({
        context,
        database,
        input: { challengeId: delivery.challengeId, code: delivery.code },
        instanceId: instance.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)

    testkit.advance(60_001)
    let replacement: { challengeId: string; code: string } | undefined
    const resent = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      instanceId: instance.id,
      onDelivery: (value) => {
        replacement = value
      },
      runtime: testkit.runtime,
    })
    expect(resent.success).toBe(true)
    expect(replacement?.challengeId).not.toBe(delivery.challengeId)
  })
})

test("email OTP resists enumeration, tenant crossover, expiry, and attempts", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createVerifiedUser(database, "email-otp-alpha.example.com")
    const beta = await createVerifiedUser(database, "email-otp-beta.example.com")
    let knownCode = ""
    const known = emailOtpStart({
      context: alpha.context,
      database,
      input: { email: "otp@example.com" },
      instanceId: alpha.instance.id,
      onDelivery: ({ code }) => {
        knownCode = code
      },
      runtime: testkit.runtime,
    })
    const unknown = emailOtpStart({
      context: alpha.context,
      database,
      input: { email: "missing@example.com" },
      instanceId: alpha.instance.id,
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
        instanceId: beta.instance.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        emailOtpVerify({
          context: alpha.context,
          database,
          input: { challengeId: known.data.challengeId, code: "999999" },
          instanceId: alpha.instance.id,
          runtime: testkit.runtime,
        }).success,
      ).toBe(false)
    }
    expect(
      emailOtpVerify({
        context: alpha.context,
        database,
        input: { challengeId: known.data.challengeId, code: knownCode },
        instanceId: alpha.instance.id,
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
      instanceId: alpha.instance.id,
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
        instanceId: alpha.instance.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
  })
})

test("email OTP challenge and session writes roll back with event failures", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, instance } = await createVerifiedUser(database, "email-otp-atomic.example.com")
    database.sqlite.run(
      "CREATE TRIGGER reject_email_otp_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'email_otp' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const rejected = emailOtpStart({
      context,
      database,
      input: { email: "otp@example.com" },
      instanceId: instance.id,
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
      instanceId: instance.id,
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
        instanceId: instance.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT consumed_at, version FROM email_otp_challenges").get()).toEqual(before)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual(sessionCount)
  })
})

test("email OTP HTTP and client contracts expose no code material", async () => {
  await withDatabase(async (database, testkit) => {
    const { instance } = await createVerifiedUser(database, "email-otp-api.example.com")
    let code = ""
    const app = emailOtpServerAppCreate({
      database,
      onDelivery: ({ code: delivered }) => {
        code = delivered
      },
    })
    const client = emailOtpApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const started = await client.emailOtpStart(instance.id, { email: "otp@example.com" })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(JSON.stringify(started.data)).not.toContain(code)
    const verified = await client.emailOtpVerify(instance.id, { challengeId: started.data.challengeId, code })
    expect(verified.success).toBe(true)
    expect(testkit.runtime.now()).toBe(1_700_000_000_000)
  })
})
