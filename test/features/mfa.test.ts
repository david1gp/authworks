import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/public/sessionPasswordCreate.js"
import { mfaApiClientCreate } from "../../src/features/mfa/client/mfaApiClientCreate.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaRecoveryCodeVerify } from "../../src/features/mfa/actions/mfaRecoveryCodeVerify.js"
import { mfaRecoveryCodesGenerate } from "../../src/features/mfa/actions/mfaRecoveryCodesGenerate.js"
import { mfaStepUpComplete } from "../../src/features/mfa/actions/mfaStepUpComplete.js"
import { mfaStepUpStart } from "../../src/features/mfa/actions/mfaStepUpStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { mfaTotpCodeVerify } from "../../src/features/mfa/domain/mfaTotpCodeVerify.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpVerify } from "../../src/features/mfa/actions/mfaTotpVerify.js"
import { mfaServerAppCreate } from "../../src/features/mfa/server/mfaServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-mfa-"))
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

async function createUser(database: StorageDatabase, domain: string) {
  const instance = instanceCreate({
    context: instanceSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(instance.success).toBe(true)
  if (!instance.success) throw new Error(instance.errorMessage)
  const context = instanceTenantContextCreate(instance.data.instance.id, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${domain}@example.com`,
      password: "Correct Horse 12",
      profile: {},
      userName: domain.replaceAll(".", "-"),
    },
    instanceId: instance.data.instance.id,
    onVerificationToken: (delivery) => {
      token = delivery.token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, instanceId: instance.data.instance.id })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return { context, instance: instance.data.instance, userId: verified.data.user.id }
}

async function enrollTotp(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  instanceId: string,
  userId: string,
) {
  const started = mfaTotpEnrollmentStart({
    database,
    encryptionSecret: "mfa-test-secret",
    instanceId,
    runtime: testkit.runtime,
    userId,
  })
  expect(started.success).toBe(true)
  if (!started.success) throw new Error(started.errorMessage)
  const code = mfaTotpCodeCreate(started.data.secret, Math.floor(testkit.runtime.now() / 30_000))
  expect(code.success).toBe(true)
  if (!code.success) throw new Error(code.errorMessage)
  const confirmed = mfaTotpEnrollmentConfirm({
    database,
    encryptionSecret: "mfa-test-secret",
    input: { code: code.data, enrollmentId: started.data.enrollment.id },
    instanceId,
    runtime: testkit.runtime,
    userId,
  })
  expect(confirmed.success).toBe(true)
  if (!confirmed.success) throw new Error(confirmed.errorMessage)
  expect(started.data.otpauthUri).toContain("otpauth://totp/")
  return { secret: started.data.secret, enrollmentId: started.data.enrollment.id }
}

test("TOTP follows RFC values, enforces a bounded time window, and rejects replay", async () => {
  expect(mfaTotpCodeCreate("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1)).toEqual({ data: "287082", success: true })
  expect(mfaTotpCodeVerify("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "287082", 30_000, 0)).toEqual({ data: 1, success: true })
  expect(mfaTotpCodeVerify("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "287082", 60_000, 0).success).toBe(false)
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "totp.example.com")
    const enrolled = await enrollTotp(database, testkit, fixture.instance.id, fixture.userId)
    testkit.advance(30_000)
    const code = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(code.success).toBe(true)
    if (!code.success) return
    expect(
      mfaTotpVerify({
        database,
        encryptionSecret: "mfa-test-secret",
        code: code.data,
        instanceId: fixture.instance.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(true)
    expect(
      mfaTotpVerify({
        database,
        encryptionSecret: "mfa-test-secret",
        code: code.data,
        instanceId: fixture.instance.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
  })
})

test("enrollment and recovery codes are tenant-scoped, protected, and single-use", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createUser(database, "mfa-alpha.example.com")
    const beta = await createUser(database, "mfa-beta.example.com")
    const enrolled = await enrollTotp(database, testkit, alpha.instance.id, alpha.userId)
    const generated = mfaRecoveryCodesGenerate({ database, instanceId: alpha.instance.id, userId: alpha.userId })
    expect(generated.success).toBe(true)
    if (!generated.success) return
    const code = generated.data.codes[0]!
    expect(database.sqlite.query("SELECT encrypted_secret FROM mfa_totp_enrollments").get()).not.toEqual({
      encrypted_secret: enrolled.secret,
    })
    expect(JSON.stringify(database.sqlite.query("SELECT payload FROM events").all())).not.toContain(code)
    expect(mfaRecoveryCodeVerify({ code, database, instanceId: beta.instance.id, userId: beta.userId }).success).toBe(
      false,
    )
    expect(mfaRecoveryCodeVerify({ code, database, instanceId: alpha.instance.id, userId: alpha.userId }).success).toBe(
      true,
    )
    expect(mfaRecoveryCodeVerify({ code, database, instanceId: alpha.instance.id, userId: alpha.userId }).success).toBe(
      false,
    )
  })
})

test("MFA policy creates a login challenge and step-up rotates the session atomically", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "mfa-login.example.com")
    const enrolled = await enrollTotp(database, testkit, fixture.instance.id, fixture.userId)
    const login = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "mfa-login-example-com", password: "Correct Horse 12" },
      instanceId: fixture.instance.id,
      runtime: testkit.runtime,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const stepUp = mfaStepUpStart({
      database,
      instanceId: fixture.instance.id,
      sessionId: login.data.session.session.id,
      userId: fixture.userId,
      runtime: testkit.runtime,
    })
    expect(stepUp.success).toBe(true)
    if (!stepUp.success) return
    testkit.advance(30_000)
    const nextCode = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    if (!nextCode.success) return
    const upgraded = mfaStepUpComplete({
      database,
      encryptionSecret: "mfa-test-secret",
      input: { code: nextCode.data, token: stepUp.data.token },
      instanceId: fixture.instance.id,
      runtime: testkit.runtime,
      sessionToken: login.data.session.token,
    })
    expect(upgraded).toMatchObject({
      success: true,
      data: { session: { session: { assurance: "multi_factor", mfaMethod: "totp" } } },
    })
    if (!upgraded.success) return
    expect(
      sessionAuthenticate({ database, instanceId: fixture.instance.id, token: login.data.session.token }).success,
    ).toBe(false)
    const authenticated = sessionAuthenticate({
      database,
      instanceId: fixture.instance.id,
      token: upgraded.data.session!.token,
    })
    expect(authenticated.success).toBe(true)
    if (authenticated.success) expect(authenticated.data.session.assurance).toBe("multi_factor")

    const policy = mfaPolicySet({
      context: instanceSystemContextCreate("system"),
      database,
      input: { lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 },
      instanceId: fixture.instance.id,
      runtime: testkit.runtime,
    })
    expect(policy.success).toBe(true)
    testkit.advance(30_000)
    const challenged = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "mfa-login-example-com", password: "Correct Horse 12" },
      instanceId: fixture.instance.id,
      runtime: testkit.runtime,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(challenged.success && challenged.data.challenge).toBeTruthy()
    if (!challenged.success || challenged.data.challenge === undefined) return
    const loginCode = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    if (!loginCode.success) return
    const completedLogin = mfaChallengeComplete({
      database,
      encryptionSecret: "mfa-test-secret",
      input: { code: loginCode.data, token: challenged.data.challenge.token },
      instanceId: fixture.instance.id,
      runtime: testkit.runtime,
    })
    expect(completedLogin.success).toBe(true)
    if (completedLogin.success) expect(completedLogin.data.session?.session.assurance).toBe("multi_factor")
  })
})

test("MFA event failures roll back state, and the API client/CLI surfaces remain public-safe", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "mfa-api.example.com")
    const started = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "mfa-test-secret",
      instanceId: fixture.instance.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    database.sqlite.run(
      "CREATE TRIGGER reject_mfa_events BEFORE INSERT ON events WHEN NEW.aggregate_type LIKE 'mfa_%' BEGIN SELECT RAISE(ABORT, 'rejected'); END",
    )
    const code = mfaTotpCodeCreate(started.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    if (!code.success) return
    expect(
      mfaTotpEnrollmentConfirm({
        database,
        encryptionSecret: "mfa-test-secret",
        input: { code: code.data, enrollmentId: started.data.enrollment.id },
        instanceId: fixture.instance.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
    expect(
      database.sqlite.query("SELECT status FROM mfa_totp_enrollments WHERE id = ?").get(started.data.enrollment.id),
    ).toEqual({ status: "pending" })
    database.sqlite.run("DROP TRIGGER reject_mfa_events")
    const login = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "mfa-api-example-com", password: "Correct Horse 12" },
      instanceId: fixture.instance.id,
      runtime: testkit.runtime,
      sessionCreate: sessionPasswordCreate(),
    })
    if (!login.success || login.data.session === undefined) return
    const app = mfaServerAppCreate({ database, encryptionSecret: "mfa-test-secret", systemSecret: "system-secret" })
    const client = mfaApiClientCreate({
      baseUrl: "http://mfa.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: login.data.session.token,
      systemToken: "system-secret",
    })
    const unauthenticatedPolicy = await mfaApiClientCreate({
      baseUrl: "http://mfa.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).mfaPolicyGet(fixture.instance.id)
    expect(unauthenticatedPolicy.success).toBe(false)
    const policy = await client.mfaPolicyGet(fixture.instance.id)
    expect(policy.success).toBe(true)
    const apiStarted = await client.mfaTotpEnrollmentStart(fixture.instance.id)
    expect(apiStarted.success).toBe(true)
    expect(apiStarted.success ? JSON.stringify(apiStarted.data) : "").not.toContain("encrypted_secret")
    const help = Bun.spawn(["bun", "src/outputs/cli.ts", "mfa", "--help"], { stderr: "pipe", stdout: "pipe" })
    expect(await help.exited).toBe(0)
    expect(await new Response(help.stdout).text()).toContain("multi-factor")
    expect(
      database.db
        .select()
        .from(storageEventTable)
        .all()
        .every((event) => !JSON.stringify(event.payload).includes(started.data.secret)),
    ).toBe(true)
  })
})
