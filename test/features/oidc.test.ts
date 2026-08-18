import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { oidcAuthorizationCodeRedeem } from "../../src/features/oidc/actions/oidcAuthorizationCodeRedeem.js"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcAuthorizationRequestConsent } from "../../src/features/oidc/actions/oidcAuthorizationRequestConsent.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientGet } from "../../src/features/oidc/actions/oidcClientGet.js"
import { oidcClientLifecycleSet } from "../../src/features/oidc/actions/oidcClientLifecycleSet.js"
import { oidcClientList } from "../../src/features/oidc/actions/oidcClientList.js"
import { oidcClientSecretRotate } from "../../src/features/oidc/actions/oidcClientSecretRotate.js"
import { oidcClientUpdate } from "../../src/features/oidc/actions/oidcClientUpdate.js"
import { oidcDiscoveryGet } from "../../src/features/oidc/actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../../src/features/oidc/actions/oidcJwksGet.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyList } from "../../src/features/oidc/actions/oidcSigningKeyList.js"
import { oidcTokenIssue } from "../../src/features/oidc/actions/oidcTokenIssue.js"
import { oidcConsentRevoke } from "../../src/features/oidc/actions/oidcConsentRevoke.js"
import { oidcLogout } from "../../src/features/oidc/actions/oidcLogout.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcClientSecretMatches } from "../../src/features/oidc/domain/oidcClientSecretMatches.js"
import { oidcJwtSign } from "../../src/features/oidc/domain/oidcJwtSign.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
import { oidcPkceVerify } from "../../src/features/oidc/domain/oidcPkceVerify.js"
import { oidcRedirectUriMatches } from "../../src/features/oidc/domain/oidcRedirectUriMatches.js"
import { oidcRedirectUriValidate } from "../../src/features/oidc/domain/oidcRedirectUriValidate.js"
import { oidcValueDecrypt } from "../../src/features/oidc/domain/oidcValueEncrypt.js"
import { oidcDiscoverySchema } from "../../src/features/oidc/public/oidcDiscoverySchema.js"
import { oidcJwksSchema } from "../../src/features/oidc/public/oidcJwksSchema.js"
import { oidcTokenResponseSchema } from "../../src/features/oidc/public/oidcTokenResponseSchema.js"
import { oidcUserInfoSchema } from "../../src/features/oidc/public/oidcUserInfoSchema.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-oidc-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function createAuthenticatedSession(
  database: StorageDatabase,
  domain: string,
): Promise<{ realm: Awaited<ReturnType<typeof createRealm>>; token: string; userId: string }> {
  const realm = await createRealm(database, domain)
  const context = realmTenantContextCreate(realm.id, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${domain.replaceAll(".", "-")}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "OIDC User" },
      userName: domain.replaceAll(".", "-"),
    },
    realmId: realm.id,
    onVerificationToken: (delivery) => {
      verificationToken = delivery.token
    },
  })
  expect(registered.success).toBe(true)
  expect(
    passwordEmailVerify({
      context,
      database,
      input: { token: verificationToken },
      realmId: realm.id,
    }).success,
  ).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: domain.replaceAll(".", "-"), password: "Correct Horse 12" },
    realmId: realm.id,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The OIDC test session could not be created.")
  return { realm, token: login.data.session.token, userId: login.data.authentication.userId }
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

async function oidcTokenRequest(
  app: ReturnType<typeof oidcServerAppCreate>,
  domain: string,
  input: Record<string, string>,
): Promise<Response> {
  return app.fetch(
    new Request(`https://${domain}/oauth2/token`, {
      body: new URLSearchParams(input),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }),
  )
}

async function createOidcTokenFixture(database: StorageDatabase, domain: string, scope = "openid profile email") {
  const authenticated = await createAuthenticatedSession(database, domain)
  const client = oidcClientCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      allowedScopes: ["openid", "profile", "email"],
      clientType: "confidential",
      name: `${domain} client`,
      redirectUris: ["https://client.example/callback"],
      trusted: true,
    },
    realmId: authenticated.realm.id,
  })
  if (!client.success || client.data.clientSecret === undefined) throw new Error("The OIDC fixture client failed.")
  const key = oidcSigningKeyCreate({
    context: realmSystemContextCreate(),
    database,
    encryptionSecret: "oidc-fixture-secret",
    realmId: authenticated.realm.id,
  })
  if (!key.success) throw new Error(key.errorMessage)
  const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
  const authorization = oidcAuthorizationRequestAuthorize({
    database,
    input: {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256",
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope,
      state: "fixture-state",
    },
    realmId: authenticated.realm.id,
    sessionToken: authenticated.token,
  })
  if (!authorization.success) throw new Error(authorization.errorMessage)
  const app = oidcServerAppCreate({ database, systemSecret: "oidc-fixture-secret" })
  const response = await oidcTokenRequest(app, domain, {
    client_id: client.data.client.id,
    client_secret: client.data.clientSecret,
    code: authorization.data.code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: authorization.data.redirect_uri,
  })
  if (!response.ok) throw new Error(`The OIDC fixture token request failed: ${response.status}`)
  return {
    app,
    authenticated,
    client: client.data.client,
    clientSecret: client.data.clientSecret,
    token: v.parse(oidcTokenResponseSchema, await response.json()),
  }
}

test("redirect URI matching is exact and rejects unsafe registrations", () => {
  expect(oidcRedirectUriValidate("https://client.example/callback").success).toBe(true)
  expect(oidcRedirectUriValidate("https://client.example/callback/").success).toBe(true)
  expect(oidcRedirectUriMatches("https://client.example/callback", ["https://client.example/callback"]).success).toBe(
    true,
  )
  expect(oidcRedirectUriMatches("https://client.example/callback/", ["https://client.example/callback"]).success).toBe(
    false,
  )
  expect(oidcRedirectUriValidate("http://client.example/callback").success).toBe(false)
  expect(oidcRedirectUriValidate("https://client.example/callback#fragment").success).toBe(false)
  expect(oidcRedirectUriValidate("https://user:password@client.example/callback").success).toBe(false)
})

test("PKCE accepts only a valid S256 verifier and challenge pair", () => {
  const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
  const challenge = pkceChallengeCreate(verifier)

  expect(oidcPkceVerify(verifier, challenge, "S256")).toEqual({ data: true, success: true })
  expect(oidcPkceVerify(verifier, pkceChallengeCreate(`${verifier}x`), "S256").success).toBe(false)
  expect(oidcPkceVerify(verifier, challenge, "plain").success).toBe(false)
  expect(oidcPkceVerify(verifier.slice(0, 42), challenge, "S256").success).toBe(false)
  expect(oidcPkceVerify(`${verifier}x`.repeat(3), challenge, "S256").success).toBe(false)
  expect(oidcPkceVerify(verifier, challenge.slice(0, 42), "S256").success).toBe(false)
  expect(oidcPkceVerify(verifier, `${challenge}x`, "S256").success).toBe(false)
})

test("OIDC clients are tenant-isolated, return secrets once, and write safe events", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "oidc-alpha.example.com")
    const beta = await createRealm(database, "oidc-beta.example.com")
    const created = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile"],
        clientType: "confidential",
        name: "Alpha client",
        redirectUris: ["https://client.example/callback"],
      },
      realmId: alpha.id,
    })
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.success).toBe(true)
    if (!created.success || created.data.clientSecret === undefined) return
    expect(created.data.clientSecret).toHaveLength(43)
    expect(oidcClientSecretMatches(created.data.clientSecret, "wrong-hash")).toBe(false)
    const row = database.db
      .select()
      .from((await import("../../src/features/oidc/persistence/oidcClientTable.js")).oidcClientTable)
      .get()
    expect(row?.secretHash).not.toBe(created.data.clientSecret)
    const client = oidcClientGet({
      clientId: created.data.client.id,
      context: realmSystemContextCreate(),
      database,
      realmId: alpha.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    expect(client.data.client).not.toHaveProperty("clientSecret")
    const alphaContext = realmTenantContextCreate(alpha.id, "alpha-admin")
    const crossTenantClient = oidcClientGet({
      clientId: created.data.client.id,
      context: alphaContext,
      database,
      realmId: beta.id,
    })
    expect(crossTenantClient.success).toBe(false)
    const betaClients = oidcClientList({
      context: realmTenantContextCreate(beta.id, "beta-admin"),
      database,
      realmId: beta.id,
    })
    expect(betaClients.success).toBe(true)
    if (!betaClients.success) return
    expect(betaClients.data.items).toEqual([])
    const events = database.db.select().from(storageEventTable).all()
    expect(JSON.stringify(events)).not.toContain(created.data.clientSecret)
    expect(JSON.stringify(events)).not.toContain("secretHash")
  })
})

test("client updates keep exact redirects and secret rotation invalidates old credentials", async () => {
  await withDatabase(async (database) => {
    const fixture = await createOidcTokenFixture(database, "client-management.example.com")
    const updated = oidcClientUpdate({
      clientId: fixture.client.id,
      context: realmSystemContextCreate(),
      database,
      input: {
        name: "Updated client",
        redirectUris: ["https://client.example/callback?channel=two"],
      },
      realmId: fixture.authenticated.realm.id,
    })
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.client.redirectUris).toEqual(["https://client.example/callback?channel=two"])
    expect(
      oidcRedirectUriMatches("https://client.example/callback?channel=one", updated.data.client.redirectUris).success,
    ).toBe(false)

    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: {
          client_id: fixture.client.id,
          code_challenge: pkceChallengeCreate(verifier),
          code_challenge_method: "S256",
          redirect_uri: "https://client.example/callback?channel=one",
          response_type: "code",
          scope: "openid",
          state: "old-redirect",
        },
        realmId: fixture.authenticated.realm.id,
        sessionToken: fixture.authenticated.token,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: {
          client_id: fixture.client.id,
          code_challenge: pkceChallengeCreate(verifier),
          code_challenge_method: "S256",
          redirect_uri: "https://client.example/callback?channel=two",
          response_type: "code",
          scope: "openid",
          state: "new-redirect",
        },
        realmId: fixture.authenticated.realm.id,
        sessionToken: fixture.authenticated.token,
      }).success,
    ).toBe(true)

    const rotated = oidcClientSecretRotate({
      clientId: fixture.client.id,
      context: realmSystemContextCreate(),
      database,
      realmId: fixture.authenticated.realm.id,
    })
    expect(rotated.success).toBe(true)
    if (!rotated.success || rotated.data.clientSecret === undefined) return
    expect(rotated.data.clientSecret).not.toBe(fixture.clientSecret)

    const oldSecret = await oidcTokenRequest(fixture.app, "client-management.example.com", {
      client_id: fixture.client.id,
      client_secret: fixture.clientSecret,
      grant_type: "refresh_token",
      refresh_token: fixture.token.refresh_token,
    })
    expect(oldSecret.status).toBe(401)
    expect(await oldSecret.json()).toMatchObject({ error: "invalid_client" })
    const newSecret = await oidcTokenRequest(fixture.app, "client-management.example.com", {
      client_id: fixture.client.id,
      client_secret: rotated.data.clientSecret,
      grant_type: "refresh_token",
      refresh_token: fixture.token.refresh_token,
    })
    expect(newSecret.status).toBe(200)
    const events = JSON.stringify(database.sqlite.query("SELECT payload, metadata FROM events").all())
    expect(events).not.toContain(fixture.clientSecret)
    expect(events).not.toContain(rotated.data.clientSecret)
  })
})

test("signing keys rotate without exposing private material and serve discovery and JWKS", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "keys.example.com")
    const first = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "test-encryption-secret",
      realmId: realm.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    const second = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "test-encryption-secret",
      realmId: realm.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const keys = oidcSigningKeyList({ context: realmSystemContextCreate(), database, realmId: realm.id })
    expect(keys.success).toBe(true)
    if (!keys.success) return
    expect(keys.data?.items).toHaveLength(2)
    expect(keys.data?.items[0]?.status).toBe("active")
    expect(keys.data?.items[1]?.status).toBe("retired")
    expect(keys.data?.items[0]).not.toHaveProperty("encryptedPrivateKey")
    const jwks = oidcJwksGet({ database, realmId: realm.id })
    expect(jwks.success).toBe(true)
    if (!jwks.success) return
    expect(jwks.data?.keys).toHaveLength(2)
    const discovery = oidcDiscoveryGet({ database, realmId: realm.id })
    expect(discovery.success).toBe(true)
    if (!discovery.success) return
    expect(discovery.data?.issuer).toBe("https://keys.example.com")
    expect(discovery.data?.jwks_uri).toBe("https://keys.example.com/.well-known/jwks.json")
    const encrypted = database.sqlite
      .query(
        "SELECT encrypted_private_key AS encryptedPrivateKey, public_jwk AS publicJwk FROM oidc_signing_keys WHERE id = ?",
      )
      .get(first.data.signingKey.id) as { encryptedPrivateKey: string; publicJwk: string } | null
    expect(encrypted?.encryptedPrivateKey).toBeString()
    expect(encrypted?.publicJwk).not.toContain("private")
    const privateKey = oidcValueDecrypt(encrypted?.encryptedPrivateKey ?? "", realm.id, "test-encryption-secret")
    expect(privateKey.success).toBe(true)
    if (!privateKey.success) return
    const token = oidcJwtSign(
      { alg: "RS256", kid: first.data.signingKey.id, typ: "JWT" },
      { sub: "user" },
      privateKey.data,
    )
    expect(token.success).toBe(true)
    const eventRows = database.db.select().from(storageEventTable).all()
    expect(JSON.stringify(eventRows)).not.toContain(privateKey.data)
  })
})

test("OIDC management routes use system auth while discovery and JWKS are public tenant routes", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "routes.example.com")
    const bootstrap = realmBootstrapAdminCreate({
      context: realmSystemContextCreate(),
      database,
      realmId: realm.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "system-secret" })
    const unauthorized = await app.fetch(new Request(`https://server/system/realms/${realm.id}/oidc/clients`))
    expect(unauthorized.status).toBe(401)
    const client = oidcApiClientCreate({
      baseUrl: "https://server",
      token: "system-secret",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const created = await client.oidcClientCreate(realm.id, {
      clientType: "public",
      name: "Route client",
      redirectUris: ["https://client.example/callback"],
      trusted: true,
    })
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.success).toBe(true)
    const discovery = await app.fetch(new Request("https://routes.example.com/.well-known/openid-configuration"))
    const jwks = await app.fetch(new Request("https://routes.example.com/.well-known/jwks.json"))
    expect(discovery.status).toBe(200)
    expect(jwks.status).toBe(200)
    const discoveryBody = v.parse(oidcDiscoverySchema, await discovery.json())
    const jwksBody = v.parse(oidcJwksSchema, await jwks.json())
    expect(discoveryBody.issuer).toBe("https://routes.example.com")
    expect(jwksBody.keys).toEqual([])
    expect(discoveryBody.grant_types_supported).toEqual(["authorization_code", "refresh_token"])
    expect(discoveryBody.token_endpoint).toBe("https://routes.example.com/oauth2/token")
    const tenant = await app.fetch(
      new Request(`https://routes.example.com/realms/${realm.id}/oidc/clients`, {
        headers: { authorization: `Bearer ${bootstrap.data.bootstrapAdmin.secret.valueGet()}` },
      }),
    )
    expect(tenant.status).toBe(200)
  })
})

test("authenticated authorization issues a bound short-lived code and preserves state and nonce", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "authorize.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile"],
        clientType: "public",
        name: "Authorization client",
        redirectUris: ["https://client.example/callback?channel=one"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "oidc-test-secret",
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        nonce: "nonce-value",
        redirect_uri: "https://client.example/callback?channel=one",
        response_type: "code",
        scope: "openid profile",
        state: "state-value",
      },
      realmId: authenticated.realm.id,
      runtime: database.runtime,
      sessionToken: authenticated.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    expect(authorization.data.state).toBe("state-value")
    expect(authorization.data.expires_at).toBe(database.runtime.now() + 60_000)
    const stored = database.sqlite
      .query(
        "SELECT r.state_encrypted, r.nonce_encrypted, c.token_hash FROM oidc_authorization_requests r JOIN oidc_authorization_codes c ON c.realm_id = r.realm_id",
      )
      .get() as { state_encrypted: string; nonce_encrypted: string; token_hash: string } | null
    expect(stored?.state_encrypted).not.toBe("state-value")
    expect(stored?.nonce_encrypted).not.toBe("nonce-value")
    expect(stored?.token_hash).not.toBe(authorization.data.code)
    const events = JSON.stringify(database.sqlite.query("SELECT payload, metadata FROM events").all())
    expect(events).not.toContain(authorization.data.code)
    expect(events).not.toContain("state-value")
    expect(events).not.toContain("nonce-value")
    expect(events).not.toContain(verifier)

    const redeemed = oidcAuthorizationCodeRedeem({
      database,
      encryptionSecret: "oidc-test-secret",
      input: {
        client_id: client.data.client.id,
        code: authorization.data.code,
        code_verifier: verifier,
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId: authenticated.realm.id,
      runtime: database.runtime,
    })
    expect(redeemed).toMatchObject({
      data: {
        client_id: client.data.client.id,
        nonce: "nonce-value",
        redirect_uri: authorization.data.redirect_uri,
        scope: ["openid", "profile"],
        user_id: authenticated.userId,
      },
      success: true,
    })
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        encryptionSecret: "oidc-test-secret",
        input: {
          client_id: client.data.client.id,
          code: authorization.data.code,
          code_verifier: verifier,
          redirect_uri: authorization.data.redirect_uri,
        },
        realmId: authenticated.realm.id,
        runtime: database.runtime,
      }).success,
    ).toBe(false)
  })
})

test("authorization rejects invalid redirects, scopes, PKCE, code bindings, expiry, and tenant mismatches", async () => {
  await withDatabase(async (database, testkit) => {
    const authenticated = await createAuthenticatedSession(database, "authorize-negative.example.com")
    const other = await createAuthenticatedSession(database, "authorize-other.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Negative authorization client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const otherClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Other authorization client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(otherClient.success).toBe(true)
    if (!otherClient.success) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const input = {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256" as const,
      redirect_uri: "https://client.example/callback",
      response_type: "code" as const,
      scope: "openid",
      state: "required-state",
    }
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: { ...input, redirect_uri: "https://client.example/other" },
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: { ...input, state: "" },
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: { ...input, scope: "openid openid" },
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: { ...input, scope: "openid profile" },
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(false)
    const issued = oidcAuthorizationRequestAuthorize({
      database,
      input,
      realmId: authenticated.realm.id,
      runtime: database.runtime,
      sessionToken: authenticated.token,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        input: {
          client_id: otherClient.data.client.id,
          code: issued.data.code,
          code_verifier: verifier,
          redirect_uri: issued.data.redirect_uri,
        },
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        input: {
          client_id: client.data.client.id,
          code: issued.data.code,
          code_verifier: verifier,
          redirect_uri: "https://client.example/other",
        },
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        input: {
          client_id: client.data.client.id,
          code: issued.data.code,
          code_verifier: "wrong-verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
          redirect_uri: issued.data.redirect_uri,
        },
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        input: {
          client_id: client.data.client.id,
          code: issued.data.code,
          code_verifier: verifier,
          redirect_uri: issued.data.redirect_uri,
        },
        realmId: other.realm.id,
      }).success,
    ).toBe(false)
    testkit.advance(60_000)
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        input: {
          client_id: client.data.client.id,
          code: issued.data.code,
          code_verifier: verifier,
          redirect_uri: issued.data.redirect_uri,
        },
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(false)
  })
})

test("inactive clients cannot authorize or refresh existing grants", async () => {
  await withDatabase(async (database) => {
    const fixture = await createOidcTokenFixture(database, "inactive-client.example.com")
    const inactive = oidcClientLifecycleSet({
      clientId: fixture.client.id,
      context: realmSystemContextCreate(),
      database,
      input: { status: "inactive" },
      realmId: fixture.authenticated.realm.id,
    })
    expect(inactive.success).toBe(true)
    if (!inactive.success) return
    expect(inactive.data.client.status).toBe("inactive")

    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: fixture.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid",
        state: "inactive-state",
      },
      realmId: fixture.authenticated.realm.id,
      sessionToken: fixture.authenticated.token,
    })
    expect(authorization.success).toBe(false)

    const refreshed = await oidcTokenRequest(fixture.app, "inactive-client.example.com", {
      client_id: fixture.client.id,
      client_secret: fixture.clientSecret,
      grant_type: "refresh_token",
      refresh_token: fixture.token.refresh_token,
    })
    expect(refreshed.status).toBe(401)
    expect(await refreshed.json()).toMatchObject({ error: "invalid_client" })
  })
})

test("authorization and code consumption roll back with their audit events", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "authorize-atomic.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Atomic authorization client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const input = {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256" as const,
      redirect_uri: "https://client.example/callback",
      response_type: "code" as const,
      scope: "openid",
      state: "atomic-state",
    }
    database.sqlite.run(
      "CREATE TRIGGER reject_oidc_issue_events BEFORE INSERT ON events WHEN NEW.event_type = 'oidc.authorization_code_issued' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input,
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_authorization_requests").get()).toEqual({
      count: 0,
    })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_authorization_codes").get()).toEqual({ count: 0 })
    database.sqlite.run("DROP TRIGGER reject_oidc_issue_events")

    const issued = oidcAuthorizationRequestAuthorize({
      database,
      input,
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    database.sqlite.run(
      "CREATE TRIGGER reject_oidc_consume_events BEFORE INSERT ON events WHEN NEW.event_type = 'oidc.authorization_code_consumed' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        input: {
          client_id: client.data.client.id,
          code: issued.data.code,
          code_verifier: verifier,
          redirect_uri: issued.data.redirect_uri,
        },
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT used_at FROM oidc_authorization_codes").get()).toEqual({ used_at: null })
  })
})

test("authorization routes use the authenticated session and the API client contracts", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "authorize-route.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Authorization route client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "oidc-route-secret" })
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const request = {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256" as const,
      redirect_uri: "https://client.example/callback",
      response_type: "code" as const,
      scope: "openid",
      state: "route-state",
    }
    const query = new URLSearchParams(request)
    const redirected = await app.fetch(
      new Request(`https://authorize-route.example.com/oauth2/authorize?${query}`, {
        headers: { authorization: `Bearer ${authenticated.token}` },
      }),
    )
    expect(redirected.status).toBe(302)
    const location = redirected.headers.get("location")
    expect(location).toBeString()
    if (location === null) return
    expect(new URL(location).searchParams.get("state")).toBe("route-state")

    const apiClient = oidcApiClientCreate({
      baseUrl: "https://authorize-route.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: authenticated.token,
    })
    const started = await apiClient.oidcAuthorizationRequestAuthorize(request)
    expect(started.success).toBe(true)
    if (!started.success) return
    const tokenClient = oidcApiClientCreate({
      baseUrl: "https://authorize-route.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const redeemed = await tokenClient.oidcAuthorizationCodeRedeem({
      client_id: client.data.client.id,
      code: started.data.code,
      code_verifier: verifier,
      redirect_uri: started.data.redirect_uri,
    })
    expect(redeemed).toMatchObject({ success: true, data: { client_id: client.data.client.id, nonce: null } })
  })
})

test("authorization redirects preserve registered query parameters and never redirect invalid requests", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "redirect-route.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Redirect route client",
        redirectUris: ["https://client.example/callback?channel=one"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "redirect-route-secret" })
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const valid = {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256",
      redirect_uri: "https://client.example/callback?channel=one",
      response_type: "code",
      scope: "openid",
      state: "redirect-state",
    }
    const redirected = await app.fetch(
      new Request(`https://redirect-route.example.com/oauth2/authorize?${new URLSearchParams(valid)}`, {
        headers: { authorization: `Bearer ${authenticated.token}` },
      }),
    )
    expect(redirected.status).toBe(302)
    const location = redirected.headers.get("location")
    expect(location).toStartWith("https://client.example/callback?channel=one&")
    if (location === null) return
    expect(new URL(location).searchParams.get("code")).toBeString()
    expect(new URL(location).searchParams.get("state")).toBe("redirect-state")

    const invalidRedirect = await app.fetch(
      new Request(
        `https://redirect-route.example.com/oauth2/authorize?${new URLSearchParams({
          ...valid,
          redirect_uri: "https://client.example/callback?channel=two",
        })}`,
        { headers: { authorization: `Bearer ${authenticated.token}` } },
      ),
    )
    expect(invalidRedirect.status).toBeGreaterThanOrEqual(400)
    expect(invalidRedirect.status).toBeLessThan(600)
    expect(invalidRedirect.headers.get("location")).toBeNull()

    const unknownClient = await app.fetch(
      new Request(
        `https://redirect-route.example.com/oauth2/authorize?${new URLSearchParams({
          ...valid,
          client_id: "018f0b7b-5c6e-7b7d-8e8f-901234567890",
          redirect_uri: "https://attacker.example/callback",
        })}`,
        { headers: { authorization: `Bearer ${authenticated.token}` } },
      ),
    )
    expect(unknownClient.status).toBeGreaterThanOrEqual(400)
    expect(unknownClient.status).toBeLessThan(600)
    expect(unknownClient.headers.get("location")).toBeNull()
  })
})

test("the standards token endpoint exchanges codes, signs scoped tokens, and rotates refresh tokens", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "token.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile", "email"],
        clientType: "confidential",
        name: "Token client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success || client.data.clientSecret === undefined) return
    const key = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "token-secret",
      realmId: authenticated.realm.id,
    })
    expect(key.success).toBe(true)
    if (!key.success) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "token-secret",
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        nonce: "token-nonce",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile email",
        state: "token-state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "token-secret" })
    const wrongVerifier = await oidcTokenRequest(app, "token.example.com", {
      client_id: client.data.client.id,
      client_secret: client.data.clientSecret,
      code: authorization.data.code,
      code_verifier: "wrong-verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
      grant_type: "authorization_code",
      redirect_uri: authorization.data.redirect_uri,
    })
    expect(wrongVerifier.status).toBe(400)
    expect(await wrongVerifier.json()).toMatchObject({ error: "invalid_grant" })
    const response = await oidcTokenRequest(app, "token.example.com", {
      client_id: client.data.client.id,
      client_secret: client.data.clientSecret,
      code: authorization.data.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: authorization.data.redirect_uri,
    })
    expect(response.status).toBe(200)
    const token = v.parse(oidcTokenResponseSchema, await response.json())
    expect(token.scope).toBe("openid profile email")
    expect(token.token_type).toBe("Bearer")
    const idClaims = oidcJwtVerify(token.id_token, key.data.signingKey.publicJwk)
    const accessClaims = oidcJwtVerify(token.access_token, key.data.signingKey.publicJwk)
    expect(idClaims).toMatchObject({
      data: {
        amr: ["password"],
        aud: client.data.client.id,
        auth_time: 1_700_000_000,
        email: "token-example-com@example.com",
        email_verified: true,
        iss: "https://token.example.com",
        nonce: "token-nonce",
        sub: authenticated.userId,
      },
      success: true,
    })
    expect(accessClaims).toMatchObject({
      data: {
        aud: client.data.client.id,
        client_id: client.data.client.id,
        scope: "openid profile email",
        sub: authenticated.userId,
      },
      success: true,
    })
    const rotatedResponse = await oidcTokenRequest(app, "token.example.com", {
      client_id: client.data.client.id,
      client_secret: client.data.clientSecret,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    })
    expect(rotatedResponse.status).toBe(200)
    const rotated = v.parse(oidcTokenResponseSchema, await rotatedResponse.json())
    expect(rotated.refresh_token).not.toBe(token.refresh_token)
    const expandedScope = await oidcTokenRequest(app, "token.example.com", {
      client_id: client.data.client.id,
      client_secret: client.data.clientSecret,
      grant_type: "refresh_token",
      refresh_token: rotated.refresh_token,
      scope: "openid profile email custom",
    })
    expect(expandedScope.status).toBe(400)
    expect(await expandedScope.json()).toMatchObject({ error: "invalid_scope" })
    const replay = await oidcTokenRequest(app, "token.example.com", {
      client_id: client.data.client.id,
      client_secret: client.data.clientSecret,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    })
    expect(replay.status).toBe(400)
    expect(await replay.json()).toMatchObject({ error: "invalid_grant" })
    const familyReplay = await oidcTokenRequest(app, "token.example.com", {
      client_id: client.data.client.id,
      client_secret: client.data.clientSecret,
      grant_type: "refresh_token",
      refresh_token: rotated.refresh_token,
    })
    expect(familyReplay.status).toBe(400)
    expect(await familyReplay.json()).toMatchObject({ error: "invalid_grant" })
    expect(
      database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_refresh_tokens WHERE revoked_at IS NOT NULL").get(),
    ).toEqual({
      count: 2,
    })
  })
})

test("the token endpoint supports public clients and confidential basic authentication while isolating grants", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "token-auth.example.com")
    const publicClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Public token client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(publicClient.success).toBe(true)
    if (!publicClient.success) return
    const key = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "token-auth-secret",
      realmId: authenticated.realm.id,
    })
    expect(key.success).toBe(true)
    if (!key.success) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "token-auth-secret",
      input: {
        client_id: publicClient.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid",
        state: "state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "token-auth-secret" })
    const publicResponse = await oidcTokenRequest(app, "token-auth.example.com", {
      client_id: publicClient.data.client.id,
      code: authorization.data.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: authorization.data.redirect_uri,
    })
    expect(publicResponse.status).toBe(200)

    const apiAuthorization = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: publicClient.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid",
        state: "api-state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(apiAuthorization.success).toBe(true)
    if (!apiAuthorization.success) return
    const apiClient = oidcApiClientCreate({
      baseUrl: "https://token-auth.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const apiToken = await apiClient.oidcTokenIssue({
      client_id: publicClient.data.client.id,
      code: apiAuthorization.data.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: apiAuthorization.data.redirect_uri,
    })
    expect(apiToken.success).toBe(true)

    const confidential = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "confidential",
        name: "Basic token client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(confidential.success).toBe(true)
    if (!confidential.success || confidential.data.clientSecret === undefined) return
    const basicAuthorization = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: confidential.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid",
        state: "state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(basicAuthorization.success).toBe(true)
    if (!basicAuthorization.success) return
    const basic = Buffer.from(`${confidential.data.client.id}:${confidential.data.clientSecret}`).toString("base64")
    const basicResponse = await app.fetch(
      new Request("https://token-auth.example.com/oauth2/token", {
        body: new URLSearchParams({
          code: basicAuthorization.data.code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: basicAuthorization.data.redirect_uri,
        }),
        headers: {
          authorization: `Basic ${basic}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    )
    expect(basicResponse.status).toBe(200)
    const foreign = await oidcTokenIssue({
      database,
      input: {
        client_id: publicClient.data.client.id,
        code: authorization.data.code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId: "018f0b7b-5c6e-7b7d-8e8f-901234567890",
    })
    expect(foreign.success).toBe(false)
  })
})

test("token exchange is atomic with code consumption and token audit events", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "token-atomic.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Atomic token client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    expect(
      oidcSigningKeyCreate({
        context: realmSystemContextCreate(),
        database,
        encryptionSecret: "atomic-token-secret",
        realmId: authenticated.realm.id,
      }).success,
    ).toBe(true)
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid",
        state: "state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    database.sqlite.run(
      "CREATE TRIGGER reject_oidc_token_events BEFORE INSERT ON events WHEN NEW.event_type = 'oidc.access_token_issued' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const failed = oidcTokenIssue({
      database,
      encryptionSecret: "atomic-token-secret",
      input: {
        client_id: client.data.client.id,
        code: authorization.data.code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId: authenticated.realm.id,
    })
    expect(failed.success).toBe(false)
    expect(database.sqlite.query("SELECT used_at FROM oidc_authorization_codes").get()).toEqual({ used_at: null })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_access_tokens").get()).toEqual({ count: 0 })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_refresh_tokens").get()).toEqual({ count: 0 })
  })
})

test("UserInfo validates bearer tokens, isolates tenants, and filters claims by scope", async () => {
  await withDatabase(async (database) => {
    const fixture = await createOidcTokenFixture(database, "userinfo.example.com")
    const getResponse = await fixture.app.fetch(
      new Request("https://userinfo.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${fixture.token.access_token}` },
      }),
    )
    expect(getResponse.status).toBe(200)
    expect(v.parse(oidcUserInfoSchema, await getResponse.json())).toEqual({
      email: "userinfo-example-com@example.com",
      email_verified: true,
      name: "OIDC User",
      preferred_username: "userinfo-example-com",
      sub: fixture.authenticated.userId,
    })
    const postResponse = await fixture.app.fetch(
      new Request("https://userinfo.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${fixture.token.access_token}` },
        method: "POST",
      }),
    )
    expect(postResponse.status).toBe(200)
    expect(await postResponse.json()).toEqual({
      email: "userinfo-example-com@example.com",
      email_verified: true,
      name: "OIDC User",
      preferred_username: "userinfo-example-com",
      sub: fixture.authenticated.userId,
    })
    const missingBearer = await fixture.app.fetch(new Request("https://userinfo.example.com/oauth2/userinfo"))
    expect(missingBearer.status).toBe(401)
    expect(missingBearer.headers.get("www-authenticate")).toContain('error="invalid_token"')

    const openidOnly = await createOidcTokenFixture(database, "userinfo-openid.example.com", "openid")
    const openidResponse = await openidOnly.app.fetch(
      new Request("https://userinfo-openid.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${openidOnly.token.access_token}` },
      }),
    )
    expect(openidResponse.status).toBe(200)
    expect(await openidResponse.json()).toEqual({ sub: openidOnly.authenticated.userId })
    const openidJwks = await openidOnly.app.fetch(
      new Request("https://userinfo-openid.example.com/.well-known/jwks.json"),
    )
    expect(openidJwks.status).toBe(200)
    const openidKeys = v.parse(oidcJwksSchema, await openidJwks.json())
    expect(openidKeys.keys.length).toBeGreaterThan(0)
    const openidKey = openidKeys.keys[0]
    if (openidKey === undefined) return
    const openidIdToken = oidcJwtVerify(openidOnly.token.id_token, openidKey)
    expect(openidIdToken.success).toBe(true)
    if (!openidIdToken.success) return
    expect(openidIdToken.data).not.toHaveProperty("email")
    expect(openidIdToken.data).not.toHaveProperty("preferred_username")
    expect(openidIdToken.data).not.toHaveProperty("name")

    await createRealm(database, "userinfo-beta.example.com")
    const foreign = await fixture.app.fetch(
      new Request("https://userinfo-beta.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${fixture.token.access_token}` },
      }),
    )
    expect(foreign.status).toBe(401)

    database.sqlite
      .query("UPDATE sessions SET revoked_at = ? WHERE user_id = ?")
      .run(database.runtime.now(), fixture.authenticated.userId)
    const revokedSession = await fixture.app.fetch(
      new Request("https://userinfo.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${fixture.token.access_token}` },
      }),
    )
    expect(revokedSession.status).toBe(401)
  })
})

test("OIDC revocation authenticates clients, is idempotent, isolates tenants, and audits atomically", async () => {
  await withDatabase(async (database) => {
    const fixture = await createOidcTokenFixture(database, "revoke.example.com")
    const basic = Buffer.from(`${fixture.client.id}:${fixture.clientSecret}`).toString("base64")
    const revoke = (input: Record<string, string>, authorization = `Basic ${basic}`) =>
      fixture.app.fetch(
        new Request("https://revoke.example.com/oauth2/revoke", {
          body: new URLSearchParams(input),
          headers: {
            authorization,
            "content-type": "application/x-www-form-urlencoded",
          },
          method: "POST",
        }),
      )

    const invalidClient = await revoke({ token: fixture.token.access_token }, "Basic invalid")
    expect(invalidClient.status).toBe(401)
    expect(invalidClient.headers.get("www-authenticate")).toContain("oauth2/revoke")

    const beta = await createRealm(database, "revoke-beta.example.com")
    const betaClient = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: { clientType: "confidential", name: "Beta client", redirectUris: ["https://client.example/callback"] },
      realmId: beta.id,
    })
    expect(betaClient.success).toBe(true)
    if (!betaClient.success || betaClient.data.clientSecret === undefined) return
    const betaBasic = Buffer.from(`${betaClient.data.client.id}:${betaClient.data.clientSecret}`).toString("base64")
    const foreign = await fixture.app.fetch(
      new Request("https://revoke-beta.example.com/oauth2/revoke", {
        body: new URLSearchParams({ token: fixture.token.access_token }),
        headers: {
          authorization: `Basic ${betaBasic}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    )
    expect(foreign.status).toBe(200)
    const beforeRevoke = await fixture.app.fetch(
      new Request("https://revoke.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${fixture.token.access_token}` },
      }),
    )
    expect(beforeRevoke.status).toBe(200)

    const accessRevoked = await revoke({ token: fixture.token.access_token, token_type_hint: "access_token" })
    expect(accessRevoked.status).toBe(200)
    expect(await accessRevoked.text()).toBe("")
    const accessEventCount = database.sqlite
      .query("SELECT COUNT(*) AS count FROM events WHERE event_type = 'oidc.access_token_revoked'")
      .get() as { count: number }
    expect(accessEventCount.count).toBe(1)
    const repeatedAccessRevoke = await revoke({ token: fixture.token.access_token })
    expect(repeatedAccessRevoke.status).toBe(200)
    expect(
      (
        database.sqlite
          .query("SELECT COUNT(*) AS count FROM events WHERE event_type = 'oidc.access_token_revoked'")
          .get() as { count: number }
      ).count,
    ).toBe(1)
    const afterRevoke = await fixture.app.fetch(
      new Request("https://revoke.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${fixture.token.access_token}` },
      }),
    )
    expect(afterRevoke.status).toBe(401)

    const refreshRevoked = await revoke({ token: fixture.token.refresh_token, token_type_hint: "refresh_token" })
    expect(refreshRevoked.status).toBe(200)
    expect(
      (
        database.sqlite
          .query("SELECT COUNT(*) AS count FROM events WHERE event_type = 'oidc.refresh_token_family_revoked'")
          .get() as { count: number }
      ).count,
    ).toBe(1)
    expect(
      database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_refresh_tokens WHERE revoked_at IS NOT NULL").get(),
    ).toEqual({ count: 1 })
    const unknown = await revoke({ token: "unknown-token-value" })
    expect(unknown.status).toBe(200)
    const audit = JSON.stringify(database.sqlite.query("SELECT payload FROM events").all())
    expect(audit).not.toContain(fixture.token.access_token)
    expect(audit).not.toContain(fixture.token.refresh_token)

    const atomic = await createOidcTokenFixture(database, "revoke-atomic.example.com")
    const atomicBasic = Buffer.from(`${atomic.client.id}:${atomic.clientSecret}`).toString("base64")
    database.sqlite.run(
      "CREATE TRIGGER reject_oidc_revocation_events BEFORE INSERT ON events WHEN NEW.event_type = 'oidc.refresh_token_family_revoked' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const failed = await atomic.app.fetch(
      new Request("https://revoke-atomic.example.com/oauth2/revoke", {
        body: new URLSearchParams({ token: atomic.token.refresh_token }),
        headers: {
          authorization: `Basic ${atomicBasic}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }),
    )
    expect(failed.status).toBe(500)
    expect(
      database.sqlite
        .query("SELECT revoked_at FROM oidc_refresh_tokens WHERE realm_id = ?")
        .get(atomic.authenticated.realm.id),
    ).toEqual({ revoked_at: null })
    database.sqlite.run("DROP TRIGGER reject_oidc_revocation_events")
  })
})

test("authorization requires consent, reuses grants, supports incremental scopes, and revokes them atomically", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "consent.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile", "email"],
        clientType: "public",
        name: "Consent client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const pending = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile",
        state: "consent-state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(pending.success).toBe(false)
    if (pending.success) return
    expect(pending.op).toBe("oidcAuthorizationConsentRequired")
    const required = JSON.parse(pending.errorData ?? "{}") as { request_id?: string }
    expect(required.request_id).toBeString()
    expect(database.sqlite.query("SELECT approved_at FROM oidc_authorization_requests").get()).toEqual({
      approved_at: null,
    })

    database.sqlite.run(
      "CREATE TRIGGER reject_oidc_consent_events BEFORE INSERT ON events WHEN NEW.event_type = 'oidc.consent_granted' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const rejectedApproval = oidcAuthorizationRequestConsent({
      database,
      input: { decision: "approve", request_id: required.request_id ?? "" },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(rejectedApproval.success).toBe(false)
    expect(database.sqlite.query("SELECT approved_at FROM oidc_authorization_requests").get()).toEqual({
      approved_at: null,
    })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_consents").get()).toEqual({ count: 0 })
    database.sqlite.run("DROP TRIGGER reject_oidc_consent_events")

    const approved = oidcAuthorizationRequestConsent({
      database,
      input: { decision: "approve", request_id: required.request_id ?? "" },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(approved).toMatchObject({ success: true, data: { approved: true, state: "consent-state" } })
    expect(database.sqlite.query("SELECT scope FROM oidc_consents").get()).toEqual({
      scope: JSON.stringify(["openid", "profile"]),
    })

    const reused = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile",
        state: "reused-state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(reused.success).toBe(true)

    const incremental = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile email",
        state: "incremental-state",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(incremental.success).toBe(false)
    if (incremental.success) return
    expect(incremental.op).toBe("oidcAuthorizationConsentRequired")
    const incrementalRequired = JSON.parse(incremental.errorData ?? "{}") as { request_id?: string }
    const incrementalApproval = oidcAuthorizationRequestConsent({
      database,
      input: { decision: "approve", request_id: incrementalRequired.request_id ?? "" },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(incrementalApproval.success).toBe(true)
    expect(database.sqlite.query("SELECT scope FROM oidc_consents").get()).toEqual({
      scope: JSON.stringify(["openid", "profile", "email"]),
    })

    const revoked = oidcConsentRevoke({
      database,
      clientId: client.data.client.id,
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(revoked).toEqual({ data: { revoked: true }, success: true })
    const afterRevoke = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: client.data.client.id,
        code_challenge: pkceChallengeCreate(verifier),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile",
        state: "after-revoke",
      },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(afterRevoke.success).toBe(false)
    if (afterRevoke.success) return
    expect(afterRevoke.op).toBe("oidcAuthorizationConsentRequired")
    const safeEvents = JSON.stringify(database.sqlite.query("SELECT payload, metadata FROM events").all())
    expect(safeEvents).not.toContain("consent-state")
    expect(safeEvents).not.toContain("incremental-state")
  })
})

test("RP-initiated logout validates exact redirects, revokes the session and OIDC artifacts, and preserves state", async () => {
  await withDatabase(async (database) => {
    const fixture = await createOidcTokenFixture(database, "logout.example.com")
    database.sqlite
      .query("UPDATE oidc_clients SET post_logout_redirect_uris = ? WHERE id = ?")
      .run(JSON.stringify(["https://client.example/logout"]), fixture.client.id)
    const invalidRedirect = oidcLogout({
      database,
      encryptionSecret: "oidc-fixture-secret",
      input: {
        id_token_hint: fixture.token.id_token,
        post_logout_redirect_uri: "https://client.example/other",
      },
      realmId: fixture.authenticated.realm.id,
    })
    expect(invalidRedirect.success).toBe(false)
    expect(database.sqlite.query("SELECT revoked_at FROM sessions").get()).toEqual({ revoked_at: null })

    database.sqlite.run(
      "CREATE TRIGGER reject_oidc_logout_events BEFORE INSERT ON events WHEN NEW.event_type = 'oidc.logout' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const failedLogout = oidcLogout({
      database,
      encryptionSecret: "oidc-fixture-secret",
      input: { id_token_hint: fixture.token.id_token },
      realmId: fixture.authenticated.realm.id,
    })
    expect(failedLogout.success).toBe(false)
    expect(database.sqlite.query("SELECT revoked_at FROM sessions").get()).toEqual({ revoked_at: null })
    expect(database.sqlite.query("SELECT revoked_at FROM oidc_access_tokens").get()).toEqual({ revoked_at: null })
    database.sqlite.run("DROP TRIGGER reject_oidc_logout_events")

    const response = await fixture.app.fetch(
      new Request(
        `https://logout.example.com/oauth2/logout?id_token_hint=${encodeURIComponent(fixture.token.id_token)}&post_logout_redirect_uri=${encodeURIComponent("https://client.example/logout")}&state=logout-state`,
        { headers: { accept: "application/json" } },
      ),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      post_logout_redirect_uri: "https://client.example/logout",
      revoked: true,
      state: "logout-state",
    })
    expect(database.sqlite.query("SELECT revoked_at, revocation_reason FROM sessions").get()).toMatchObject({
      revocation_reason: "rp_initiated_logout",
    })
    const userInfo = await fixture.app.fetch(
      new Request("https://logout.example.com/oauth2/userinfo", {
        headers: { authorization: `Bearer ${fixture.token.access_token}` },
      }),
    )
    expect(userInfo.status).toBe(401)
    const refresh = await oidcTokenRequest(fixture.app, "logout.example.com", {
      client_id: fixture.client.id,
      client_secret: fixture.clientSecret,
      grant_type: "refresh_token",
      refresh_token: fixture.token.refresh_token,
    })
    expect(refresh.status).toBe(400)
    expect(await refresh.json()).toMatchObject({ error: "invalid_grant" })
    const audit = JSON.stringify(database.sqlite.query("SELECT payload, metadata FROM events").all())
    expect(audit).not.toContain(fixture.token.access_token)
    expect(audit).not.toContain(fixture.token.refresh_token)
    expect(audit).not.toContain("logout-state")
  })
})

test("consent denial is terminal, prompt none requires interaction, and trusted clients bypass consent", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "consent-corner-case.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid"],
        clientType: "public",
        name: "Consent corner-case client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const input = {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256" as const,
      redirect_uri: "https://client.example/callback",
      response_type: "code" as const,
      scope: "openid",
      state: "consent-corner-state",
    }

    const silent = oidcAuthorizationRequestAuthorize({
      database,
      input: { ...input, prompt: "none" },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(silent.success).toBe(false)
    if (silent.success) return
    expect(silent.op).toBe("oidcAuthorizationInteractionRequired")
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_authorization_requests").get()).toEqual({
      count: 0,
    })

    const pending = oidcAuthorizationRequestAuthorize({
      database,
      input,
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(pending.success).toBe(false)
    if (pending.success) return
    const required = JSON.parse(pending.errorData ?? "{}") as { request_id?: string }
    expect(required.request_id).toBeString()
    const denied = oidcAuthorizationRequestConsent({
      database,
      input: { decision: "deny", request_id: required.request_id ?? "" },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(denied).toMatchObject({
      data: {
        approved: false,
        error: "access_denied",
        redirect_uri: "https://client.example/callback",
        state: "consent-corner-state",
      },
      success: true,
    })
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_authorization_codes").get()).toEqual({ count: 0 })

    const trusted = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid"],
        clientType: "public",
        name: "Trusted consent corner-case client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: true,
        trusted: true,
      },
      realmId: authenticated.realm.id,
    })
    expect(trusted.success).toBe(true)
    if (!trusted.success) return
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: { ...input, client_id: trusted.data.client.id, state: "trusted-state" },
        realmId: authenticated.realm.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(true)
  })
})

test("logout without an ID token hint requires and revokes only the authenticated session", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "logout-session.example.com")
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Session logout client",
        redirectUris: ["https://client.example/callback"],
      },
      realmId: authenticated.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const wrongSession = oidcLogout({
      database,
      input: { client_id: client.data.client.id },
      realmId: authenticated.realm.id,
      sessionToken: "not-the-session-token",
    })
    expect(wrongSession.success).toBe(false)
    expect(database.sqlite.query("SELECT revoked_at FROM sessions").get()).toEqual({ revoked_at: null })

    const loggedOut = oidcLogout({
      database,
      input: { client_id: client.data.client.id },
      realmId: authenticated.realm.id,
      sessionToken: authenticated.token,
    })
    expect(loggedOut).toEqual({ data: { revoked: true }, success: true })
    expect(database.sqlite.query("SELECT revoked_at, revocation_reason FROM sessions").get()).toMatchObject({
      revocation_reason: "rp_initiated_logout",
    })
  })
})
