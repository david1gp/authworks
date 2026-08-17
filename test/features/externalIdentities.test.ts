import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { externalIdentityApiClientCreate } from "../../src/features/externalIdentities/client/externalIdentityApiClientCreate.js"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { externalIdentityCallback } from "../../src/features/externalIdentities/actions/externalIdentityCallback.js"
import { externalIdentityLinkComplete } from "../../src/features/externalIdentities/actions/externalIdentityLinkComplete.js"
import { externalIdentityLinkStart } from "../../src/features/externalIdentities/actions/externalIdentityLinkStart.js"
import { externalIdentityList } from "../../src/features/externalIdentities/actions/externalIdentityList.js"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityProviderPortCreate } from "../../src/features/externalIdentities/domain/externalIdentityProviderPortCreate.js"
import type { ExternalIdentityProviderPort } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { externalIdentityStart } from "../../src/features/externalIdentities/actions/externalIdentityStart.js"
import { externalIdentityUnlink } from "../../src/features/externalIdentities/actions/externalIdentityUnlink.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-external-identities-"))
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

async function createInstance(database: StorageDatabase, domain: string) {
  const created = instanceCreate({ context: instanceSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.instance
}

function testPort(email = "new@example.com"): ExternalIdentityProviderPort {
  return {
    authorizationUrlCreate(_configuration, input) {
      return resultCreate(
        `https://provider.test/authorize?state=${encodeURIComponent(input.state)}&challenge=${encodeURIComponent(input.pkceChallenge)}`,
      )
    },
    callbackExchange(_configuration, input) {
      return Promise.resolve(
        resultCreate({
          displayName: "External User",
          email,
          emailVerified: true,
          externalSubject: "subject-1",
          ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
          providerType: "google" as const,
          username: "external-user",
        }),
      )
    },
  }
}

async function createProvider(database: StorageDatabase, instanceId: string, allowAccountCreation = true) {
  const created = externalIdentityProviderCreate({
    context: instanceSystemContextCreate(),
    database,
    input: {
      allowAccountCreation,
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: "Google",
      redirectUri: "https://app.test/callback",
      type: "google",
    },
    instanceId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.provider
}

test("external identity login validates state and creates a session without exposing provider secrets", async () => {
  await withDatabase(async (database, testkit) => {
    const instance = await createInstance(database, "external-login.example.com")
    const provider = await createProvider(database, instance.id)
    const ports = { google: testPort() }
    const started = externalIdentityStart({
      database,
      input: {},
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await externalIdentityCallback({
      code: "provider-code",
      database,
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      state,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(true)
    if (!callback.success || callback.data.kind !== "authenticated") return
    expect(callback.data.session).toBeDefined()
    if (callback.data.session === undefined) return
    expect(callback.data.session.session.authenticationMethod).toBe("external_identity")
    expect(sessionAuthenticate({ database, instanceId: instance.id, token: callback.data.session.token }).success).toBe(
      true,
    )
    expect(
      externalIdentityUnlink({
        database,
        externalSubject: "subject-1",
        instanceId: instance.id,
        providerId: provider.id,
        session: callback.data.session.session,
        userId: callback.data.authentication.userId,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(JSON.stringify(database.db.select().from(storageEventTable).all())).not.toContain("client-secret")
    expect(JSON.stringify(callback.data)).not.toContain("client-secret")
    expect(
      (
        await externalIdentityCallback({
          code: "provider-code",
          database,
          instanceId: instance.id,
          providerId: provider.id,
          providerPorts: ports,
          state,
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
  })
})

test("required MFA turns external identity authentication into a TOTP challenge", async () => {
  await withDatabase(async (database, testkit) => {
    const instance = await createInstance(database, "external-mfa.example.com")
    const provider = await createProvider(database, instance.id)
    const ports = { google: testPort() }
    const context = instanceTenantContextCreate(instance.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "new@example.com",
        password: "Correct Horse 12",
        profile: {},
        userName: "external-mfa-user",
      },
      instanceId: instance.id,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
    })
    expect(registered.success).toBe(true)
    if (!registered.success) return
    const verified = passwordEmailVerify({
      context,
      database,
      input: { token: verificationToken },
      instanceId: instance.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    const enrollment = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "mfa-test-secret",
      instanceId: instance.id,
      runtime: testkit.runtime,
      userId: verified.data.user.id,
    })
    expect(enrollment.success).toBe(true)
    if (!enrollment.success) return
    const enrollmentCode = mfaTotpCodeCreate(enrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    if (!enrollmentCode.success) return
    expect(
      mfaTotpEnrollmentConfirm({
        database,
        encryptionSecret: "mfa-test-secret",
        input: { code: enrollmentCode.data, enrollmentId: enrollment.data.enrollment.id },
        instanceId: instance.id,
        runtime: testkit.runtime,
        userId: verified.data.user.id,
      }).success,
    ).toBe(true)
    const login = passwordLogin({
      context,
      database,
      input: { identifier: "external-mfa-user", password: "Correct Horse 12" },
      instanceId: instance.id,
      runtime: testkit.runtime,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const linkStart = externalIdentityLinkStart({
      database,
      input: {},
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      session: login.data.session.session,
      userId: verified.data.user.id,
      runtime: testkit.runtime,
    })
    expect(linkStart.success).toBe(true)
    if (!linkStart.success) return
    const linkState = new URL(linkStart.data.authorizationUrl).searchParams.get("state") ?? ""
    const pending = await externalIdentityCallback({
      code: "link-code",
      database,
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      state: linkState,
      runtime: testkit.runtime,
    })
    expect(pending.success).toBe(true)
    if (!pending.success || pending.data.kind !== "link_confirmation") return
    expect(
      externalIdentityLinkComplete({
        database,
        input: { confirm: true, confirmationToken: pending.data.confirmationToken },
        instanceId: instance.id,
        providerId: provider.id,
        session: login.data.session.session,
        userId: verified.data.user.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    expect(
      mfaPolicySet({
        context: instanceSystemContextCreate("system"),
        database,
        input: { lockoutDurationMs: 900_000, maxAttempts: 3, mode: "required", totpWindow: 1 },
        instanceId: instance.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    const started = externalIdentityStart({
      database,
      input: {},
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await externalIdentityCallback({
      code: "provider-code",
      database,
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      state,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(true)
    if (!callback.success || callback.data.kind !== "authenticated") return
    expect(callback.data.challenge).toBeDefined()
    expect(callback.data.session).toBeUndefined()
    if (callback.data.challenge === undefined) return
    testkit.advance(30_000)
    const challengeCode = mfaTotpCodeCreate(enrollment.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    if (!challengeCode.success) return
    expect(
      mfaChallengeComplete({
        database,
        encryptionSecret: "mfa-test-secret",
        input: { code: challengeCode.data, token: callback.data.challenge.token },
        instanceId: instance.id,
        runtime: testkit.runtime,
      }),
    ).toMatchObject({
      success: true,
      data: { session: { session: { assurance: "multi_factor", authenticationMethod: "external_identity" } } },
    })
  })
})

test("external identities never auto-link by email and linking requires confirmation", async () => {
  await withDatabase(async (database, testkit) => {
    const instance = await createInstance(database, "external-link.example.com")
    const provider = await createProvider(database, instance.id)
    const ports = { google: testPort("existing@example.com") }
    const anonymous = instanceTenantContextCreate(instance.id, "anonymous")
    let token = ""
    const registered = passwordRegister({
      context: anonymous,
      database,
      input: {
        email: "existing@example.com",
        password: "Correct Horse 12",
        profile: { displayName: "Existing" },
        userName: "existing",
      },
      instanceId: instance.id,
      onVerificationToken: (delivery) => {
        token = delivery.token
      },
    })
    expect(registered.success).toBe(true)
    expect(
      passwordEmailVerify({ context: anonymous, database, input: { token }, instanceId: instance.id }).success,
    ).toBe(true)
    const conflictStart = externalIdentityStart({
      database,
      input: {},
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      runtime: testkit.runtime,
    })
    expect(conflictStart.success).toBe(true)
    if (!conflictStart.success) return
    const conflictState = new URL(conflictStart.data.authorizationUrl).searchParams.get("state") ?? ""
    const conflict = await externalIdentityCallback({
      code: "code",
      database,
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      state: conflictState,
      runtime: testkit.runtime,
    })
    expect(conflict.success).toBe(false)
    if (conflict.success) return
    expect(conflict.errorMessage).toContain("link this provider")

    const login = passwordLogin({
      context: anonymous,
      database,
      input: { identifier: "existing", password: "Correct Horse 12" },
      instanceId: instance.id,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    expect(
      externalIdentityList({
        database,
        instanceId: instance.id,
        session: login.data.session.session,
        userId: "another-user",
      }).success,
    ).toBe(false)
    const linkStart = externalIdentityLinkStart({
      database,
      input: {},
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      session: login.data.session.session,
      userId: login.data.authentication.userId,
      runtime: testkit.runtime,
    })
    expect(linkStart.success).toBe(true)
    if (!linkStart.success) return
    const linkState = new URL(linkStart.data.authorizationUrl).searchParams.get("state") ?? ""
    const pending = await externalIdentityCallback({
      code: "link-code",
      database,
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      state: linkState,
      runtime: testkit.runtime,
    })
    expect(pending.success).toBe(true)
    if (!pending.success || pending.data.kind !== "link_confirmation") return
    expect(
      externalIdentityList({
        database,
        instanceId: instance.id,
        session: login.data.session.session,
        userId: login.data.authentication.userId,
      }),
    ).toMatchObject({ data: { total: 0 }, success: true })
    const linked = externalIdentityLinkComplete({
      database,
      input: { confirm: true, confirmationToken: pending.data.confirmationToken },
      instanceId: instance.id,
      providerId: provider.id,
      session: login.data.session.session,
      userId: login.data.authentication.userId,
      runtime: testkit.runtime,
    })
    expect(linked.success).toBe(true)
    expect(
      externalIdentityList({
        database,
        instanceId: instance.id,
        session: login.data.session.session,
        userId: login.data.authentication.userId,
      }),
    ).toMatchObject({ data: { total: 1 }, success: true })
    expect(
      externalIdentityUnlink({
        database,
        externalSubject: "subject-1",
        instanceId: instance.id,
        providerId: provider.id,
        session: login.data.session.session,
        userId: login.data.authentication.userId,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
  })
})

test("external identity account and event writes roll back together", async () => {
  await withDatabase(async (database, testkit) => {
    const instance = await createInstance(database, "external-atomic.example.com")
    const provider = await createProvider(database, instance.id)
    const ports = { google: testPort() }
    const started = externalIdentityStart({
      database,
      input: {},
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    database.sqlite.run(
      "CREATE TRIGGER reject_external_identity_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'external_identity' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const before = database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()
    const callback = await externalIdentityCallback({
      code: "code",
      database,
      instanceId: instance.id,
      providerId: provider.id,
      providerPorts: ports,
      state,
      runtime: testkit.runtime,
    })
    expect(callback.success).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual(before)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM external_identities").get()).toEqual({ count: 0 })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 })
  })
})

test("provider adapters use fixed endpoints and reject invalid state isolation", async () => {
  const ports = externalIdentityProviderPortCreate()
  const configuration = {
    clientId: "id",
    clientSecret: "secret",
    redirectUri: "https://app.test/cb",
    scopes: ["openid"],
    type: "google" as const,
  }
  const google = ports.google
  expect(google).toBeDefined()
  if (google === undefined) return
  const url = google.authorizationUrlCreate(configuration, {
    nonce: "nonce",
    pkceChallenge: "challenge",
    state: "state",
  })
  expect(url.success).toBe(true)
  if (url.success) expect(url.data).toStartWith("https://accounts.google.com/o/oauth2/v2/auth?")
  await withDatabase(async (database, testkit) => {
    const alpha = await createInstance(database, "external-alpha.example.com")
    const beta = await createInstance(database, "external-beta.example.com")
    const provider = await createProvider(database, alpha.id)
    const started = externalIdentityStart({
      database,
      input: {},
      instanceId: alpha.id,
      providerId: provider.id,
      providerPorts: { google: testPort() },
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    expect(
      (
        await externalIdentityCallback({
          code: "code",
          database,
          instanceId: beta.id,
          providerId: provider.id,
          providerPorts: { google: testPort() },
          state,
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
  })
})

test("external identity HTTP, client, and CLI surfaces keep configuration and session contracts public-safe", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "external-http.example.com")
    const app = externalIdentityServerAppCreate({
      database,
      providerPorts: { google: testPort() },
      systemSecret: "system-secret",
    })
    const client = externalIdentityApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const created = await client.externalIdentityProviderCreate(instance.id, {
      allowAccountCreation: true,
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: "Google",
      redirectUri: "https://app.test/callback",
      type: "google",
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(JSON.stringify(created.data)).not.toContain("client-secret")
    const listed = await client.externalIdentityProviderPublicList(instance.id)
    expect(listed).toMatchObject({ success: true, data: { total: 1 } })
    const started = await client.externalIdentityStart(instance.id, created.data.provider.id)
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await client.externalIdentityCallback(instance.id, created.data.provider.id, "code", state)
    expect(callback).toMatchObject({ success: true, data: { kind: "authenticated" } })
  })
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "external-identities", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("External identities")
})
