import { expect, test } from "bun:test"
import { createSign, generateKeyPairSync } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { externalIdentityAppleNotificationHandle } from "../../src/features/externalIdentities/actions/externalIdentityAppleNotificationHandle.js"
import { externalIdentityProviderCreate } from "../../src/features/externalIdentities/actions/externalIdentityProviderCreate.js"
import { externalIdentityStart } from "../../src/features/externalIdentities/actions/externalIdentityStart.js"
import { externalIdentityProviderPortCreate } from "../../src/features/externalIdentities/domain/externalIdentityProviderPortCreate.js"
import { externalIdentityRepositoryCreate } from "../../src/features/externalIdentities/persistence/externalIdentityRepositoryCreate.js"
import { appleRelayMailDeliveryGuardCreate } from "../../src/features/externalIdentities/server/appleRelayMailDeliveryGuardCreate.js"
import { externalIdentityServerAppCreate } from "../../src/features/externalIdentities/server/externalIdentityServerAppCreate.js"
import { smtpMailDeliveryPortCreate } from "../../src/features/email/server/smtpMailDeliveryPortCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"
import { userTable } from "../../src/features/users/persistence/userTable.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-apple-s2s-"))
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

async function createAppleProvider(database: StorageDatabase, realmId: string, clientId: string) {
  const created = externalIdentityProviderCreate({
    allowDevelopmentFallback: true,
    context: realmSystemContextCreate(),
    database,
    input: {
      allowAccountCreation: true,
      appleKeyId: "key-id",
      appleTeamId: "team-id",
      clientId,
      clientSecret: "fake-p8-key",
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

function linkIdentity(
  database: StorageDatabase,
  testkit: ReturnType<typeof platformTestkitCreate>,
  realmId: string,
  providerId: string,
  userId: string,
  externalSubject: string,
) {
  const now = testkit.runtime.now()
  const created = externalIdentityRepositoryCreate(database.db).externalIdentityCreate({
    createdAt: now,
    displayName: "Apple User",
    email: null,
    emailVerified: false,
    externalSubject,
    id: `identity-${externalSubject}`,
    providerId,
    realmId,
    updatedAt: now,
    userId,
    username: null,
    version: 1,
  })
  expect(created.success).toBe(true)
}

function appleTestKeysCreate() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const publicJwk = publicKey.export({ format: "jwk" })
  return { kid: "apple-key-id", privateKey, publicJwk: { ...publicJwk, kid: "apple-key-id", use: "sig" } }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function appleNotificationTokenCreate(
  privateKey: ReturnType<typeof appleTestKeysCreate>["privateKey"],
  kid: string,
  claims: Record<string, unknown>,
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }))
  const payload = base64UrlEncode(JSON.stringify(claims))
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKey).toString("base64url")
  return `${header}.${payload}.${signature}`
}

function appleNotificationClaimsCreate(
  audience: string,
  subject: string,
  type: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    aud: audience,
    events: { email: "relay@privaterelay.appleid.apple.com", sub: subject, type },
    exp: Math.floor(Date.now() / 1_000) + 600,
    iat: Math.floor(Date.now() / 1_000) - 60,
    iss: "https://appleid.apple.com",
    sub: subject,
    ...overrides,
  }
}

function appleFetchStubCreate(keys: ReturnType<typeof appleTestKeysCreate>): typeof fetch {
  return Object.assign(
    async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (url === "https://appleid.apple.com/auth/keys")
        return new Response(JSON.stringify({ keys: [keys.publicJwk] }), {
          headers: { "content-type": "application/json" },
        })
      throw new Error(`unexpected fetch ${url}`)
    },
    { preconnect: globalThis.fetch.preconnect },
  )
}

function userRelayFlagGet(database: StorageDatabase, realmId: string, userId: string): number | null | undefined {
  return database.db
    .select({ appleRelayEmailDisabledAt: userTable.appleRelayEmailDisabledAt })
    .from(userTable)
    .where(and(eq(userTable.id, userId), eq(userTable.realmId, realmId)))
    .get()?.appleRelayEmailDisabledAt
}

test("Apple email-disabled sets the relay flag and the SMTP path skips delivery", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "apple-s2s-disabled.example.com")
    const provider = await createAppleProvider(database, realm.id, "de.contentoren.test.signin")
    const user = await createVerifiedUser(database, testkit, realm.id, "relay@example.com", "relay-user")
    linkIdentity(database, testkit, realm.id, provider.id, user.id, "apple-subject-1")
    const keys = appleTestKeysCreate()

    const handled = await externalIdentityAppleNotificationHandle({
      database,
      fetch: appleFetchStubCreate(keys),
      payload: appleNotificationTokenCreate(
        keys.privateKey,
        keys.kid,
        appleNotificationClaimsCreate("de.contentoren.test.signin", "apple-subject-1", "email-disabled", {
          events: JSON.stringify({ sub: "apple-subject-1", type: "email-disabled" }),
          exp: undefined,
        }),
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(handled).toMatchObject({ data: { received: true }, success: true })

    const flag = userRelayFlagGet(database, realm.id, user.id)
    expect(typeof flag).toBe("number")

    const sent: string[] = []
    const inner = smtpMailDeliveryPortCreate({
      from: "authworks@example.com",
      host: "smtp.test",
      password: "secret",
      port: 587,
      security: "starttls",
      transport: {
        sendMail: async (message) => {
          sent.push(message.to)
          return { accepted: [message.to] }
        },
      },
      username: "authworks",
    })
    const guarded = appleRelayMailDeliveryGuardCreate({ database, inner })
    const skipped = await guarded.deliver({
      message: { html: "<p>hi</p>", subject: "OTP", text: "hi" },
      to: "relay@example.com",
    })
    expect(skipped.success).toBe(true)
    expect(sent).toEqual([])
  })
})

test("Apple email-enabled clears the relay flag and delivery resumes", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "apple-s2s-enabled.example.com")
    const provider = await createAppleProvider(database, realm.id, "de.contentoren.test.signin")
    const user = await createVerifiedUser(database, testkit, realm.id, "relay-back@example.com", "relay-back-user")
    linkIdentity(database, testkit, realm.id, provider.id, user.id, "apple-subject-2")
    const keys = appleTestKeysCreate()
    const fetch = appleFetchStubCreate(keys)

    const disabled = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: appleNotificationTokenCreate(
        keys.privateKey,
        keys.kid,
        appleNotificationClaimsCreate("de.contentoren.test.signin", "apple-subject-2", "email-disabled"),
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(disabled.success).toBe(true)
    expect(userRelayFlagGet(database, realm.id, user.id)).not.toBeNull()

    const enabled = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: appleNotificationTokenCreate(
        keys.privateKey,
        keys.kid,
        appleNotificationClaimsCreate("de.contentoren.test.signin", "apple-subject-2", "email-enabled"),
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(enabled).toMatchObject({ data: { received: true }, success: true })
    expect(userRelayFlagGet(database, realm.id, user.id)).toBeNull()

    const sent: string[] = []
    const guarded = appleRelayMailDeliveryGuardCreate({
      database,
      inner: smtpMailDeliveryPortCreate({
        from: "authworks@example.com",
        host: "smtp.test",
        password: "secret",
        port: 587,
        security: "starttls",
        transport: {
          sendMail: async (message) => {
            sent.push(message.to)
            return { accepted: [message.to] }
          },
        },
        username: "authworks",
      }),
    })
    const delivered = await guarded.deliver({
      message: { html: "<p>hi</p>", subject: "OTP", text: "hi" },
      to: "relay-back@example.com",
    })
    expect(delivered.success).toBe(true)
    expect(sent).toEqual(["relay-back@example.com"])
  })
})

test("Apple consent-revoked and account-delete remove only the identity row", async () => {
  for (const eventType of ["consent-revoked", "account-delete"]) {
    await withDatabase(async (database, testkit) => {
      const realm = await createRealm(database, `apple-s2s-${eventType}.example.com`)
      const provider = await createAppleProvider(database, realm.id, "de.contentoren.test.signin")
      const user = await createVerifiedUser(
        database,
        testkit,
        realm.id,
        `${eventType}@example.com`,
        `${eventType}-user`,
      )
      linkIdentity(database, testkit, realm.id, provider.id, user.id, `apple-subject-${eventType}`)
      const keys = appleTestKeysCreate()

      const handled = await externalIdentityAppleNotificationHandle({
        database,
        fetch: appleFetchStubCreate(keys),
        payload: appleNotificationTokenCreate(
          keys.privateKey,
          keys.kid,
          appleNotificationClaimsCreate("de.contentoren.test.signin", `apple-subject-${eventType}`, eventType),
        ),
        providerId: provider.id,
        realmId: realm.id,
        runtime: testkit.runtime,
      })
      expect(handled).toMatchObject({ data: { received: true }, success: true })

      const identity = externalIdentityRepositoryCreate(database.db).externalIdentityGetByProviderSubject(
        realm.id,
        provider.id,
        `apple-subject-${eventType}`,
      )
      expect(identity).toMatchObject({ data: null, success: true })
      const userStillThere = database.db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .get()
      expect(userStillThere?.id).toBe(user.id)
    })
  }
})

test("Apple notifications with an unknown subject succeed as a no-op", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "apple-s2s-unknown.example.com")
    const provider = await createAppleProvider(database, realm.id, "de.contentoren.test.signin")
    const keys = appleTestKeysCreate()

    const handled = await externalIdentityAppleNotificationHandle({
      database,
      fetch: appleFetchStubCreate(keys),
      payload: appleNotificationTokenCreate(
        keys.privateKey,
        keys.kid,
        appleNotificationClaimsCreate("de.contentoren.test.signin", "never-linked-subject", "consent-revoked"),
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(handled).toMatchObject({ data: { received: true }, success: true })
  })
})

test("Apple notifications accept the group App ID audience and reject anything else", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "apple-s2s-audience.example.com")
    const provider = await createAppleProvider(database, realm.id, "de.contentoren.test.signin")
    const user = await createVerifiedUser(database, testkit, realm.id, "audience@example.com", "audience-user")
    linkIdentity(database, testkit, realm.id, provider.id, user.id, "apple-subject-aud")
    const keys = appleTestKeysCreate()
    const fetch = appleFetchStubCreate(keys)

    const groupAudience = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: appleNotificationTokenCreate(
        keys.privateKey,
        keys.kid,
        appleNotificationClaimsCreate("de.contentoren.signin", "apple-subject-aud", "email-disabled"),
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(groupAudience).toMatchObject({ data: { received: true }, success: true })

    const foreignAudience = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: appleNotificationTokenCreate(
        keys.privateKey,
        keys.kid,
        appleNotificationClaimsCreate("com.evil.app", "apple-subject-aud", "email-disabled"),
      ),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(foreignAudience).toMatchObject({ code: "external-identities.invalid", success: false })
  })
})

test("Apple notifications reject invalid signatures, issuers, providers, and events", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "apple-s2s-invalid.example.com")
    const provider = await createAppleProvider(database, realm.id, "de.contentoren.test.signin")
    const google = await externalIdentityProviderCreate({
      allowDevelopmentFallback: true,
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "google-client",
        clientSecret: "google-secret",
        displayName: "Google",
        redirectUri: "https://app.test/callback",
        type: "google",
      },
      realmId: realm.id,
    })
    expect(google.success).toBe(true)
    if (!google.success) throw new Error(google.errorMessage)
    const user = await createVerifiedUser(database, testkit, realm.id, "invalid@example.com", "invalid-user")
    linkIdentity(database, testkit, realm.id, provider.id, user.id, "apple-subject-bad")
    const keys = appleTestKeysCreate()
    const fetch = appleFetchStubCreate(keys)
    const validClaims = appleNotificationClaimsCreate(
      "de.contentoren.test.signin",
      "apple-subject-bad",
      "email-disabled",
    )
    const valid = appleNotificationTokenCreate(keys.privateKey, keys.kid, validClaims)

    const tampered = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: `${valid.slice(0, -4)}AAAA`,
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(tampered).toMatchObject({ code: "external-identities.invalid", success: false })

    const wrongIssuer = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: appleNotificationTokenCreate(keys.privateKey, keys.kid, {
        ...validClaims,
        iss: "https://evil.example.com",
      }),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(wrongIssuer).toMatchObject({ code: "external-identities.invalid", success: false })

    const missingEvents = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: appleNotificationTokenCreate(keys.privateKey, keys.kid, {
        aud: "de.contentoren.test.signin",
        exp: Math.floor(Date.now() / 1_000) + 600,
        iss: "https://appleid.apple.com",
        sub: "apple-subject-bad",
      }),
      providerId: provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(missingEvents).toMatchObject({ code: "external-identities.invalid", success: false })

    const nonAppleProvider = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: valid,
      providerId: google.data.provider.id,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(nonAppleProvider).toMatchObject({ code: "external-identities.invalid", success: false })

    const unknownProvider = await externalIdentityAppleNotificationHandle({
      database,
      fetch,
      payload: valid,
      providerId: "01a00000-0000-7000-8000-000000000000",
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(unknownProvider).toMatchObject({ code: "external-identities.invalid", success: false })

    expect(userRelayFlagGet(database, realm.id, user.id)).toBeNull()
  })
})

test("Apple S2S route returns 200 for valid payloads and 400 for invalid ones", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "apple-s2s-route.example.com")
    const provider = await createAppleProvider(database, realm.id, "de.contentoren.test.signin")
    const user = await createVerifiedUser(database, testkit, realm.id, "route@example.com", "route-user")
    linkIdentity(database, testkit, realm.id, provider.id, user.id, "apple-subject-route")
    const app = externalIdentityServerAppCreate({ database })
    const endpoint = `http://apple-s2s-route.example.com/realms/${realm.id}/external-identity-providers/${provider.id}/apple-notifications`
    const form = (payload?: string) => {
      const body = new URLSearchParams()
      if (payload !== undefined) body.set("payload", payload)
      return body
    }

    const headers = { "content-type": "application/x-www-form-urlencoded" }
    const missing = await app.request(endpoint, { body: form(), headers, method: "POST" })
    expect(missing.status).toBe(400)

    const garbage = await app.request(endpoint, {
      body: form("not-a-jwt"),
      headers,
      method: "POST",
    })
    expect(garbage.status).toBe(400)

    const keys = appleTestKeysCreate()
    const originalFetch = globalThis.fetch
    globalThis.fetch = appleFetchStubCreate(keys) as typeof globalThis.fetch
    try {
      const valid = await app.request(endpoint, {
        body: form(
          appleNotificationTokenCreate(
            keys.privateKey,
            keys.kid,
            appleNotificationClaimsCreate("de.contentoren.test.signin", "apple-subject-route", "email-disabled"),
          ),
        ),
        headers,
        method: "POST",
      })
      expect(valid.status).toBe(200)
      expect(await valid.json()).toMatchObject({ received: true })
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(userRelayFlagGet(database, realm.id, user.id)).not.toBeNull()
  })
})

test("Apple and Google login start still point at the provider authorize endpoints", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "login-start.example.com")
    const apple = await createAppleProvider(database, realm.id, "de.contentoren.start.signin")
    const google = await externalIdentityProviderCreate({
      allowDevelopmentFallback: true,
      context: realmSystemContextCreate(),
      database,
      input: {
        allowAccountCreation: true,
        clientId: "google-start-client",
        clientSecret: "google-secret",
        displayName: "Google",
        redirectUri: "https://app.test/callback",
        type: "google",
      },
      realmId: realm.id,
    })
    expect(google.success).toBe(true)
    if (!google.success) throw new Error(google.errorMessage)
    const ports = externalIdentityProviderPortCreate()

    const appleStarted = await externalIdentityStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      providerId: apple.id,
      providerPorts: ports,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(appleStarted.success).toBe(true)
    if (!appleStarted.success) throw new Error(appleStarted.errorMessage)
    const appleUrl = new URL(appleStarted.data.authorizationUrl)
    expect(`${appleUrl.origin}${appleUrl.pathname}`).toBe("https://appleid.apple.com/auth/authorize")
    expect(appleUrl.searchParams.get("client_id")).toBe("de.contentoren.start.signin")

    const googleStarted = await externalIdentityStart({
      allowDevelopmentFallback: true,
      database,
      input: {},
      providerId: google.data.provider.id,
      providerPorts: ports,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(googleStarted.success).toBe(true)
    if (!googleStarted.success) throw new Error(googleStarted.errorMessage)
    const googleUrl = new URL(googleStarted.data.authorizationUrl)
    expect(`${googleUrl.origin}${googleUrl.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth")
  })
})
