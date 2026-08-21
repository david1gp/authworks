import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaRecoveryCodesGenerate } from "../../src/features/mfa/actions/mfaRecoveryCodesGenerate.js"
import { mfaRecoveryCodeVerify } from "../../src/features/mfa/actions/mfaRecoveryCodeVerify.js"
import { mfaStepUpComplete } from "../../src/features/mfa/actions/mfaStepUpComplete.js"
import { mfaStepUpStart } from "../../src/features/mfa/actions/mfaStepUpStart.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentRemove } from "../../src/features/mfa/actions/mfaTotpEnrollmentRemove.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpVerify } from "../../src/features/mfa/actions/mfaTotpVerify.js"
import { mfaApiClientCreate } from "../../src/features/mfa/client/mfaApiClientCreate.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { mfaTotpCodeVerify } from "../../src/features/mfa/domain/mfaTotpCodeVerify.js"
import { mfaServerAppCreate } from "../../src/features/mfa/server/mfaServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-"))
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

async function createUser(database: StorageDatabase, domain: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
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
    realmId: realm.data.realm.id,
    onVerificationToken: (delivery) => {
      token = delivery.token
    },
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId: realm.data.realm.id })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return { context, realm: realm.data.realm, userId: verified.data.user.id }
}

async function enrollTotp(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  userId: string,
) {
  const started = mfaTotpEnrollmentStart({
    database,
    encryptionSecret: "mfa-test-secret",
    realmId,
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
    realmId,
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
    expect(
      mfaTotpVerify({
        code: "000000",
        database,
        encryptionSecret: "mfa-test-secret",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
    const enrolled = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    testkit.advance(30_000)
    const code = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(code.success).toBe(true)
    if (!code.success) return
    expect(
      mfaTotpVerify({
        database,
        encryptionSecret: "mfa-test-secret",
        code: code.data,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(true)
    expect(
      mfaTotpVerify({
        database,
        encryptionSecret: "mfa-test-secret",
        code: code.data,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
  })
})

test("TOTP applies the configured window and resets existing failed attempts after a valid code", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "totp-window.example.com")
    const enrolled = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const policy = mfaPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { lockoutDurationMs: 1_000, maxAttempts: 5, mode: "optional", totpWindow: 0 },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(policy.success).toBe(true)

    testkit.advance(60_000)
    const currentStep = Math.floor(testkit.runtime.now() / 30_000)
    const previousCode = mfaTotpCodeCreate(enrolled.secret, currentStep - 1)
    const nextCode = mfaTotpCodeCreate(enrolled.secret, currentStep + 1)
    const currentCode = mfaTotpCodeCreate(enrolled.secret, currentStep)
    expect(previousCode.success && nextCode.success && currentCode.success).toBe(true)
    if (!previousCode.success || !nextCode.success || !currentCode.success) return
    database.sqlite.run(
      "UPDATE mfa_lockouts SET failed_attempts = ?, locked_until = ?, updated_at = ?, version = ? WHERE realm_id = ? AND user_id = ?",
      [2, null, testkit.runtime.now(), 2, fixture.realm.id, fixture.userId],
    )

    expect(
      mfaTotpVerify({
        code: previousCode.data,
        database,
        encryptionSecret: "mfa-test-secret",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
    expect(
      mfaTotpVerify({
        code: nextCode.data,
        database,
        encryptionSecret: "mfa-test-secret",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
    expect(
      mfaTotpVerify({
        code: currentCode.data,
        database,
        encryptionSecret: "mfa-test-secret",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(true)
    expect(
      database.sqlite
        .query("SELECT failed_attempts, locked_until FROM mfa_lockouts WHERE user_id = ?")
        .get(fixture.userId),
    ).toEqual({
      failed_attempts: 0,
      locked_until: null,
    })
  })
})

test("TOTP lockout blocks verification until expiry", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "totp-lockout.example.com")
    const enrolled = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    testkit.advance(30_000)
    const currentStep = Math.floor(testkit.runtime.now() / 30_000)
    const validCode = mfaTotpCodeCreate(enrolled.secret, currentStep)
    expect(validCode.success).toBe(true)
    if (!validCode.success) return
    database.sqlite.run(
      "UPDATE mfa_lockouts SET failed_attempts = ?, locked_until = ?, updated_at = ?, version = ? WHERE realm_id = ? AND user_id = ?",
      [2, testkit.runtime.now() + 1_000, testkit.runtime.now(), 2, fixture.realm.id, fixture.userId],
    )
    expect(
      mfaTotpVerify({
        code: validCode.data,
        database,
        encryptionSecret: "mfa-test-secret",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)

    testkit.advance(1_001)
    expect(
      mfaTotpVerify({
        code: validCode.data,
        database,
        encryptionSecret: "mfa-test-secret",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(true)
  })
})

test("TOTP failed attempts persist and create lockout at the configured threshold", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "totp-failed-attempts.example.com")
    const enrolled = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const policy = mfaPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { lockoutDurationMs: 1_000, maxAttempts: 3, mode: "optional", totpWindow: 0 },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(policy.success).toBe(true)

    const validCode = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(validCode.success).toBe(true)
    if (!validCode.success) return
    const invalidCode = validCode.data === "000000" ? "000001" : "000000"
    const expectedAttempts = [1, 2, 3]
    for (const attempts of expectedAttempts) {
      expect(
        mfaTotpVerify({
          code: invalidCode,
          database,
          encryptionSecret: "mfa-test-secret",
          realmId: fixture.realm.id,
          runtime: testkit.runtime,
          userId: fixture.userId,
        }).success,
      ).toBe(false)
      expect(
        database.sqlite
          .query("SELECT failed_attempts, locked_until FROM mfa_lockouts WHERE realm_id = ? AND user_id = ?")
          .get(fixture.realm.id, fixture.userId),
      ).toEqual({
        failed_attempts: attempts,
        locked_until: attempts === 3 ? testkit.runtime.now() + 1_000 : null,
      })
    }
    expect(
      mfaTotpVerify({
        code: validCode.data,
        database,
        encryptionSecret: "mfa-test-secret",
        realmId: fixture.realm.id,
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
    const enrolled = await enrollTotp(database, testkit, alpha.realm.id, alpha.userId)
    const generated = mfaRecoveryCodesGenerate({ database, realmId: alpha.realm.id, userId: alpha.userId })
    expect(generated.success).toBe(true)
    if (!generated.success) return
    const code = generated.data.codes[0]!
    expect(database.sqlite.query("SELECT encrypted_secret FROM mfa_totp_enrollments").get()).not.toEqual({
      encrypted_secret: enrolled.secret,
    })
    expect(JSON.stringify(database.sqlite.query("SELECT payload FROM events").all())).not.toContain(code)
    expect(mfaRecoveryCodeVerify({ code, database, realmId: beta.realm.id, userId: beta.userId }).success).toBe(false)
    expect(mfaRecoveryCodeVerify({ code, database, realmId: alpha.realm.id, userId: alpha.userId }).success).toBe(true)
    expect(mfaRecoveryCodeVerify({ code, database, realmId: alpha.realm.id, userId: alpha.userId }).success).toBe(false)
  })
})

test("MFA policy creates a login challenge and step-up rotates the session atomically", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "mfa-login.example.com")
    const enrolled = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const login = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "mfa-login-example-com", password: "Correct Horse 12" },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const stepUp = mfaStepUpStart({
      database,
      realmId: fixture.realm.id,
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
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      sessionToken: login.data.session.token,
    })
    expect(upgraded).toMatchObject({
      success: true,
      data: { session: { session: { assurance: "multi_factor", mfaMethod: "totp" } } },
    })
    if (!upgraded.success) return
    expect(sessionAuthenticate({ database, realmId: fixture.realm.id, token: login.data.session.token }).success).toBe(
      false,
    )
    const authenticated = sessionAuthenticate({
      database,
      realmId: fixture.realm.id,
      token: upgraded.data.session!.token,
    })
    expect(authenticated.success).toBe(true)
    if (authenticated.success) expect(authenticated.data.session.assurance).toBe("multi_factor")

    const policy = mfaPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(policy.success).toBe(true)
    expect(
      mfaPolicySet({
        context: fixture.context,
        database,
        input: { lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 },
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(
      mfaPolicySet({
        context: realmSystemContextCreate("system"),
        database,
        input: { lockoutDurationMs: 900_000, maxAttempts: 0, mode: "required", totpWindow: 1 },
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    testkit.advance(30_000)
    const challenged = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "mfa-login-example-com", password: "Correct Horse 12" },
      realmId: fixture.realm.id,
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
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(completedLogin.success).toBe(true)
    if (completedLogin.success) expect(completedLogin.data.session?.session.assurance).toBe("multi_factor")
    expect(
      mfaStepUpComplete({
        database,
        encryptionSecret: "mfa-test-secret",
        input: { code: nextCode.data, token: stepUp.data.token },
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        sessionToken: login.data.session.token,
      }).success,
    ).toBe(false)
    expect(
      mfaTotpEnrollmentRemove({
        database,
        enrollmentId: enrolled.enrollmentId,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        sessionToken: login.data.session.token,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
    expect(
      mfaTotpEnrollmentRemove({
        database,
        enrollmentId: enrolled.enrollmentId,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        sessionToken: upgraded.data.session!.token,
        userId: fixture.userId,
      }).success,
    ).toBe(true)
    expect(
      mfaTotpVerify({
        database,
        encryptionSecret: "mfa-test-secret",
        code: loginCode.data,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
  })
})

test("recovery-code event failure does not consume the code", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "mfa-recovery-rollback.example.com")
    await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const generated = mfaRecoveryCodesGenerate({ database, realmId: fixture.realm.id, userId: fixture.userId })
    expect(generated.success).toBe(true)
    if (!generated.success) return

    expect(
      mfaRecoveryCodeVerify({ code: "", database, realmId: fixture.realm.id, userId: fixture.userId }).success,
    ).toBe(false)
    expect(
      mfaRecoveryCodeVerify({ code: "short", database, realmId: fixture.realm.id, userId: fixture.userId }).success,
    ).toBe(false)
    database.sqlite.run(
      "CREATE TRIGGER reject_mfa_recovery_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'mfa_recovery_code' BEGIN SELECT RAISE(ABORT, 'rejected'); END",
    )
    expect(
      mfaRecoveryCodeVerify({
        code: generated.data.codes[0]!,
        database,
        realmId: fixture.realm.id,
        userId: fixture.userId,
      }).success,
    ).toBe(false)
    expect(
      database.sqlite
        .query("SELECT consumed_at FROM mfa_recovery_codes WHERE realm_id = ? AND user_id = ?")
        .all(fixture.realm.id, fixture.userId)
        .every((row) => (row as { consumed_at: number | null }).consumed_at === null),
    ).toBe(true)
  })
})

test("MFA event failures roll back state, and the API client/CLI surfaces remain public-safe", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "mfa-api.example.com")
    const started = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "mfa-test-secret",
      realmId: fixture.realm.id,
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
        realmId: fixture.realm.id,
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
      realmId: fixture.realm.id,
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
    }).mfaPolicyGet(fixture.realm.id)
    expect(unauthenticatedPolicy.success).toBe(false)
    const policy = await client.mfaPolicyGet(fixture.realm.id)
    expect(policy.success).toBe(true)
    const apiStarted = await client.mfaTotpEnrollmentStart(fixture.realm.id)
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

test("MFA browser completion issues and upgrades an HttpOnly session cookie without disclosing credentials", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "mfa-browser.example.com")
    const enrolled = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    expect(
      mfaPolicySet({
        context: realmSystemContextCreate("system"),
        database,
        input: { lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 },
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    const login = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "mfa-browser-example-com", password: "Correct Horse 12" },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success && login.data.challenge).toBeTruthy()
    if (!login.success || login.data.challenge === undefined) return
    const app = mfaServerAppCreate({
      browserMode: true,
      database,
      encryptionSecret: "mfa-test-secret",
      publicOrigin: "https://mfa-browser.example.com",
    })
    testkit.advance(30_000)
    const loginCode = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(loginCode.success).toBe(true)
    if (!loginCode.success) return
    const completedLogin = await app.request(
      `https://mfa-browser.example.com/realms/${fixture.realm.id}/mfa/challenge/complete`,
      {
        body: JSON.stringify({ code: loginCode.data, token: login.data.challenge.token }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(completedLogin.status).toBe(200)
    const loginCookie = completedLogin.headers.get("set-cookie") ?? ""
    const loginToken = /^session=([^;]+);/.exec(loginCookie)?.[1]
    const loginBody = (await completedLogin.json()) as { session?: unknown }
    expect(loginToken).toHaveLength(43)
    expect(loginBody.session).toBeUndefined()
    if (loginToken === undefined) return

    const csrfToken = sessionCsrfTokenCreate(testkit.runtime)
    const headers = {
      cookie: `${loginCookie.split(";", 1)[0]}; csrf=${csrfToken}`,
      origin: "https://mfa-browser.example.com",
      "x-csrf-token": csrfToken,
    }
    const stepUpStarted = await app.request(
      `https://mfa-browser.example.com/realms/${fixture.realm.id}/mfa/step-up/start`,
      {
        headers,
        method: "POST",
      },
    )
    expect(stepUpStarted.status).toBe(200)
    const stepUpBody = (await stepUpStarted.json()) as { token: string }
    testkit.advance(30_000)
    const stepUpCode = mfaTotpCodeCreate(enrolled.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(stepUpCode.success).toBe(true)
    if (!stepUpCode.success) return
    const upgraded = await app.request(
      `https://mfa-browser.example.com/realms/${fixture.realm.id}/mfa/step-up/complete`,
      {
        body: JSON.stringify({ code: stepUpCode.data, token: stepUpBody.token }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(upgraded.status).toBe(200)
    const rotatedCookie = upgraded.headers.get("set-cookie") ?? ""
    const rotatedToken = /^session=([^;]+);/.exec(rotatedCookie)?.[1]
    const upgradedBody = (await upgraded.json()) as { session?: unknown }
    expect(rotatedToken).toHaveLength(43)
    expect(upgradedBody.session).toBeUndefined()
    expect(sessionAuthenticate({ database, realmId: fixture.realm.id, token: loginToken }).success).toBe(false)
    if (rotatedToken !== undefined)
      expect(sessionAuthenticate({ database, realmId: fixture.realm.id, token: rotatedToken }).success).toBe(true)
  })
})
