import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaChallengeFactorSelect } from "../../src/features/mfa/actions/mfaChallengeFactorSelect.js"
import { mfaEmailOtpStart } from "../../src/features/mfa/actions/mfaEmailOtpStart.js"
import { mfaLoginChallengeStart } from "../../src/features/mfa/actions/mfaLoginChallengeStart.js"
import { mfaPasskeyComplete } from "../../src/features/mfa/actions/mfaPasskeyComplete.js"
import { mfaRecoveryCodesGenerate } from "../../src/features/mfa/actions/mfaRecoveryCodesGenerate.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { mfaLoginChallengeContextGet } from "../../src/features/mfa/server/mfaLoginChallengeContextGet.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { organizationLoginPolicyFactorOrderResolve } from "../../src/features/organizations/domain/organizationLoginPolicyFactorOrderResolve.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../src/platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-mfa-task10-"))
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

async function createUser(database: StorageDatabase, suffix: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain: `${suffix}.example.com`, name: suffix },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${suffix}@example.com`,
      password: "Correct Horse 12",
      profile: {},
      userName: suffix,
    },
    onVerificationToken: (delivery) => {
      token = delivery.token
    },
    realmId: realm.data.realm.id,
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId: realm.data.realm.id })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return { context, realm: realm.data.realm, userId: verified.data.user.id }
}

async function createOrganization(database: StorageDatabase, realmId: string, name: string) {
  const created = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.organization
}

async function setOrganizationPolicy(
  database: StorageDatabase,
  realmId: string,
  organizationId: string,
  input: Parameters<typeof organizationLoginPolicySet>[0]["input"],
) {
  const saved = organizationLoginPolicySet({
    context: realmSystemContextCreate("system"),
    database,
    input,
    organizationId,
    realmId,
  })
  expect(saved.success).toBe(true)
  if (!saved.success) throw new Error(saved.errorMessage)
  return saved.data.policy
}

async function enrollTotp(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  userId: string,
) {
  const started = mfaTotpEnrollmentStart({
    database,
    encryptionSecret: "task10-mfa-secret",
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
    encryptionSecret: "task10-mfa-secret",
    input: { code: code.data, enrollmentId: started.data.enrollment.id },
    realmId,
    runtime: testkit.runtime,
    userId,
  })
  expect(confirmed.success).toBe(true)
  if (!confirmed.success) throw new Error(confirmed.errorMessage)
  return started.data.secret
}

test("Task 10 accepts every distinct primary/factor pair and keeps WhatsApp primary-only", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task10-matrix")
    const organization = await createOrganization(database, fixture.realm.id, "Task 10 matrix")
    const factors = ["totp", "email_otp", "passkey"] as const
    const primaryMethods = ["password", "email_otp", "external_identity", "passkey", "whatsapp_otp"] as const

    for (const primaryAuthenticationMethod of primaryMethods) {
      for (const factor of factors) {
        const started = mfaLoginChallengeStart({
          database,
          factor,
          organizationId: organization.id,
          policyDatabase: database,
          primaryAuthenticationMethod,
          purpose: "login",
          realmId: fixture.realm.id,
          runtime: testkit.runtime,
          runtimeAvailableFactors: factors,
          userId: fixture.userId,
        })
        if (primaryAuthenticationMethod === factor) {
          expect(started).toMatchObject({ code: "mfa.factor-disabled", success: false })
          continue
        }
        expect(started.success).toBe(true)
        if (!started.success) continue
        expect(started.data.challenge.factor).toBe(factor)
        expect(started.data.challenge.availableFactors).not.toContain(primaryAuthenticationMethod)
      }
    }
  })
})

test("Task 10 resolves organization order before canonical order and rechecks selection availability", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task10-order")
    const organization = await createOrganization(database, fixture.realm.id, "Task 10 order")
    const secret = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    expect(secret.length).toBeGreaterThan(0)
    const realmPolicy = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: {
        allowedFactors: ["totp", "email_otp", "passkey"],
        preferredFactorOrder: ["passkey", "email_otp", "totp"],
      },
      realmId: fixture.realm.id,
    })
    expect(realmPolicy.success).toBe(true)
    await setOrganizationPolicy(database, fixture.realm.id, organization.id, {
      allowedFactors: ["totp", "passkey"],
      preferredFactorOrder: ["passkey", "totp"],
    })

    expect(
      organizationLoginPolicyFactorOrderResolve({
        organizationOrder: ["passkey"],
        permittedFactors: ["totp", "email_otp", "passkey"],
        realmOrder: ["email_otp", "totp"],
        runtimeAvailableFactors: ["totp", "passkey"],
      }),
    ).toEqual(["passkey", "totp"])

    const started = mfaLoginChallengeStart({
      database,
      organizationId: organization.id,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      runtimeAvailableFactors: ["email_otp", "totp", "passkey"],
      userId: fixture.userId,
    })
    expect(started).toMatchObject({
      data: { challenge: { availableFactors: ["passkey", "totp"], factor: "passkey" } },
      success: true,
    })
    if (!started.success) return

    const unavailable = mfaChallengeFactorSelect({
      database,
      factor: "passkey",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      token: started.data.token,
    })
    expect(unavailable).toMatchObject({ code: "mfa.factor-unavailable", success: false })

    const selected = mfaChallengeFactorSelect({
      database,
      factor: "totp",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      token: started.data.token,
    })
    expect(selected).toMatchObject({ data: { challenge: { factor: "totp" } }, success: true })
  })
})

test("Task 10 completes TOTP after each supported distinct primary, including WhatsApp", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task10-totp-matrix")
    const secret = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const primaryMethods = ["password", "email_otp", "external_identity", "passkey", "whatsapp_otp"] as const
    testkit.advance(30_000)

    for (const primaryAuthenticationMethod of primaryMethods) {
      const started = mfaLoginChallengeStart({
        database,
        factor: "totp",
        policyDatabase: database,
        primaryAuthenticationMethod,
        purpose: "login",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      })
      expect(started.success).toBe(true)
      if (!started.success) continue
      const code = mfaTotpCodeCreate(secret, Math.floor(testkit.runtime.now() / 30_000))
      expect(code.success).toBe(true)
      if (!code.success) continue
      const completed = mfaChallengeComplete({
        database,
        encryptionSecret: "task10-mfa-secret",
        input: { code: code.data, token: started.data.token },
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
      })
      expect(completed).toMatchObject({
        data: { session: { session: { authenticationMethod: primaryAuthenticationMethod, mfaMethod: "totp" } } },
        success: true,
      })
      testkit.advance(30_000)
    }
  })
})

test("Task 10 completes passkey MFA only after a distinct primary", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task10-passkey")
    database.sqlite
      .query(
        "INSERT INTO passkey_credentials (aaguid, backed_up, counter, created_at, credential_id, device_type, id, realm_id, last_used_at, public_key, revoked_at, rp_id, transports, user_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "task10-aaguid",
        0,
        0,
        testkit.runtime.now(),
        "task10-credential",
        "singleDevice",
        "task10-passkey-id",
        fixture.realm.id,
        null,
        Buffer.from([1, 2, 3]),
        null,
        "example.com",
        JSON.stringify(["internal"]),
        fixture.userId,
        1,
      )
    const started = mfaLoginChallengeStart({
      database,
      factor: "passkey",
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      runtimeAvailableFactors: ["passkey"],
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const completed = storageTransactionRun(database, (transaction) =>
      mfaPasskeyComplete({
        challengeId: started.data.challenge.id,
        database: transaction,
        policyDatabase: database,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }),
    )
    expect(completed).toMatchObject({ data: { session: { session: { mfaMethod: "passkey" } } }, success: true })

    const samePrimary = mfaLoginChallengeStart({
      database,
      factor: "passkey",
      policyDatabase: database,
      primaryAuthenticationMethod: "passkey",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      runtimeAvailableFactors: ["passkey"],
      userId: fixture.userId,
    })
    expect(samePrimary).toMatchObject({ code: "mfa.factor-disabled", success: false })
  })
})

test("Task 10 completes MFA email OTP and keeps recovery codes fallback-only", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task10-email-recovery")
    const realmPolicy = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: {
        allowedFactors: ["totp", "email_otp", "passkey"],
        preferredFactorOrder: ["totp", "email_otp", "passkey"],
        requiredMfa: true,
      },
      realmId: fixture.realm.id,
    })
    expect(realmPolicy.success).toBe(true)
    const emailChallenge = mfaLoginChallengeStart({
      database,
      factor: "email_otp",
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(emailChallenge.success).toBe(true)
    if (!emailChallenge.success) return
    let deliveryCode = ""
    const emailStarted = mfaEmailOtpStart({
      challengeToken: emailChallenge.data.token,
      database,
      onDelivery: (delivery) => {
        deliveryCode = delivery.code
      },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(emailStarted.success).toBe(true)
    expect(deliveryCode).toMatch(/^\d{6}$/)
    const emailCompleted = mfaChallengeComplete({
      database,
      input: { code: deliveryCode, token: emailChallenge.data.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(emailCompleted).toMatchObject({ data: { session: { session: { mfaMethod: "email_otp" } } }, success: true })

    const totpSecret = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const recovery = mfaRecoveryCodesGenerate({
      database,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(recovery.success).toBe(true)
    if (!recovery.success) return
    const login = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "task10-email-recovery", password: "Correct Horse 12" },
      organizationId: undefined,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.challenge === undefined) return
    const recoveryCode = recovery.data.codes[0]!
    const tampered = mfaChallengeComplete({
      database,
      encryptionSecret: "task10-mfa-secret",
      input: { code: recoveryCode, factor: "totp", token: login.data.challenge.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(tampered.success).toBe(false)
    expect(database.sqlite.query("SELECT consumed_at AS consumedAt FROM mfa_recovery_codes").get()).toEqual({
      consumedAt: null,
    })
    const completed = mfaChallengeComplete({
      database,
      encryptionSecret: "task10-mfa-secret",
      input: { code: recoveryCode, token: login.data.challenge.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(completed).toMatchObject({ data: { session: { session: { mfaMethod: "recovery_code" } } }, success: true })
    expect(totpSecret.length).toBeGreaterThan(0)
  })
})

test("Task 10 returns enrollment remediation and never creates a session without a permitted factor", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task10-remediation")
    const organization = await createOrganization(database, fixture.realm.id, "Task 10 remediation")
    await setOrganizationPolicy(database, fixture.realm.id, organization.id, {
      allowedFactors: ["passkey"],
      preferredFactorOrder: ["passkey"],
      requiredMfa: true,
    })
    const login = passwordLogin({
      context: fixture.context,
      database,
      input: { identifier: "task10-remediation", password: "Correct Horse 12", organizationId: organization.id },
      organizationId: organization.id,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(login).toMatchObject({ code: "mfa.enrollment-required", success: false })
    if (login.success) return
    const details = JSON.parse(login.errorData ?? "{}") as {
      remediation?: { action?: string; factors?: readonly string[] }
    }
    expect(details.remediation).toEqual({ action: "enroll_mfa_factor", factors: ["passkey"] })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 })
  })
})

test("Task 6 resolves multiple factors, allows explicit permitted selection, and exposes safe challenge context", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task6-context")
    const organization = await createOrganization(database, fixture.realm.id, "Task 6 context")
    await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    database.sqlite
      .query(
        "INSERT INTO passkey_credentials (aaguid, backed_up, counter, created_at, credential_id, device_type, id, realm_id, last_used_at, public_key, revoked_at, rp_id, transports, user_id, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "task6-aaguid",
        0,
        0,
        testkit.runtime.now(),
        "task6-credential",
        "singleDevice",
        "task6-passkey-id",
        fixture.realm.id,
        null,
        Buffer.from([1, 2, 3]),
        null,
        "example.com",
        JSON.stringify(["internal"]),
        fixture.userId,
        1,
      )
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate("system"),
        database,
        input: {
          allowedFactors: ["totp", "email_otp", "passkey"],
          preferredFactorOrder: ["email_otp", "passkey", "totp"],
        },
        realmId: fixture.realm.id,
      }).success,
    ).toBe(true)
    expect(
      await setOrganizationPolicy(database, fixture.realm.id, organization.id, {
        allowedFactors: ["totp", "email_otp", "passkey"],
        preferredFactorOrder: ["passkey", "totp", "email_otp"],
      }),
    ).toMatchObject({
      allowedFactors: ["totp", "email_otp", "passkey"],
      preferredFactorOrder: ["passkey", "totp", "email_otp"],
    })

    const started = mfaLoginChallengeStart({
      database,
      organizationId: organization.id,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(started).toMatchObject({
      data: { challenge: { availableFactors: ["passkey", "totp", "email_otp"], factor: "passkey" } },
      success: true,
    })
    if (!started.success) return

    const context = mfaLoginChallengeContextGet({
      executor: database.db,
      now: testkit.runtime.now(),
      realmId: fixture.realm.id,
      token: started.data.token,
    })
    expect(context).toMatchObject({
      data: {
        availableFactors: ["passkey", "totp", "email_otp"],
        challengeId: started.data.challenge.id,
        factor: "passkey",
        organizationId: organization.id,
        primaryAuthenticationMethod: "password",
        purpose: "login",
        realmId: fixture.realm.id,
        userId: fixture.userId,
      },
      success: true,
    })
    expect(JSON.stringify(context.success ? context.data : {})).not.toContain(started.data.token)

    const selected = mfaChallengeFactorSelect({
      database,
      factor: "email_otp",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      token: started.data.token,
    })
    expect(selected).toMatchObject({
      data: { challenge: { availableFactors: ["passkey", "totp", "email_otp"], factor: "email_otp" } },
      success: true,
    })
  })
})

test("Task 6 distinguishes permitted-unavailable factors from disallowed factors across realm and organization policy", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task6-policy")
    const organization = await createOrganization(database, fixture.realm.id, "Task 6 policy")
    await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate("system"),
        database,
        input: {
          allowedFactors: ["totp", "email_otp", "passkey"],
          preferredFactorOrder: ["passkey", "email_otp", "totp"],
        },
        realmId: fixture.realm.id,
      }).success,
    ).toBe(true)
    expect(
      await setOrganizationPolicy(database, fixture.realm.id, organization.id, {
        allowedFactors: ["totp", "email_otp"],
        preferredFactorOrder: ["email_otp", "totp"],
      }),
    ).toMatchObject({ allowedFactors: ["totp", "email_otp"], preferredFactorOrder: ["email_otp", "totp"] })

    const effective = mfaLoginChallengeStart({
      database,
      factor: "totp",
      organizationId: organization.id,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(effective).toMatchObject({
      data: { challenge: { availableFactors: ["email_otp", "totp"], factor: "totp" } },
      success: true,
    })

    const disallowed = mfaLoginChallengeStart({
      database,
      factor: "passkey",
      organizationId: organization.id,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(disallowed).toMatchObject({ code: "mfa.factor-disabled", success: false })

    expect(
      await setOrganizationPolicy(database, fixture.realm.id, organization.id, {
        allowedFactors: ["totp", "email_otp", "passkey"],
        preferredFactorOrder: ["passkey", "email_otp", "totp"],
      }),
    ).toMatchObject({ allowedFactors: ["totp", "email_otp", "passkey"] })
    const permittedButUnavailable = mfaLoginChallengeStart({
      database,
      factor: "passkey",
      organizationId: organization.id,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(permittedButUnavailable).toMatchObject({ code: "mfa.factor-unavailable", success: false })
  })
})

test("Task 6 uses a recovery code as an unordered fallback for a selected MFA method", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createUser(database, "task6-recovery")
    await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate("system"),
        database,
        input: { allowedFactors: ["totp", "email_otp"], preferredFactorOrder: ["email_otp", "totp"] },
        realmId: fixture.realm.id,
      }).success,
    ).toBe(true)
    const generated = mfaRecoveryCodesGenerate({
      database,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(generated.success).toBe(true)
    if (!generated.success) return
    const started = mfaLoginChallengeStart({
      database,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(started).toMatchObject({ data: { challenge: { factor: "email_otp" } }, success: true })
    if (!started.success) return
    const completed = mfaChallengeComplete({
      database,
      input: { code: generated.data.codes[0]!, token: started.data.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(completed).toMatchObject({ data: { session: { session: { mfaMethod: "recovery_code" } } }, success: true })
    expect(database.sqlite.query("SELECT consumed_at AS consumedAt FROM mfa_recovery_codes").all()).toHaveLength(10)
    expect(
      database.sqlite
        .query("SELECT consumed_at AS consumedAt FROM mfa_recovery_codes WHERE consumed_at IS NOT NULL")
        .all(),
    ).toHaveLength(1)
  })
})
