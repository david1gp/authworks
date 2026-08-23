import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { externalIdentityCallback } from "../../src/features/externalIdentities/actions/externalIdentityCallback.js"
import { externalIdentityLinkComplete } from "../../src/features/externalIdentities/actions/externalIdentityLinkComplete.js"
import { externalIdentityLinkStart } from "../../src/features/externalIdentities/actions/externalIdentityLinkStart.js"
import { externalIdentityList } from "../../src/features/externalIdentities/actions/externalIdentityList.js"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityProviderUpdate } from "../../src/features/externalIdentities/actions/externalIdentityProviderUpdate.js"
import { externalIdentityStart } from "../../src/features/externalIdentities/actions/externalIdentityStart.js"
import { externalIdentityUnlink } from "../../src/features/externalIdentities/actions/externalIdentityUnlink.js"
import { externalIdentityApiClientCreate } from "../../src/features/externalIdentities/client/externalIdentityApiClientCreate.js"
import type { ExternalIdentityProviderPort } from "../../src/features/externalIdentities/domain/externalIdentityProviderPort.js"
import { externalIdentityProviderPortCreate } from "../../src/features/externalIdentities/domain/externalIdentityProviderPortCreate.js"
import { externalIdentityOAuthTransactionTable } from "../../src/features/externalIdentities/persistence/externalIdentityOAuthTransactionTable.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-external-identities-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
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

function providerJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  })
}

function providerFetchCreate(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return Object.assign(handler, { preconnect: fetch.preconnect })
}

async function createProvider(database: StorageDatabase, realmId: string, allowAccountCreation = true) {
  const created = externalIdentityProviderCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      allowAccountCreation,
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: "Google",
      redirectUri: "https://app.test/callback",
      type: "google",
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.provider
}

test("external identity provider PATCH rejects an empty patch with a stable code", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "external-patch.example.com")
    const provider = await createProvider(database, realm.id)
    const updated = externalIdentityProviderUpdate({
      context: realmSystemContextCreate(),
      database,
      input: {},
      providerId: provider.id,
      realmId: realm.id,
    })
    expect(updated).toMatchObject({
      code: "external-identities.empty-patch",
      errorMessage: "The patch is empty.",
      success: false,
    })
  })
})

test("external identity login validates state and creates a session without exposing provider secrets", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-login.example.com")
    const provider = await createProvider(database, realm.id)
    const ports = { google: testPort() }
    const started = externalIdentityStart({
      database,
      input: {},
      realmId: realm.id,
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
      realmId: realm.id,
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
    expect(sessionAuthenticate({ database, realmId: realm.id, token: callback.data.session.token }).success).toBe(true)
    expect(
      externalIdentityUnlink({
        database,
        externalSubject: "subject-1",
        realmId: realm.id,
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
          realmId: realm.id,
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
    const realm = await createRealm(database, "external-mfa.example.com")
    const provider = await createProvider(database, realm.id)
    const ports = { google: testPort() }
    const context = realmTenantContextCreate(realm.id, "anonymous")
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
      realmId: realm.id,
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
      realmId: realm.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    const enrollment = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "mfa-test-secret",
      realmId: realm.id,
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
        realmId: realm.id,
        runtime: testkit.runtime,
        userId: verified.data.user.id,
      }).success,
    ).toBe(true)
    const login = passwordLogin({
      context,
      database,
      input: { identifier: "external-mfa-user", password: "Correct Horse 12" },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const linkStart = externalIdentityLinkStart({
      database,
      input: {},
      realmId: realm.id,
      providerId: provider.id,
      providerPorts: ports,
      session: login.data.session.session,
      userId: verified.data.user.id,
      runtime: testkit.runtime,
    })
    expect(linkStart.success).toBe(true)
    if (!linkStart.success) return
    const linkState = new URL(linkStart.data.authorizationUrl).searchParams.get("state") ?? ""
    const linkTransaction = database.db.select().from(externalIdentityOAuthTransactionTable).get()
    expect(linkTransaction).toMatchObject({
      intent: "link",
      providerId: provider.id,
      stateHash: expect.not.stringContaining(linkState),
      userId: login.data.authentication.userId,
    })
    const pending = await externalIdentityCallback({
      code: "link-code",
      database,
      realmId: realm.id,
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
        realmId: realm.id,
        providerId: provider.id,
        session: login.data.session.session,
        userId: verified.data.user.id,
        runtime: testkit.runtime,
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
    const started = externalIdentityStart({
      database,
      input: {},
      realmId: realm.id,
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
      realmId: realm.id,
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
        realmId: realm.id,
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
    const realm = await createRealm(database, "external-link.example.com")
    const provider = await createProvider(database, realm.id)
    const ports = { google: testPort("existing@example.com") }
    const anonymous = realmTenantContextCreate(realm.id, "anonymous")
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
      realmId: realm.id,
      onVerificationToken: (delivery) => {
        token = delivery.token
      },
    })
    expect(registered.success).toBe(true)
    expect(passwordEmailVerify({ context: anonymous, database, input: { token }, realmId: realm.id }).success).toBe(
      true,
    )
    const conflictStart = externalIdentityStart({
      database,
      input: {},
      realmId: realm.id,
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
      realmId: realm.id,
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
      realmId: realm.id,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    expect(
      externalIdentityList({
        database,
        realmId: realm.id,
        session: login.data.session.session,
        userId: "another-user",
      }).success,
    ).toBe(false)
    const linkStart = externalIdentityLinkStart({
      database,
      input: {},
      realmId: realm.id,
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
      realmId: realm.id,
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
        realmId: realm.id,
        session: login.data.session.session,
        userId: login.data.authentication.userId,
      }),
    ).toMatchObject({ data: { total: 0 }, success: true })
    const linked = externalIdentityLinkComplete({
      database,
      input: { confirm: true, confirmationToken: pending.data.confirmationToken },
      realmId: realm.id,
      providerId: provider.id,
      session: login.data.session.session,
      userId: login.data.authentication.userId,
      runtime: testkit.runtime,
    })
    expect(linked.success).toBe(true)
    expect(
      externalIdentityLinkComplete({
        database,
        input: { confirm: true, confirmationToken: pending.data.confirmationToken },
        realmId: realm.id,
        providerId: provider.id,
        session: login.data.session.session,
        userId: login.data.authentication.userId,
        runtime: testkit.runtime,
      }).success,
    ).toBe(false)
    expect(
      externalIdentityList({
        database,
        realmId: realm.id,
        session: login.data.session.session,
        userId: login.data.authentication.userId,
      }),
    ).toMatchObject({ data: { total: 1 }, success: true })
    expect(
      externalIdentityUnlink({
        database,
        externalSubject: "subject-1",
        realmId: realm.id,
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
    const realm = await createRealm(database, "external-atomic.example.com")
    const provider = await createProvider(database, realm.id)
    const ports = { google: testPort() }
    const started = externalIdentityStart({
      database,
      input: {},
      realmId: realm.id,
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
      realmId: realm.id,
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
    const alpha = await createRealm(database, "external-alpha.example.com")
    const beta = await createRealm(database, "external-beta.example.com")
    const provider = await createProvider(database, alpha.id)
    const started = externalIdentityStart({
      database,
      input: {},
      realmId: alpha.id,
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
          realmId: beta.id,
          providerId: provider.id,
          providerPorts: { google: testPort() },
          state,
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
  })
})

test("provider adapters preserve OAuth security parameters for Google, GitHub, and Microsoft", () => {
  const ports = externalIdentityProviderPortCreate()

  for (const type of ["google", "github", "microsoft"] as const) {
    const port = ports[type]
    expect(port).toBeDefined()
    if (port === undefined) continue
    const authorization = port.authorizationUrlCreate(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://app.test/callback",
        scopes: ["openid", "profile"],
        type,
      },
      { nonce: "nonce", pkceChallenge: "challenge", state: "state" },
    )
    expect(authorization.success).toBe(true)
    if (!authorization.success) continue
    const query = new URL(authorization.data).searchParams
    expect(query.get("client_id")).toBe("client-id")
    expect(query.get("redirect_uri")).toBe("https://app.test/callback")
    expect(query.get("response_type")).toBe("code")
    expect(query.get("scope")).toBe("openid profile")
    expect(query.get("state")).toBe("state")
    expect(query.get("code_challenge")).toBe("challenge")
    expect(query.get("code_challenge_method")).toBe("S256")
    expect(query.get("nonce")).toBe(type === "github" ? null : "nonce")
  }
})

test("provider adapters reject incomplete token responses and safely handle GitHub email fallback", async () => {
  const incompleteTokenFetcher = providerFetchCreate(async () => providerJsonResponse({ access_token: "access-token" }))
  const incompletePorts = externalIdentityProviderPortCreate({ fetch: incompleteTokenFetcher })
  for (const type of ["google", "microsoft"] as const) {
    const port = incompletePorts[type]
    expect(port).toBeDefined()
    if (port === undefined) continue
    const result = await port.callbackExchange(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://app.test/callback",
        scopes: ["openid"],
        type,
      },
      { code: "code", nonce: "nonce", pkceVerifier: "verifier" },
    )
    expect(result.success).toBe(false)
  }

  const githubFetcher = providerFetchCreate(async (input) => {
    const url = input.toString()
    if (url === "https://github.com/login/oauth/access_token")
      return providerJsonResponse({ access_token: "access-token" })
    if (url === "https://api.github.com/user")
      return providerJsonResponse({ id: 42, login: "octocat", name: "Octo", email: null })
    if (url === "https://api.github.com/user/emails")
      return providerJsonResponse([
        { email: "primary@example.com", primary: true, verified: false },
        { email: "secondary@example.com", primary: false, verified: true },
      ])
    return providerJsonResponse({}, 404)
  })
  const github = externalIdentityProviderPortCreate({ fetch: githubFetcher }).github
  expect(github).toBeDefined()
  if (github === undefined) return
  const identity = await github.callbackExchange(
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.test/callback",
      scopes: ["user:email"],
      type: "github",
    },
    { code: "code", pkceVerifier: "verifier" },
  )
  expect(identity).toMatchObject({
    data: {
      email: "primary@example.com",
      emailVerified: false,
      externalSubject: "42",
      providerType: "github",
    },
    success: true,
  })
})

test("external identity HTTP, client, and CLI surfaces keep configuration and session contracts public-safe", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "external-http.example.com")
    const app = externalIdentityServerAppCreate({
      database,
      providerPorts: { google: testPort() },
      systemSecret: "system-secret",
    })
    const client = externalIdentityApiClientCreate({
      baseUrl: "https://external-http.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const created = await client.externalIdentityProviderCreate(realm.id, {
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
    const listed = await client.externalIdentityProviderPublicList(realm.id)
    expect(listed.success).toBe(true)
    if (listed.success) expect(listed.data.items).toHaveLength(1)
    const started = await client.externalIdentityStart(realm.id, created.data.provider.id)
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await client.externalIdentityCallback(realm.id, created.data.provider.id, "code", state)
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

test("external identity browser callback issues an HttpOnly session cookie without disclosing credentials", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "external-browser.example.com")
    const provider = await createProvider(database, realm.id)
    const app = externalIdentityServerAppCreate({
      browserMode: true,
      database,
      providerPorts: { google: testPort() },
    })
    const started = await app.request(
      `https://external-browser.example.com/realms/${realm.id}/external-identity/${provider.id}/start`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(started.status).toBe(200)
    const startedBody = (await started.json()) as { authorizationUrl: string }
    const state = new URL(startedBody.authorizationUrl).searchParams.get("state") ?? ""
    const callback = await app.request(
      `https://external-browser.example.com/realms/${realm.id}/external-identity/${provider.id}/callback?code=code&state=${encodeURIComponent(state)}`,
      { headers: { [sessionBrowserModeHeaderName]: "true" } },
    )
    expect(callback.status).toBe(200)
    const cookie = callback.headers.get("set-cookie") ?? ""
    const token = /^session=([^;]+);/.exec(cookie)?.[1]
    const body = (await callback.json()) as { session?: unknown }
    expect(token).toHaveLength(43)
    expect(body.session).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(token ?? "")
    expect(cookie).toContain("HttpOnly")
    if (token !== undefined) expect(sessionAuthenticate({ database, realmId: realm.id, token }).success).toBe(true)

    const unmarkedStart = await app.request(
      `https://external-browser.example.com/realms/${realm.id}/external-identity/${provider.id}/start`,
      { body: JSON.stringify({}), headers: { "content-type": "application/json" }, method: "POST" },
    )
    expect(unmarkedStart.status).toBe(200)
    const unmarkedStartBody = (await unmarkedStart.json()) as { authorizationUrl: string }
    const unmarkedState = new URL(unmarkedStartBody.authorizationUrl).searchParams.get("state") ?? ""
    const unmarked = await app.request(
      `https://external-browser.example.com/realms/${realm.id}/external-identity/${provider.id}/callback?code=code&state=${encodeURIComponent(unmarkedState)}`,
    )
    expect(unmarked.status).toBe(200)
    expect(unmarked.headers.get("set-cookie")).toBeNull()
    const unmarkedBody = (await unmarked.json()) as { session?: { token?: string } }
    expect(unmarkedBody.session?.token).toHaveLength(43)

    const invalidStart = await app.request(
      `https://external-browser.example.com/realms/${realm.id}/external-identity/${provider.id}/start`,
      { body: JSON.stringify({}), headers: { "content-type": "application/json" }, method: "POST" },
    )
    expect(invalidStart.status).toBe(200)
    const invalidStartBody = (await invalidStart.json()) as { authorizationUrl: string }
    const invalidState = new URL(invalidStartBody.authorizationUrl).searchParams.get("state") ?? ""
    const invalid = await app.request(
      `https://external-browser.example.com/realms/${realm.id}/external-identity/${provider.id}/callback?code=code&state=${encodeURIComponent(invalidState)}`,
      { headers: { [sessionBrowserModeHeaderName]: "invalid" } },
    )
    expect(invalid.status).toBe(200)
    expect(invalid.headers.get("set-cookie")).toBeNull()
    const invalidBody = (await invalid.json()) as { session?: { token?: string } }
    expect(invalidBody.session?.token).toHaveLength(43)
  })
})

test("subject-bound external identity routes enforce IDOR, tenant, assurance, CSRF, and secret boundaries", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "external-me-alpha.example.com")
    const beta = await createRealm(database, "external-me-beta.example.com")
    const provider = await createProvider(database, alpha.id)
    const context = realmTenantContextCreate(alpha.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "external-me@example.com",
        password: "Correct Horse 12",
        profile: { displayName: "External Me" },
        userName: "external-me",
      },
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
      realmId: alpha.id,
      runtime: testkit.runtime,
    })
    expect(registered.success).toBe(true)
    if (!registered.success) return
    expect(
      passwordEmailVerify({
        context,
        database,
        input: { token: verificationToken },
        realmId: alpha.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    const login = passwordLogin({
      context,
      database,
      input: { identifier: "external-me", password: "Correct Horse 12" },
      realmId: alpha.id,
      runtime: testkit.runtime,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return

    const app = externalIdentityServerAppCreate({
      database,
      providerPorts: { google: testPort() },
      publicOrigin: "https://external-me-alpha.example.com",
    })
    const client = externalIdentityApiClientCreate({
      baseUrl: "https://external-me-alpha.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: login.data.session.token,
    })
    const link = async (providerId: string) => {
      const started = await client.externalIdentityMeLinkStart(alpha.id, providerId)
      expect(started.success).toBe(true)
      if (!started.success) return false
      const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
      const callback = await app.request(
        `https://external-me-alpha.example.com/realms/${alpha.id}/external-identity/${providerId}/callback?code=code&state=${encodeURIComponent(state)}`,
      )
      expect(callback.status).toBe(200)
      const callbackBody = (await callback.json()) as { confirmationToken?: string; kind?: string }
      expect(callbackBody.kind).toBe("link_confirmation")
      expect(JSON.stringify(callbackBody)).not.toContain("client-secret")
      if (callbackBody.confirmationToken === undefined) return false
      const completed = await client.externalIdentityMeLinkComplete(alpha.id, providerId, {
        confirm: true,
        confirmationToken: callbackBody.confirmationToken,
      })
      expect(completed.success).toBe(true)
      expect(JSON.stringify(completed)).not.toContain("client-secret")
      return completed.success
    }

    const initiallyListed = await client.externalIdentityMeList(alpha.id)
    expect(initiallyListed.success).toBe(true)
    if (!initiallyListed.success) return
    expect(initiallyListed.data.items).toHaveLength(0)
    expect(await link(provider.id)).toBe(true)
    const idorBody = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities/${provider.id}/link/complete`,
      {
        body: JSON.stringify({ confirm: true, confirmationToken: "invalid", userId: "attacker" }),
        headers: { authorization: `Bearer ${login.data.session.token}`, "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(idorBody.status).toBe(400)
    const listed = await client.externalIdentityMeList(alpha.id, { pageSize: 1 })
    expect(listed.success).toBe(true)
    if (listed.success) {
      expect(listed.data.items).toHaveLength(1)
      expect(listed.data.items[0]?.userId).toBe(login.data.authentication.userId)
      expect(JSON.stringify(listed.data)).not.toContain("client-secret")
    }
    const ignoredUserId = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities?userId=attacker`,
      { headers: { authorization: `Bearer ${login.data.session.token}` } },
    )
    expect(ignoredUserId.status).toBe(200)
    expect((await ignoredUserId.json()).items[0].userId).toBe(login.data.authentication.userId)
    const crossTenant = await app.request(
      `https://external-me-beta.example.com/realms/${beta.id}/me/external-identities`,
      { headers: { authorization: `Bearer ${login.data.session.token}` } },
    )
    expect(crossTenant.status).toBe(401)

    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const cookie = `session=${login.data.session.token}`
    const missingOrigin = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities/${provider.id}/link/start`,
      { body: "{}", headers: { cookie, "content-type": "application/json" }, method: "POST" },
    )
    expect(missingOrigin.status).toBe(403)
    const wrongOrigin = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities/${provider.id}/link/start`,
      {
        body: "{}",
        headers: {
          cookie: `${cookie}; csrf=${csrf}`,
          origin: "https://evil.example.com",
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        method: "POST",
      },
    )
    expect(wrongOrigin.status).toBe(403)
    const wrongCsrf = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities/${provider.id}/link/start`,
      {
        body: "{}",
        headers: {
          cookie: `${cookie}; csrf=${csrf}`,
          origin: "https://external-me-alpha.example.com",
          "content-type": "application/json",
          "x-csrf-token": "wrong",
        },
        method: "POST",
      },
    )
    expect(wrongCsrf.status).toBe(403)
    const validCookieStart = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities/${provider.id}/link/start`,
      {
        body: "{}",
        headers: {
          cookie: `${cookie}; csrf=${csrf}`,
          origin: "https://external-me-alpha.example.com",
          "content-type": "application/json",
          "x-csrf-token": csrf,
        },
        method: "POST",
      },
    )
    expect(validCookieStart.status).toBe(200)
    expect(await validCookieStart.text()).not.toContain("client-secret")

    const weakSession = sessionIssue({
      assurance: "none",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: login.data.authentication.userId,
    })
    expect(weakSession.success).toBe(true)
    if (!weakSession.success) return
    const weakUnlink = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities/${provider.id}/subject-1`,
      { headers: { authorization: `Bearer ${weakSession.data.token}` }, method: "DELETE" },
    )
    expect(weakUnlink.status).toBe(403)

    const cookieUnlink = await app.request(
      `https://external-me-alpha.example.com/realms/${alpha.id}/me/external-identities/${provider.id}/subject-1`,
      {
        headers: {
          cookie: `${cookie}; csrf=${csrf}`,
          origin: "https://external-me-alpha.example.com",
          "x-csrf-token": csrf,
        },
        method: "DELETE",
      },
    )
    expect(cookieUnlink.status).toBe(200)
    expect(await link(provider.id)).toBe(true)
    expect((await client.externalIdentityMeUnlink(alpha.id, provider.id, "subject-1")).success).toBe(true)
    const finalList = await client.externalIdentityMeList(alpha.id)
    expect(finalList.success).toBe(true)
    if (finalList.success) expect(finalList.data.items).toHaveLength(0)
  })
})
