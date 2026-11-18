import { expect, test } from "bun:test"
import { generateKeyPairSync, type KeyObject, sign, verify } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
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
import type { ExternalIdentityProviderType } from "../../src/features/externalIdentities/public/externalIdentityProviderTypeSchema.js"
import { externalIdentityOAuthTransactionTable } from "../../src/features/externalIdentities/persistence/externalIdentityOAuthTransactionTable.js"
import { externalIdentityTable } from "../../src/features/externalIdentities/persistence/externalIdentityTable.js"
import { externalIdentityRepositoryCreate } from "../../src/features/externalIdentities/persistence/externalIdentityRepositoryCreate.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { mfaChallengeComplete } from "../../src/features/mfa/actions/mfaChallengeComplete.js"
import { mfaPolicySet } from "../../src/features/mfa/actions/mfaPolicySet.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { passkeyCredentialTable } from "../../src/features/passkeys/persistence/passkeyCredentialTable.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordCredentialTable } from "../../src/features/passwords/persistence/passwordCredentialTable.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"
import { userProfileTable } from "../../src/features/users/persistence/userProfileTable.js"
import { userTable } from "../../src/features/users/persistence/userTable.js"

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

function testPort(
  email = "new@example.com",
  options: {
    readonly emailVerified?: boolean
    readonly externalSubject?: string
    readonly providerType?: ExternalIdentityProviderType
  } = {},
): ExternalIdentityProviderPort {
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
          emailVerified: options.emailVerified ?? true,
          externalSubject: options.externalSubject ?? "subject-1",
          ...(input.nonce === undefined ? {} : { nonce: input.nonce }),
          providerType: options.providerType ?? "google",
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

async function createProvider(
  database: StorageDatabase,
  realmId: string,
  allowAccountCreation = true,
  type: ExternalIdentityProviderType = "google",
  organizationId?: string,
) {
  const created = externalIdentityProviderCreate({
    allowDevelopmentFallback: true,
    context: realmSystemContextCreate(),
    database,
    input: {
      allowAccountCreation,
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: type === "google" ? "Google" : type === "github" ? "GitHub" : "Microsoft",
      ...(organizationId === undefined ? {} : { organizationId }),
      redirectUri: "https://app.test/callback",
      type,
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.provider
}

async function createVerifiedUser(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  email: string,
  userName: string,
) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: { email, password: "Correct Horse 12", profile: {}, userName },
    onVerificationToken: ({ token: verificationToken }) => {
      token = verificationToken
    },
    realmId,
    runtime: testkit.runtime,
  })
  expect(registered.success).toBe(true)
  if (!registered.success) throw new Error(registered.errorMessage)
  const verified = passwordEmailVerify({
    context,
    database,
    input: { token },
    realmId,
    runtime: testkit.runtime,
  })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return verified.data.user
}

async function externalIdentityLogin(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  providerId: string,
  providerPorts: Parameters<typeof externalIdentityCallback>[0]["providerPorts"],
  input: { readonly organizationId?: string } = {},
) {
  const started = await externalIdentityStart({
    allowDevelopmentFallback: true,
    database,
    input,
    realmId,
    providerId,
    providerPorts,
    runtime: testkit.runtime,
  })
  expect(started.success).toBe(true)
  if (!started.success) throw new Error(started.errorMessage)
  const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
  return externalIdentityCallback({
    allowDevelopmentFallback: true,
    code: "provider-code",
    database,
    realmId,
    providerId,
    providerPorts,
    state,
    runtime: testkit.runtime,
  })
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

test("external identity provider scopes are provider-specific, required, unique, and allowlisted", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "external-scopes.example.com")
    const input = {
      allowAccountCreation: true,
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: "Google",
      redirectUri: "https://app.test/callback",
      type: "google" as const,
    }
    for (const scopes of [["openid"], ["openid", "email", "email"], ["openid", "email", "admin"]]) {
      expect(
        externalIdentityProviderCreate({
          allowDevelopmentFallback: true,
          context: realmSystemContextCreate(),
          database,
          input: { ...input, scopes },
          realmId: realm.id,
        }).success,
      ).toBe(false)
    }
    expect(
      externalIdentityProviderCreate({
        allowDevelopmentFallback: true,
        context: realmSystemContextCreate(),
        database,
        input: { ...input, scopes: ["openid", "email"] },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      externalIdentityProviderCreate({
        allowDevelopmentFallback: true,
        context: realmSystemContextCreate(),
        database,
        input: { ...input, displayName: "GitHub", type: "github", scopes: ["openid", "email"] },
        realmId: realm.id,
      }).success,
    ).toBe(false)
  })
})

test("an enrolled usable passkey prevents unlinking the last external identity", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-passkey-only.example.com")
    const provider = await createProvider(database, realm.id)
    const context = realmTenantContextCreate(realm.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "passkey-only@example.com",
        password: "Correct Horse 12",
        profile: {},
        userName: "passkey-only",
      },
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(registered.success).toBe(true)
    if (!registered.success) return
    expect(
      passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
    ).toBe(true)
    const login = passwordLogin({
      context,
      database,
      input: { identifier: "passkey-only", password: "Correct Horse 12" },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const userId = login.data.authentication.userId
    const now = testkit.runtime.now()
    database.db
      .insert(passkeyCredentialTable)
      .values({
        aaguid: "aaguid",
        backedUp: 0,
        counter: 0,
        createdAt: now,
        credentialId: "passkey-credential",
        deviceType: "singleDevice",
        id: "passkey-credential-id",
        lastUsedAt: null,
        publicKey: Buffer.from("public-key"),
        realmId: realm.id,
        revokedAt: null,
        rpId: "example.com",
        transports: JSON.stringify(["internal"]),
        userId,
        version: 1,
      })
      .run()
    expect(
      externalIdentityRepositoryCreate(database.db).externalIdentityCreate({
        createdAt: now,
        displayName: "External",
        email: "external@example.com",
        emailVerified: true,
        externalSubject: "passkey-only-subject",
        id: "passkey-only-identity",
        providerId: provider.id,
        realmId: realm.id,
        updatedAt: now,
        userId,
        username: null,
        version: 1,
      }).success,
    ).toBe(true)
    database.db.delete(passwordCredentialTable).run()

    expect(
      externalIdentityUnlink({
        database,
        externalSubject: "passkey-only-subject",
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: login.data.session.session,
        userId,
      }),
    ).toMatchObject({ code: "external-identities.conflict", success: false })
    database.db
      .update(passkeyCredentialTable)
      .set({ revokedAt: now })
      .where(eq(passkeyCredentialTable.id, "passkey-credential-id"))
      .run()
    expect(
      externalIdentityUnlink({
        database,
        externalSubject: "passkey-only-subject",
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: login.data.session.session,
        userId,
      }).success,
    ).toBe(true)
  })
})

test("external identity login validates state and creates a session without exposing provider secrets", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-login.example.com")
    const provider = await createProvider(database, realm.id)
    const ports = { google: testPort() }
    const started = await externalIdentityStart({
      allowDevelopmentFallback: true,
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
      allowDevelopmentFallback: true,
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
          allowDevelopmentFallback: true,
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

test("external identity callbacks reject altered state, nonce, and provider-enforced PKCE", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-callback-security.example.com")
    const provider = await createProvider(database, realm.id)
    let mode: "nonce" | "pkce" = "nonce"
    let callbackPkceVerifier: string | undefined
    const port: ExternalIdentityProviderPort = {
      authorizationUrlCreate(_configuration, input) {
        return resultCreate(`https://provider.test/authorize?state=${encodeURIComponent(input.state)}`)
      },
      callbackExchange(_configuration, input) {
        callbackPkceVerifier = input.pkceVerifier
        if (mode === "pkce")
          return Promise.resolve(
            resultErrorCreate(
              "externalIdentityCallbackTest",
              "The provider rejected the PKCE verifier.",
              "external-identities.invalid",
            ),
          )
        return Promise.resolve(
          resultCreate({
            displayName: "Callback security user",
            email: "callback-security@example.com",
            emailVerified: true,
            externalSubject: "callback-security-subject",
            nonce: "wrong-nonce",
            providerType: "google",
          }),
        )
      },
    }
    const started = await externalIdentityStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      realmId: realm.id,
      providerId: provider.id,
      providerPorts: { google: port },
      runtime: testkit.runtime,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const state = new URL(started.data.authorizationUrl).searchParams.get("state") ?? ""
    expect(
      (
        await externalIdentityCallback({
          allowDevelopmentFallback: true,
          code: "code",
          database,
          providerId: provider.id,
          providerPorts: { google: port },
          realmId: realm.id,
          state: `${state}-altered`,
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
    expect(
      (
        await externalIdentityCallback({
          allowDevelopmentFallback: true,
          code: "code",
          database,
          providerId: provider.id,
          providerPorts: { google: port },
          realmId: realm.id,
          state,
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
    mode = "pkce"
    expect(
      (
        await externalIdentityCallback({
          allowDevelopmentFallback: true,
          code: "code",
          database,
          providerId: provider.id,
          providerPorts: { google: port },
          realmId: realm.id,
          state,
          runtime: testkit.runtime,
        })
      ).success,
    ).toBe(false)
    expect(callbackPkceVerifier).toBeString()
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
    const linkStart = await externalIdentityLinkStart({
      allowDevelopmentFallback: true,
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
      allowDevelopmentFallback: true,
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
    const started = await externalIdentityStart({
      allowDevelopmentFallback: true,
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
      allowDevelopmentFallback: true,
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

test("disabled external identity auto-linking preserves confirmation linking", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-link.example.com")
    const provider = await createProvider(database, realm.id)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowExternalIdentityAutoLinking: false },
        realmId: realm.id,
      }).success,
    ).toBe(true)
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
    const conflictStart = await externalIdentityStart({
      allowDevelopmentFallback: true,
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
      allowDevelopmentFallback: true,
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
    const linkStart = await externalIdentityLinkStart({
      allowDevelopmentFallback: true,
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
      allowDevelopmentFallback: true,
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

test("verified Google identities honor realm and organization auto-link policy precedence", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-auto-link-policy.example.com")
    const organizationResult = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "External auto-link organization" },
      realmId: realm.id,
    })
    expect(organizationResult.success).toBe(true)
    if (!organizationResult.success) return
    const organization = organizationResult.data.organization
    const provider = await createProvider(database, realm.id, true, "google", organization.id)

    const defaultUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "default-link@example.com",
      "default-link",
    )
    const defaultCallback = await externalIdentityLogin(
      database,
      testkit,
      realm.id,
      provider.id,
      { google: testPort("DEFAULT-LINK@EXAMPLE.COM", { externalSubject: "default-link" }) },
      { organizationId: organization.id },
    )
    expect(defaultCallback).toMatchObject({
      data: { authentication: { userId: defaultUser.id }, kind: "authenticated" },
      success: true,
    })
    expect(
      database.db
        .select()
        .from(externalIdentityTable)
        .where(eq(externalIdentityTable.externalSubject, "default-link"))
        .get(),
    ).toMatchObject({ email: "default-link@example.com", userId: defaultUser.id })

    const inheritedUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "inherited-link@example.com",
      "inherited-link",
    )
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowExternalIdentityAutoLinking: null },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const inheritedCallback = await externalIdentityLogin(
      database,
      testkit,
      realm.id,
      provider.id,
      { google: testPort("inherited-link@example.com", { externalSubject: "inherited-link" }) },
      { organizationId: organization.id },
    )
    expect(inheritedCallback).toMatchObject({
      data: { authentication: { userId: inheritedUser.id }, kind: "authenticated" },
      success: true,
    })

    const organizationDisabledUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "organization-disabled-link@example.com",
      "organization-disabled-link",
    )
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowExternalIdentityAutoLinking: false },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const organizationDisabledCallback = await externalIdentityLogin(
      database,
      testkit,
      realm.id,
      provider.id,
      { google: testPort("organization-disabled-link@example.com", { externalSubject: "organization-disabled" }) },
      { organizationId: organization.id },
    )
    expect(organizationDisabledCallback).toMatchObject({
      code: "external-identities.already-exists",
      success: false,
    })
    expect(
      database.db
        .select()
        .from(externalIdentityTable)
        .where(eq(externalIdentityTable.userId, organizationDisabledUser.id))
        .all(),
    ).toHaveLength(0)

    const inheritedDisabledUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "inherited-disabled-link@example.com",
      "inherited-disabled-link",
    )
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowExternalIdentityAutoLinking: null },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowExternalIdentityAutoLinking: false },
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const inheritedDisabledCallback = await externalIdentityLogin(
      database,
      testkit,
      realm.id,
      provider.id,
      { google: testPort("inherited-disabled-link@example.com", { externalSubject: "inherited-disabled" }) },
      { organizationId: organization.id },
    )
    expect(inheritedDisabledCallback).toMatchObject({
      code: "external-identities.already-exists",
      success: false,
    })
    expect(
      database.db
        .select()
        .from(externalIdentityTable)
        .where(eq(externalIdentityTable.userId, inheritedDisabledUser.id))
        .all(),
    ).toHaveLength(0)

    const organizationEnabledUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "organization-enabled-link@example.com",
      "organization-enabled-link",
    )
    expect(
      organizationLoginPolicySet({
        context: realmSystemContextCreate(),
        database,
        input: { allowExternalIdentityAutoLinking: true },
        organizationId: organization.id,
        realmId: realm.id,
      }).success,
    ).toBe(true)
    const organizationEnabledCallback = await externalIdentityLogin(
      database,
      testkit,
      realm.id,
      provider.id,
      { google: testPort("organization-enabled-link@example.com", { externalSubject: "organization-enabled" }) },
      { organizationId: organization.id },
    )
    expect(organizationEnabledCallback).toMatchObject({
      data: { authentication: { userId: organizationEnabledUser.id }, kind: "authenticated" },
      success: true,
    })
  })
})

test("only eligible verified identities auto-link within their realm", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-auto-link-eligibility.example.com")
    const googleProvider = await createProvider(database, realm.id)
    const googleUnverifiedUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "google-unverified@example.com",
      "google-unverified",
    )
    const googleUnverified = await externalIdentityLogin(database, testkit, realm.id, googleProvider.id, {
      google: testPort("google-unverified@example.com", { emailVerified: false, externalSubject: "google-unverified" }),
    })
    expect(googleUnverified.success).toBe(false)
    expect(
      database.db
        .select()
        .from(externalIdentityTable)
        .where(eq(externalIdentityTable.userId, googleUnverifiedUser.id))
        .all(),
    ).toHaveLength(0)

    const microsoftProvider = await createProvider(database, realm.id, true, "microsoft")
    const microsoftUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "microsoft@example.com",
      "microsoft-user",
    )
    const microsoft = await externalIdentityLogin(database, testkit, realm.id, microsoftProvider.id, {
      microsoft: testPort("microsoft@example.com", { externalSubject: "microsoft", providerType: "microsoft" }),
    })
    expect(microsoft).toMatchObject({
      data: { authentication: { userId: microsoftUser.id }, kind: "authenticated" },
      success: true,
    })
    expect(
      database.db.select().from(externalIdentityTable).where(eq(externalIdentityTable.userId, microsoftUser.id)).all(),
    ).toHaveLength(1)

    const githubProvider = await createProvider(database, realm.id, true, "github")
    const githubVerifiedUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "github-verified@example.com",
      "github-verified",
    )
    const githubVerified = await externalIdentityLogin(database, testkit, realm.id, githubProvider.id, {
      github: testPort("github-verified@example.com", { externalSubject: "github-verified", providerType: "github" }),
    })
    expect(githubVerified).toMatchObject({
      data: { authentication: { userId: githubVerifiedUser.id }, kind: "authenticated" },
      success: true,
    })
    const githubUnverifiedUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "github-unverified@example.com",
      "github-unverified",
    )
    const githubUnverified = await externalIdentityLogin(database, testkit, realm.id, githubProvider.id, {
      github: testPort("github-unverified@example.com", {
        emailVerified: false,
        externalSubject: "github-unverified",
        providerType: "github",
      }),
    })
    expect(githubUnverified.success).toBe(false)
    expect(
      database.db
        .select()
        .from(externalIdentityTable)
        .where(eq(externalIdentityTable.userId, githubUnverifiedUser.id))
        .all(),
    ).toHaveLength(0)
    const inactiveUser = await createVerifiedUser(database, testkit, realm.id, "inactive@example.com", "inactive-user")
    database.db.update(userTable).set({ state: "inactive" }).where(eq(userTable.id, inactiveUser.id)).run()
    const inactive = await externalIdentityLogin(database, testkit, realm.id, githubProvider.id, {
      github: testPort("inactive@example.com", { externalSubject: "inactive", providerType: "github" }),
    })
    expect(inactive).toMatchObject({ code: "external-identities.already-exists", success: false })

    const deletedUser = await createVerifiedUser(database, testkit, realm.id, "deleted@example.com", "deleted-user")
    database.db
      .update(userTable)
      .set({ deletedAt: testkit.runtime.now(), state: "deleted" })
      .where(eq(userTable.id, deletedUser.id))
      .run()
    const deleted = await externalIdentityLogin(database, testkit, realm.id, githubProvider.id, {
      github: testPort("deleted@example.com", { externalSubject: "deleted", providerType: "github" }),
    })
    expect(deleted).toMatchObject({ code: "external-identities.already-exists", success: false })

    const otherRealm = await createRealm(database, "external-auto-link-other-realm.example.com")
    const otherRealmProvider = await createProvider(database, otherRealm.id)
    const wrongRealmUser = await createVerifiedUser(
      database,
      testkit,
      realm.id,
      "wrong-realm@example.com",
      "wrong-realm-user",
    )
    const wrongRealm = await externalIdentityLogin(database, testkit, otherRealm.id, otherRealmProvider.id, {
      google: testPort("wrong-realm@example.com", { externalSubject: "wrong-realm" }),
    })
    expect(wrongRealm.success).toBe(true)
    if (!wrongRealm.success || !("authentication" in wrongRealm.data)) return
    const wrongRealmUserId = wrongRealm.data.authentication.userId
    expect(wrongRealmUserId).not.toBe(wrongRealmUser.id)
    expect(
      database.db
        .select()
        .from(externalIdentityTable)
        .where(eq(externalIdentityTable.externalSubject, "wrong-realm"))
        .get(),
    ).toMatchObject({ realmId: otherRealm.id, userId: wrongRealmUserId })
  })
})

test("an existing external provider subject remains bound to its original account", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-existing-link.example.com")
    const provider = await createProvider(database, realm.id)
    const original = await createVerifiedUser(database, testkit, realm.id, "original@example.com", "original-user")
    const other = await createVerifiedUser(database, testkit, realm.id, "other@example.com", "other-user")
    const created = externalIdentityRepositoryCreate(database.db).externalIdentityCreate({
      createdAt: testkit.runtime.now(),
      displayName: "Original external identity",
      email: original.email,
      emailVerified: true,
      externalSubject: "already-linked",
      id: "already-linked-identity",
      providerId: provider.id,
      realmId: realm.id,
      updatedAt: testkit.runtime.now(),
      userId: original.id,
      username: "original",
      version: 1,
    })
    expect(created.success).toBe(true)
    const callback = await externalIdentityLogin(database, testkit, realm.id, provider.id, {
      google: testPort(other.email, { externalSubject: "already-linked" }),
    })
    expect(callback.success).toBe(true)
    if (!callback.success || callback.data.kind !== "authenticated") throw new Error("Expected authenticated callback")
    expect(callback).toMatchObject({
      data: { authentication: { userId: original.id }, kind: "authenticated" },
      success: true,
    })
    expect(
      database.db
        .select()
        .from(externalIdentityTable)
        .where(eq(externalIdentityTable.externalSubject, "already-linked"))
        .get(),
    ).toMatchObject({ email: original.email, userId: original.id })
  })
})

test("external identity account and event writes roll back together", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-atomic.example.com")
    const provider = await createProvider(database, realm.id)
    const existing = await createVerifiedUser(database, testkit, realm.id, "atomic-link@example.com", "atomic-link")
    const ports = { google: testPort("atomic-link@example.com", { externalSubject: "atomic-link" }) }
    const started = await externalIdentityStart({
      allowDevelopmentFallback: true,
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
    const transaction = database.db.select().from(externalIdentityOAuthTransactionTable).get()
    expect(transaction).not.toBeUndefined()
    database.sqlite.run(
      "CREATE TRIGGER reject_external_identity_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'external_identity' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const before = database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()
    const callback = await externalIdentityCallback({
      allowDevelopmentFallback: true,
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
    expect(
      database.db
        .select({ consumedAt: externalIdentityOAuthTransactionTable.consumedAt })
        .from(externalIdentityOAuthTransactionTable)
        .where(eq(externalIdentityOAuthTransactionTable.id, transaction?.id ?? ""))
        .get(),
    ).toEqual({ consumedAt: null })
    expect(
      database.db.select().from(externalIdentityTable).where(eq(externalIdentityTable.userId, existing.id)).all(),
    ).toHaveLength(0)
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
    const started = await externalIdentityStart({
      allowDevelopmentFallback: true,
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
          allowDevelopmentFallback: true,
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

test("provider adapters reject incomplete token responses and require authoritative GitHub email verification", async () => {
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
      email: "secondary@example.com",
      emailVerified: true,
      externalSubject: "42",
      providerType: "github",
    },
    success: true,
  })

  let profileEmailEndpointCalled = false
  const profileEmailFetcher = providerFetchCreate(async (input) => {
    const url = input.toString()
    if (url === "https://github.com/login/oauth/access_token")
      return providerJsonResponse({ access_token: "access-token" })
    if (url === "https://api.github.com/user")
      return providerJsonResponse({ id: 43, login: "profile-email", email: "profile@example.com" })
    if (url === "https://api.github.com/user/emails") {
      profileEmailEndpointCalled = true
      return providerJsonResponse([])
    }
    return providerJsonResponse({}, 404)
  })
  const profileEmailGithub = externalIdentityProviderPortCreate({ fetch: profileEmailFetcher }).github
  expect(profileEmailGithub).toBeDefined()
  if (profileEmailGithub === undefined) return
  const profileEmailIdentity = await profileEmailGithub.callbackExchange(
    {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://app.test/callback",
      scopes: ["user:email"],
      type: "github",
    },
    { code: "code", pkceVerifier: "verifier" },
  )
  expect(profileEmailIdentity).toMatchObject({
    data: { email: "profile@example.com", emailVerified: false, externalSubject: "43" },
    success: true,
  })
  expect(profileEmailEndpointCalled).toBe(true)
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
      allowDevelopmentFallback: true,
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
    // Direct hosted-login sign-in has no OIDC interaction, so a browser callback redirects into
    // the UI with the session cookie instead of rendering raw JSON.
    expect(callback.status).toBe(302)
    expect(callback.headers.get("location")).toBe("/account")
    const cookie = callback.headers.get("set-cookie") ?? ""
    const token = /^session=([^;]+);/.exec(cookie)?.[1]
    expect(token).toHaveLength(43)
    expect(await callback.text()).toBe("")
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
      accountUiOrigin: "https://external-me-alpha.example.com",
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
    const realmOnlyProviders = await client.externalIdentityProviderMeList(alpha.id)
    expect(realmOnlyProviders).toMatchObject({ data: { items: [{ id: provider.id }] }, success: true })
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

test("linking works with a stale session and requests the provider account chooser", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "external-link-stale.example.com")
    const provider = await createProvider(database, realm.id, true, "github")
    const ports = {
      github: testPort("link-stale@example.com", { externalSubject: "stale-subject", providerType: "github" }),
    }
    const anonymous = realmTenantContextCreate(realm.id, "anonymous")
    let token = ""
    const registered = passwordRegister({
      context: anonymous,
      database,
      input: {
        email: "link-stale@example.com",
        password: "Correct Horse 12",
        profile: { displayName: "Link stale" },
        userName: "link-stale",
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
    const login = passwordLogin({
      context: anonymous,
      database,
      input: { identifier: "link-stale", password: "Correct Horse 12" },
      realmId: realm.id,
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    // Age the session past any freshness window: the provider round-trip plus the explicit
    // confirmation authorizes the link, exactly like every other OAuth connect flow.
    testkit.advance(6 * 60 * 1_000)
    const linkStart = await externalIdentityLinkStart({
      allowDevelopmentFallback: true,
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
    const authorizationUrl = new URL(linkStart.data.authorizationUrl)
    expect(authorizationUrl.searchParams.get("prompt")).toBe("select_account")
    const linkState = authorizationUrl.searchParams.get("state") ?? ""
    const pending = await externalIdentityCallback({
      allowDevelopmentFallback: true,
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
  })
})

type AppleTestKeys = {
  readonly clientSecretPem: string
  readonly clientSecretPublicKey: KeyObject
  readonly idTokenPrivateKey: KeyObject
  readonly jwks: { readonly keys: readonly Record<string, unknown>[] }
}

function appleTestKeysCreate(): AppleTestKeys {
  const clientSecretKeys = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
  const idTokenKeys = generateKeyPairSync("rsa", { modulusLength: 2048 })
  return {
    clientSecretPem: clientSecretKeys.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    clientSecretPublicKey: clientSecretKeys.publicKey,
    idTokenPrivateKey: idTokenKeys.privateKey,
    jwks: {
      keys: [
        {
          ...(idTokenKeys.publicKey.export({ format: "jwk" }) as Record<string, unknown>),
          alg: "RS256",
          kid: "apple-signing-key",
          use: "sig",
        },
      ],
    },
  }
}

function appleIdTokenCreate(privateKey: KeyObject, claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "apple-signing-key" }), "utf8").toString("base64url")
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`, "utf8"), privateKey)
  return `${header}.${payload}.${signature.toString("base64url")}`
}

function appleIdTokenClaimsCreate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1_000)
  return {
    aud: "com.example.services",
    email: "ada@example.com",
    email_verified: "true",
    exp: now + 600,
    iat: now,
    iss: "https://appleid.apple.com",
    sub: "apple-sub-1",
    ...overrides,
  }
}

function appleFetchCreate(options: {
  readonly idTokenGet: () => string
  readonly jwks: Record<string, unknown>
  readonly requests: string[]
  readonly tokenBodies: URLSearchParams[]
}): typeof fetch {
  return providerFetchCreate(async (input, init) => {
    const target = input.toString()
    options.requests.push(target)
    if (target === "https://appleid.apple.com/auth/token") {
      const rawBody =
        typeof init?.body === "string" ? init.body : ((init?.body as { toString(): string })?.toString() ?? "")
      options.tokenBodies.push(new URLSearchParams(rawBody))
      return providerJsonResponse({
        access_token: "apple-access-token",
        expires_in: 3600,
        id_token: options.idTokenGet(),
        token_type: "Bearer",
      })
    }
    if (target === "https://appleid.apple.com/auth/keys") return providerJsonResponse(options.jwks)
    return providerJsonResponse({}, 404)
  })
}

async function appleProviderCreate(database: StorageDatabase, realmId: string, clientSecretPem: string) {
  const created = externalIdentityProviderCreate({
    allowDevelopmentFallback: true,
    context: realmSystemContextCreate(),
    database,
    input: {
      allowAccountCreation: true,
      appleKeyId: "APPLEKEYID1",
      appleTeamId: "APPLETEAMID",
      clientId: "com.example.services",
      clientSecret: clientSecretPem,
      displayName: "Apple",
      redirectUri: "https://app.test/callback",
      type: "apple",
    },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.provider
}

async function appleSignInStart(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  providerId: string,
  providerPorts: Parameters<typeof externalIdentityStart>[0]["providerPorts"],
) {
  const started = await externalIdentityStart({
    allowDevelopmentFallback: true,
    database,
    input: {},
    providerId,
    providerPorts,
    realmId,
    runtime: testkit.runtime,
  })
  expect(started.success).toBe(true)
  if (!started.success) throw new Error(started.errorMessage)
  const url = new URL(started.data.authorizationUrl)
  return { state: url.searchParams.get("state") ?? "", nonce: url.searchParams.get("nonce") ?? "", url }
}

test("apple provider authorize URL uses form_post without prompt or PKCE parameters", () => {
  const port = externalIdentityProviderPortCreate().apple
  expect(port).toBeDefined()
  if (port === undefined) return
  const authorization = port.authorizationUrlCreate(
    {
      appleKeyId: "APPLEKEYID1",
      appleTeamId: "APPLETEAMID",
      clientId: "com.example.services",
      clientSecret: "secret",
      redirectUri: "https://app.test/callback",
      scopes: ["name", "email"],
      type: "apple",
    },
    { nonce: "nonce", pkceChallenge: "challenge", prompt: "select_account", state: "state" },
  )
  expect(authorization.success).toBe(true)
  if (!authorization.success) return
  const url = new URL(authorization.data)
  expect(`${url.origin}${url.pathname}`).toBe("https://appleid.apple.com/auth/authorize")
  const query = url.searchParams
  expect(query.get("client_id")).toBe("com.example.services")
  expect(query.get("redirect_uri")).toBe("https://app.test/callback")
  expect(query.get("response_type")).toBe("code")
  expect(query.get("response_mode")).toBe("form_post")
  expect(query.get("scope")).toBe("name email")
  expect(query.get("state")).toBe("state")
  expect(query.get("nonce")).toBe("nonce")
  expect(query.get("prompt")).toBeNull()
  expect(query.get("code_challenge")).toBeNull()
})

test("apple sign-in verifies the id token, signs the client secret, and keeps the first-login name", async () => {
  await withDatabase(async (database, testkit) => {
    const keys = appleTestKeysCreate()
    const realm = await createRealm(database, "external-apple.example.com")
    const provider = await appleProviderCreate(database, realm.id, keys.clientSecretPem)
    let currentIdToken = ""
    const requests: string[] = []
    const tokenBodies: URLSearchParams[] = []
    const ports = externalIdentityProviderPortCreate({
      fetch: appleFetchCreate({ idTokenGet: () => currentIdToken, jwks: keys.jwks, requests, tokenBodies }),
    })
    const { state, nonce, url } = await appleSignInStart(database, testkit, realm.id, provider.id, ports)
    expect(url.searchParams.get("scope")).toBe("name email")
    expect(nonce.length).toBeGreaterThan(0)
    // Apple sends a private relay address with a string-verified flag; it is stored as the account email.
    currentIdToken = appleIdTokenCreate(
      keys.idTokenPrivateKey,
      appleIdTokenClaimsCreate({ email: "relay-9f3k2@privaterelay.appleid.com", nonce }),
    )
    const callback = await externalIdentityCallback({
      allowDevelopmentFallback: true,
      appleUserField: JSON.stringify({
        email: "relay-9f3k2@privaterelay.appleid.com",
        name: { firstName: "Ada", lastName: "Lovelace" },
      }),
      code: "apple-code",
      database,
      providerId: provider.id,
      providerPorts: ports,
      realmId: realm.id,
      runtime: testkit.runtime,
      state,
    })
    expect(callback.success).toBe(true)
    if (!callback.success || callback.data.kind !== "authenticated") return
    expect(callback.data.identity).toMatchObject({
      email: "relay-9f3k2@privaterelay.appleid.com",
      emailVerified: true,
      externalSubject: "apple-sub-1",
      providerType: "apple",
    })
    // The token endpoint receives the documented parameters with a freshly signed client secret.
    expect(requests).toEqual(["https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/keys"])
    const body = tokenBodies[0]
    expect(body?.get("client_id")).toBe("com.example.services")
    expect(body?.get("grant_type")).toBe("authorization_code")
    expect(body?.get("code")).toBe("apple-code")
    expect(body?.get("redirect_uri")).toBe("https://app.test/callback")
    expect(body?.get("code_verifier")).toBeNull()
    const secret = body?.get("client_secret") ?? ""
    const secretParts = secret.split(".")
    expect(secretParts).toHaveLength(3)
    expect(JSON.parse(Buffer.from(secretParts[0] as string, "base64url").toString("utf8"))).toMatchObject({
      alg: "ES256",
      kid: "APPLEKEYID1",
    })
    const secretPayload = JSON.parse(Buffer.from(secretParts[1] as string, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >
    expect(secretPayload).toMatchObject({
      aud: "https://appleid.apple.com",
      iss: "APPLETEAMID",
      sub: "com.example.services",
    })
    expect(Number(secretPayload.exp) - Number(secretPayload.iat)).toBe(15 * 60)
    expect(
      verify(
        "sha256",
        Buffer.from(`${secretParts[0]}.${secretParts[1]}`, "utf8"),
        { dsaEncoding: "ieee-p1363", key: keys.clientSecretPublicKey },
        Buffer.from(secretParts[2] as string, "base64url"),
      ),
    ).toBe(true)
    const userId = callback.data.authentication.userId
    const profile = database.db.select().from(userProfileTable).where(eq(userProfileTable.userId, userId)).get()
    expect(profile).toMatchObject({ displayName: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace" })
    expect(database.db.select().from(userTable).where(eq(userTable.id, userId)).get()?.email).toBe(
      "relay-9f3k2@privaterelay.appleid.com",
    )
    // A returning sign-in without the user field links by the stable subject.
    const again = await appleSignInStart(database, testkit, realm.id, provider.id, ports)
    currentIdToken = appleIdTokenCreate(
      keys.idTokenPrivateKey,
      appleIdTokenClaimsCreate({ email: "relay-9f3k2@privaterelay.appleid.com", nonce: again.nonce }),
    )
    const relink = await externalIdentityCallback({
      allowDevelopmentFallback: true,
      code: "apple-code-2",
      database,
      providerId: provider.id,
      providerPorts: ports,
      realmId: realm.id,
      runtime: testkit.runtime,
      state: again.state,
    })
    expect(relink).toMatchObject({ data: { authentication: { userId }, kind: "authenticated" }, success: true })
  })
})

test("apple sign-in links a verified email to an existing account", async () => {
  await withDatabase(async (database, testkit) => {
    const keys = appleTestKeysCreate()
    const realm = await createRealm(database, "external-apple-link.example.com")
    const user = await createVerifiedUser(database, testkit, realm.id, "ada@example.com", "ada")
    const provider = await appleProviderCreate(database, realm.id, keys.clientSecretPem)
    let currentIdToken = ""
    const ports = externalIdentityProviderPortCreate({
      fetch: appleFetchCreate({ idTokenGet: () => currentIdToken, jwks: keys.jwks, requests: [], tokenBodies: [] }),
    })
    const { state, nonce } = await appleSignInStart(database, testkit, realm.id, provider.id, ports)
    // A different Apple subject with the same verified email auto-links, like Google.
    currentIdToken = appleIdTokenCreate(
      keys.idTokenPrivateKey,
      appleIdTokenClaimsCreate({ email: "ada@example.com", nonce, sub: "apple-sub-2" }),
    )
    const callback = await externalIdentityCallback({
      allowDevelopmentFallback: true,
      code: "apple-code",
      database,
      providerId: provider.id,
      providerPorts: ports,
      realmId: realm.id,
      runtime: testkit.runtime,
      state,
    })
    expect(callback).toMatchObject({
      data: { authentication: { userId: user.id }, kind: "authenticated" },
      success: true,
    })
  })
})

test("apple provider rejects invalid issuers, audiences, nonces, expiries, and malformed first-login payloads", async () => {
  const keys = appleTestKeysCreate()
  const otherKeys = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const configuration = {
    appleKeyId: "APPLEKEYID1",
    appleTeamId: "APPLETEAMID",
    clientId: "com.example.services",
    clientSecret: keys.clientSecretPem,
    redirectUri: "https://app.test/callback",
    scopes: ["name", "email"],
    type: "apple" as const,
  }
  const input = {
    appleUserField: undefined as string | undefined,
    code: "code",
    nonce: "expected-nonce",
    pkceVerifier: "verifier",
  }
  const exchange = async (claims: Record<string, unknown>, exchangeInput = input, tokenStatus = 200) => {
    let currentIdToken = ""
    const ports = externalIdentityProviderPortCreate({
      fetch: providerFetchCreate(async (target) => {
        if (target.toString() === "https://appleid.apple.com/auth/token")
          return providerJsonResponse({ access_token: "apple-access-token", id_token: currentIdToken }, tokenStatus)
        if (target.toString() === "https://appleid.apple.com/auth/keys") return providerJsonResponse(keys.jwks)
        return providerJsonResponse({}, 404)
      }),
    })
    currentIdToken = appleIdTokenCreate(keys.idTokenPrivateKey, claims)
    return ports.apple?.callbackExchange(configuration, { ...exchangeInput })
  }
  const past = Math.floor(Date.now() / 1_000) - 3_600
  for (const claims of [
    appleIdTokenClaimsCreate({ iss: "https://evil.example", nonce: "expected-nonce" }),
    appleIdTokenClaimsCreate({ aud: "other-client", nonce: "expected-nonce" }),
    appleIdTokenClaimsCreate({ nonce: "other-nonce" }),
    appleIdTokenClaimsCreate({ exp: past, iat: past - 600, nonce: "expected-nonce" }),
    appleIdTokenClaimsCreate({ nonce: "expected-nonce", sub: undefined }),
  ]) {
    expect((await exchange(claims))?.success).toBe(false)
  }
  // A token signed by another key fails verification.
  const forged = appleIdTokenCreate(otherKeys.privateKey, appleIdTokenClaimsCreate({ nonce: "expected-nonce" }))
  const forgedPorts = externalIdentityProviderPortCreate({
    fetch: providerFetchCreate(async (target) => {
      if (target.toString() === "https://appleid.apple.com/auth/token")
        return providerJsonResponse({ access_token: "apple-access-token", id_token: forged })
      if (target.toString() === "https://appleid.apple.com/auth/keys") return providerJsonResponse(keys.jwks)
      return providerJsonResponse({}, 404)
    }),
  })
  expect((await forgedPorts.apple?.callbackExchange(configuration, input))?.success).toBe(false)
  // A missing id_token and an unreachable token endpoint both fail.
  const missingPorts = externalIdentityProviderPortCreate({
    fetch: providerFetchCreate(async (target) => {
      if (target.toString() === "https://appleid.apple.com/auth/token")
        return providerJsonResponse({ access_token: "apple-access-token" })
      if (target.toString() === "https://appleid.apple.com/auth/keys") return providerJsonResponse(keys.jwks)
      return providerJsonResponse({}, 404)
    }),
  })
  expect((await missingPorts.apple?.callbackExchange(configuration, input))?.success).toBe(false)
  expect((await exchange(appleIdTokenClaimsCreate({ nonce: "expected-nonce" }), input, 400))?.success).toBe(false)
  // Without team or key IDs the port fails before any network call.
  const unconfiguredPorts = externalIdentityProviderPortCreate({
    fetch: providerFetchCreate(async () => {
      throw new Error("must not call the network without Apple key configuration")
    }),
  })
  expect(
    (
      await unconfiguredPorts.apple?.callbackExchange(
        { ...configuration, appleKeyId: undefined, appleTeamId: undefined },
        input,
      )
    )?.success,
  ).toBe(false)
  // A malformed first-login user field fails instead of creating a nameless link.
  expect(
    (await exchange(appleIdTokenClaimsCreate({ nonce: "expected-nonce" }), { ...input, appleUserField: "not-json" }))
      ?.success,
  ).toBe(false)
  // A boolean false verification flag is honored without failing the exchange.
  const unverified = await exchange(appleIdTokenClaimsCreate({ email_verified: false, nonce: "expected-nonce" }))
  expect(unverified?.success).toBe(true)
  if (unverified?.success) expect(unverified.data.emailVerified).toBe(false)
})

test("apple form_post callback completes sign-in from a cross-site POST body", async () => {
  await withDatabase(async (database) => {
    const keys = appleTestKeysCreate()
    const realm = await createRealm(database, "apple-post.example.com")
    const provider = await appleProviderCreate(database, realm.id, keys.clientSecretPem)
    let currentIdToken = ""
    const ports = externalIdentityProviderPortCreate({
      fetch: appleFetchCreate({ idTokenGet: () => currentIdToken, jwks: keys.jwks, requests: [], tokenBodies: [] }),
    })
    const app = externalIdentityServerAppCreate({
      allowDevelopmentFallback: true,
      browserMode: true,
      database,
      providerPorts: ports,
    })
    const started = await app.request(
      `https://apple-post.example.com/realms/${realm.id}/external-identity/${provider.id}/start`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
    expect(started.status).toBe(200)
    const startedBody = (await started.json()) as { authorizationUrl: string }
    const startUrl = new URL(startedBody.authorizationUrl)
    expect(startUrl.searchParams.get("response_mode")).toBe("form_post")
    const state = startUrl.searchParams.get("state") ?? ""
    const nonce = startUrl.searchParams.get("nonce") ?? ""
    currentIdToken = appleIdTokenCreate(keys.idTokenPrivateKey, appleIdTokenClaimsCreate({ nonce }))
    const form = new URLSearchParams({
      code: "apple-code",
      state,
      user: JSON.stringify({ email: "ada@example.com", name: { firstName: "Ada", lastName: "Lovelace" } }),
    })
    const callback = await app.request(
      `https://apple-post.example.com/realms/${realm.id}/external-identity/${provider.id}/callback`,
      {
        body: form.toString(),
        headers: { "content-type": "application/x-www-form-urlencoded", [sessionBrowserModeHeaderName]: "true" },
        method: "POST",
      },
    )
    expect(callback.status).toBe(302)
    expect(callback.headers.get("location")).toBe("/account")
    const cookie = callback.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("HttpOnly")
    const token = /^session=([^;]+);/.exec(cookie)?.[1]
    expect(token).toHaveLength(43)
    // A denied authorization POST redirects to the provider failure page instead of hanging.
    const denied = await app.request(
      `https://apple-post.example.com/realms/${realm.id}/external-identity/${provider.id}/callback`,
      {
        body: new URLSearchParams({ error: "access_denied", state }).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded", [sessionBrowserModeHeaderName]: "true" },
        method: "POST",
      },
    )
    expect(denied.status).toBe(302)
    expect(denied.headers.get("location")).toBe(`/login/idp/${encodeURIComponent(provider.id)}/failure`)
  })
})

test("apple providers require team and key IDs while other providers forbid them", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "external-apple-config.example.com")
    const base = {
      allowAccountCreation: false,
      clientId: "com.example.services",
      clientSecret: "secret",
      displayName: "Apple",
      redirectUri: "https://app.test/callback",
      type: "apple" as const,
    }
    const context = { context: realmSystemContextCreate(), database, realmId: realm.id }
    expect(
      externalIdentityProviderCreate({ ...context, allowDevelopmentFallback: true, input: { ...base } }).success,
    ).toBe(false)
    expect(
      externalIdentityProviderCreate({
        ...context,
        allowDevelopmentFallback: true,
        input: { ...base, appleTeamId: "APPLETEAMID" },
      }).success,
    ).toBe(false)
    const created = externalIdentityProviderCreate({
      ...context,
      allowDevelopmentFallback: true,
      input: { ...base, appleKeyId: "APPLEKEYID1", appleTeamId: "APPLETEAMID" },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.provider).toMatchObject({ appleKeyId: "APPLEKEYID1", appleTeamId: "APPLETEAMID" })
    expect(
      externalIdentityProviderCreate({
        ...context,
        allowDevelopmentFallback: true,
        input: {
          allowAccountCreation: false,
          appleKeyId: "APPLEKEYID1",
          appleTeamId: "APPLETEAMID",
          clientId: "client-id",
          clientSecret: "secret",
          displayName: "Google",
          redirectUri: "https://app.test/callback",
          type: "google" as const,
        },
      }).success,
    ).toBe(false)
    const google = await createProvider(database, realm.id, true, "google")
    expect(
      externalIdentityProviderUpdate({
        ...context,
        allowDevelopmentFallback: true,
        input: { appleTeamId: "APPLETEAMID" },
        providerId: google.id,
      }).success,
    ).toBe(false)
    expect(
      externalIdentityProviderUpdate({
        ...context,
        allowDevelopmentFallback: true,
        input: { appleKeyId: "APPLEKEYID2" },
        providerId: created.data.provider.id,
      }),
    ).toMatchObject({ data: { provider: { appleKeyId: "APPLEKEYID2", appleTeamId: "APPLETEAMID" } }, success: true })
  })
})
