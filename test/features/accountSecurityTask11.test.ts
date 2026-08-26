import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { impersonationStart } from "../../src/features/impersonation/actions/impersonationStart.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaEmailOtpStart } from "../../src/features/mfa/actions/mfaEmailOtpStart.js"
import { mfaLoginChallengeStart } from "../../src/features/mfa/actions/mfaLoginChallengeStart.js"
import { mfaPrimaryAuthenticationComplete } from "../../src/features/mfa/actions/mfaPrimaryAuthenticationComplete.js"
import { mfaStepUpStart } from "../../src/features/mfa/actions/mfaStepUpStart.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { organizationMeSwitch } from "../../src/features/organizations/actions/organizationMeSwitch.js"
import { organizationSwitch } from "../../src/features/organizations/actions/organizationSwitch.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmBootstrapAdminAuthenticate } from "../../src/features/realms/actions/realmBootstrapAdminAuthenticate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionRecentResume } from "../../src/features/sessions/actions/sessionRecentResume.js"
import { sessionRotate } from "../../src/features/sessions/actions/sessionRotate.js"
import { sessionProtectedMiddlewareCreate } from "../../src/features/sessions/server/sessionProtectedMiddlewareCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../src/platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-account-security-task11-"))
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

async function createFixture(database: StorageDatabase) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain: "account-security-task11.example.com", name: "Task 11" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "task11@example.com",
      password: "Correct Horse 12",
      profile: {},
      userName: "task11-user",
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
  const organization = organizationCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { name: "Task 11 organization", ownerUserId: verified.data.user.id },
    realmId: realm.data.realm.id,
  })
  expect(organization.success).toBe(true)
  if (!organization.success) throw new Error(organization.errorMessage)
  return {
    context,
    organization: organization.data.organization,
    realm: realm.data.realm,
    userId: verified.data.user.id,
  }
}

async function enrollTotp(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  userId: string,
) {
  const started = mfaTotpEnrollmentStart({
    database,
    encryptionSecret: "task11-secret",
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
    encryptionSecret: "task11-secret",
    input: { code: code.data, enrollmentId: started.data.enrollment.id },
    realmId,
    runtime: testkit.runtime,
    userId,
  })
  expect(confirmed.success).toBe(true)
  return started.data.secret
}

test("Task 11 issues authenticated primary sessions and multi-factor sessions only from distinct factors", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createFixture(database)
    const secret = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)

    const primaryPasskey = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "passkey",
      database,
      organizationId: fixture.organization.id,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(primaryPasskey).toMatchObject({ data: { session: { assurance: "authenticated" } }, success: true })
    expect(
      sessionIssue({
        assurance: "multi_factor",
        authenticationMethod: "passkey",
        database,
        organizationId: fixture.organization.id,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }),
    ).toMatchObject({ success: false })
    expect(
      sessionIssue({
        assurance: "multi_factor",
        authenticationMethod: "passkey",
        database,
        mfaMethod: "passkey",
        organizationId: fixture.organization.id,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }),
    ).toMatchObject({ success: false })

    const totpChallenge = mfaLoginChallengeStart({
      database,
      factor: "totp",
      organizationId: fixture.organization.id,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(totpChallenge.success).toBe(true)
    if (!totpChallenge.success) return
    testkit.advance(30_000)
    const totpCode = mfaTotpCodeCreate(secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(totpCode.success).toBe(true)
    if (!totpCode.success) return
    const totpCompleted = mfaChallengeComplete({
      database,
      encryptionSecret: "task11-secret",
      input: { code: totpCode.data, token: totpChallenge.data.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(totpCompleted).toMatchObject({
      data: { session: { session: { assurance: "multi_factor", mfaMethod: "totp" } } },
      success: true,
    })

    const emailChallenge = mfaLoginChallengeStart({
      database,
      factor: "email_otp",
      organizationId: fixture.organization.id,
      policyDatabase: database,
      primaryAuthenticationMethod: "password",
      purpose: "login",
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(emailChallenge.success).toBe(true)
    if (!emailChallenge.success) return
    let emailCode = ""
    expect(
      mfaEmailOtpStart({
        challengeToken: emailChallenge.data.token,
        database,
        onDelivery: (delivery) => {
          emailCode = delivery.code
        },
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    const emailCompleted = mfaChallengeComplete({
      database,
      input: { code: emailCode, token: emailChallenge.data.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
    })
    expect(emailCompleted).toMatchObject({
      data: { session: { session: { assurance: "multi_factor", mfaMethod: "email_otp" } } },
      success: true,
    })

    expect(
      mfaLoginChallengeStart({
        database,
        factor: "passkey",
        organizationId: fixture.organization.id,
        policyDatabase: database,
        primaryAuthenticationMethod: "passkey",
        purpose: "login",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        runtimeAvailableFactors: ["passkey"],
        userId: fixture.userId,
      }),
    ).toMatchObject({ code: "mfa.factor-disabled", success: false })
  })
})

test("Task 11 blocks minimum-assurance-only passkey primaries before the session fast path", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createFixture(database)
    await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const policy = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { minimumStepUpAssurance: "multi_factor" },
      organizationId: fixture.organization.id,
      realmId: fixture.realm.id,
    })
    expect(policy.success).toBe(true)

    let sessionCallbackCalled = false
    const completed = storageTransactionRun(database, (transaction) =>
      mfaPrimaryAuthenticationComplete({
        actorId: fixture.userId,
        executor: transaction,
        organizationId: fixture.organization.id,
        policyDatabase: database,
        primaryAuthenticationMethod: "passkey",
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        sessionCreate: () => {
          sessionCallbackCalled = true
          return resultCreate({ issued: true })
        },
        userId: fixture.userId,
      }),
    )
    expect(completed).toMatchObject({
      data: { challenge: { challenge: { purpose: "login", requiredAssurance: "multi_factor" } } },
      success: true,
    })
    expect(sessionCallbackCalled).toBe(false)

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "passkey",
      database,
      organizationId: fixture.organization.id,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(issued).toMatchObject({
      code: "sessions.assurance-required",
      errorData: JSON.stringify({
        action: "step_up",
        organizationId: fixture.organization.id,
        requiredAssurance: "multi_factor",
      }),
      success: false,
    })
  })
})

test("Task 11 revalidates policy and organization context across protected operations and step-up", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createFixture(database)
    const secondOrganization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "Task 11 second organization", ownerUserId: fixture.userId },
      realmId: fixture.realm.id,
    })
    expect(secondOrganization.success).toBe(true)
    if (!secondOrganization.success) return
    const secret = await enrollTotp(database, testkit, fixture.realm.id, fixture.userId)
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      organizationId: fixture.organization.id,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(session.success).toBe(true)
    if (!session.success) return

    const app = new Hono()
    app.get(
      "/realms/:realmId/organizations/:organizationId/protected",
      sessionProtectedMiddlewareCreate({ database }),
      (context) => context.json({ ok: true }),
    )
    const wrongOrganization = await app.request(
      `http://server.test/realms/${fixture.realm.id}/organizations/${secondOrganization.data.organization.id}/protected`,
      { headers: { authorization: `Bearer ${session.data.token}` } },
    )
    expect(wrongOrganization.status).toBe(401)

    const policy = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { minimumStepUpAssurance: "multi_factor" },
      organizationId: fixture.organization.id,
      realmId: fixture.realm.id,
    })
    expect(policy.success).toBe(true)
    const protectedResponse = await app.request(
      `http://server.test/realms/${fixture.realm.id}/organizations/${fixture.organization.id}/protected`,
      { headers: { authorization: `Bearer ${session.data.token}` } },
    )
    expect(protectedResponse.status).toBe(403)
    expect(await protectedResponse.json()).toMatchObject({
      error: {
        code: "sessions.assurance-required",
        details: {
          action: "step_up",
          organizationId: fixture.organization.id,
          requiredAssurance: "multi_factor",
        },
      },
    })

    const minimumOnlySession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "passkey",
      database,
      organizationId: fixture.organization.id,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(minimumOnlySession).toMatchObject({
      code: "sessions.assurance-required",
      errorData: JSON.stringify({
        action: "step_up",
        organizationId: fixture.organization.id,
        requiredAssurance: "multi_factor",
      }),
      success: false,
    })

    const requiredMfaPolicy = organizationLoginPolicySet({
      context: realmSystemContextCreate("system"),
      database,
      input: { requiredMfa: true },
      organizationId: fixture.organization.id,
      realmId: fixture.realm.id,
    })
    expect(requiredMfaPolicy.success).toBe(true)

    const bootstrap = realmBootstrapAdminCreate({
      context: realmSystemContextCreate("system"),
      database,
      realmId: fixture.realm.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const bootstrapContext = realmBootstrapAdminAuthenticate({
      context: fixture.context,
      database,
      secret: bootstrap.data.bootstrapAdmin.secret.valueGet(),
    })
    expect(bootstrapContext.success).toBe(true)
    if (!bootstrapContext.success) return
    expect(
      organizationSwitch({
        context: bootstrapContext.data,
        database,
        input: { organizationId: fixture.organization.id },
        realmId: fixture.realm.id,
      }),
    ).toMatchObject({ success: true })

    expect(
      sessionIssue({
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        organizationId: fixture.organization.id,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        userId: fixture.userId,
      }),
    ).toMatchObject({ code: "sessions.assurance-required", success: false })

    expect(sessionRotate({ database, realmId: fixture.realm.id, token: session.data.token })).toMatchObject({
      code: "sessions.assurance-required",
      success: false,
    })
    expect(
      sessionRecentResume({
        database,
        realmId: fixture.realm.id,
        runtime: testkit.runtime,
        sessionId: session.data.session.id,
        token: session.data.token,
      }),
    ).toMatchObject({ code: "sessions.assurance-required", success: false })
    expect(
      organizationMeSwitch({
        context: realmTenantContextCreate(fixture.realm.id, fixture.userId),
        database,
        input: { organizationId: fixture.organization.id },
        realmId: fixture.realm.id,
        sessionId: session.data.session.id,
      }),
    ).toMatchObject({ code: "sessions.assurance-required", success: false })
    expect(
      impersonationStart({
        actor: {
          actorId: fixture.userId,
          assurance: "authenticated",
          authenticationMethod: "trusted",
          kind: "user",
          organizationId: fixture.organization.id,
          realmId: fixture.realm.id,
        },
        database,
        durationMs: 10_000,
        organizationId: fixture.organization.id,
        reason: "Task 11 review",
        realmId: fixture.realm.id,
        targetUserId: "another-user",
      }),
    ).toMatchObject({ code: "authorization.insufficient-assurance", success: false })

    const started = mfaStepUpStart({
      database,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      sessionId: session.data.session.id,
      userId: fixture.userId,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    testkit.advance(30_000)
    const code = mfaTotpCodeCreate(secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(code.success).toBe(true)
    if (!code.success) return
    const completed = mfaChallengeComplete({
      database,
      encryptionSecret: "task11-secret",
      input: { code: code.data, token: started.data.token },
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      sessionToken: session.data.token,
    })
    expect(completed).toMatchObject({ data: { session: { session: { assurance: "multi_factor" } } }, success: true })
    if (!completed.success) return
    const protectedAfterStepUp = await app.request(
      `http://server.test/realms/${fixture.realm.id}/organizations/${fixture.organization.id}/protected`,
      { headers: { authorization: `Bearer ${completed.data.session?.token}` } },
    )
    expect(protectedAfterStepUp.status).toBe(200)
  })
})
