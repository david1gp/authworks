import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { instanceBootstrapAdminCreate } from "../../src/features/instances/actions/instanceBootstrapAdminCreate.js"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { oidcAuthorizationCodeRedeem } from "../../src/features/oidc/actions/oidcAuthorizationCodeRedeem.js"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientGet } from "../../src/features/oidc/actions/oidcClientGet.js"
import { oidcClientList } from "../../src/features/oidc/actions/oidcClientList.js"
import { oidcDiscoveryGet } from "../../src/features/oidc/actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../../src/features/oidc/actions/oidcJwksGet.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyList } from "../../src/features/oidc/actions/oidcSigningKeyList.js"
import { oidcTokenIssue } from "../../src/features/oidc/actions/oidcTokenIssue.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcClientSecretMatches } from "../../src/features/oidc/domain/oidcClientSecretMatches.js"
import { oidcJwtSign } from "../../src/features/oidc/domain/oidcJwtSign.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
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
import { sessionPasswordCreate } from "../../src/features/sessions/public/sessionPasswordCreate.js"
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

async function createInstance(database: StorageDatabase, domain: string) {
  const created = instanceCreate({ context: instanceSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.instance
}

async function createAuthenticatedSession(
  database: StorageDatabase,
  domain: string,
): Promise<{ instance: Awaited<ReturnType<typeof createInstance>>; token: string; userId: string }> {
  const instance = await createInstance(database, domain)
  const context = instanceTenantContextCreate(instance.id, "anonymous")
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
    instanceId: instance.id,
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
      instanceId: instance.id,
    }).success,
  ).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: domain.replaceAll(".", "-"), password: "Correct Horse 12" },
    instanceId: instance.id,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The OIDC test session could not be created.")
  return { instance, token: login.data.session.token, userId: login.data.authentication.userId }
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
    context: instanceSystemContextCreate(),
    database,
    input: {
      allowedScopes: ["openid", "profile", "email"],
      clientType: "confidential",
      name: `${domain} client`,
      redirectUris: ["https://client.example/callback"],
    },
    instanceId: authenticated.instance.id,
  })
  if (!client.success || client.data.clientSecret === undefined) throw new Error("The OIDC fixture client failed.")
  const key = oidcSigningKeyCreate({
    context: instanceSystemContextCreate(),
    database,
    encryptionSecret: "oidc-fixture-secret",
    instanceId: authenticated.instance.id,
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
    instanceId: authenticated.instance.id,
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

test("OIDC clients are tenant-isolated, return secrets once, and write safe events", async () => {
  await withDatabase(async (database) => {
    const alpha = await createInstance(database, "oidc-alpha.example.com")
    const beta = await createInstance(database, "oidc-beta.example.com")
    const created = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile"],
        clientType: "confidential",
        name: "Alpha client",
        redirectUris: ["https://client.example/callback"],
      },
      instanceId: alpha.id,
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
      context: instanceSystemContextCreate(),
      database,
      instanceId: alpha.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    expect(client.data.client).not.toHaveProperty("clientSecret")
    const alphaContext = instanceTenantContextCreate(alpha.id, "alpha-admin")
    const crossTenantClient = oidcClientGet({
      clientId: created.data.client.id,
      context: alphaContext,
      database,
      instanceId: beta.id,
    })
    expect(crossTenantClient.success).toBe(false)
    const betaClients = oidcClientList({
      context: instanceTenantContextCreate(beta.id, "beta-admin"),
      database,
      instanceId: beta.id,
    })
    expect(betaClients.success).toBe(true)
    if (!betaClients.success) return
    expect(betaClients.data.clients).toEqual([])
    const events = database.db.select().from(storageEventTable).all()
    expect(JSON.stringify(events)).not.toContain(created.data.clientSecret)
    expect(JSON.stringify(events)).not.toContain("secretHash")
  })
})

test("signing keys rotate without exposing private material and serve discovery and JWKS", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "keys.example.com")
    const first = oidcSigningKeyCreate({
      context: instanceSystemContextCreate(),
      database,
      encryptionSecret: "test-encryption-secret",
      instanceId: instance.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    const second = oidcSigningKeyCreate({
      context: instanceSystemContextCreate(),
      database,
      encryptionSecret: "test-encryption-secret",
      instanceId: instance.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const keys = oidcSigningKeyList({ context: instanceSystemContextCreate(), database, instanceId: instance.id })
    expect(keys.success).toBe(true)
    if (!keys.success) return
    expect(keys.data?.signingKeys).toHaveLength(2)
    expect(keys.data?.signingKeys[0]?.status).toBe("active")
    expect(keys.data?.signingKeys[1]?.status).toBe("retired")
    expect(keys.data?.signingKeys[0]).not.toHaveProperty("encryptedPrivateKey")
    const jwks = oidcJwksGet({ database, instanceId: instance.id })
    expect(jwks.success).toBe(true)
    if (!jwks.success) return
    expect(jwks.data?.keys).toHaveLength(2)
    const discovery = oidcDiscoveryGet({ database, instanceId: instance.id })
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
    const privateKey = oidcValueDecrypt(encrypted?.encryptedPrivateKey ?? "", instance.id, "test-encryption-secret")
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
    const instance = await createInstance(database, "routes.example.com")
    const bootstrap = instanceBootstrapAdminCreate({
      context: instanceSystemContextCreate(),
      database,
      instanceId: instance.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const app = oidcServerAppCreate({ database, systemSecret: "system-secret" })
    const unauthorized = await app.fetch(new Request(`https://server/system/instances/${instance.id}/oidc/clients`))
    expect(unauthorized.status).toBe(401)
    const client = oidcApiClientCreate({
      baseUrl: "https://server",
      token: "system-secret",
      fetch: async (input, init) => app.request(input.toString(), init),
    })
    const created = await client.oidcClientCreate(instance.id, {
      clientType: "public",
      name: "Route client",
      redirectUris: ["https://client.example/callback"],
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
      new Request(`https://routes.example.com/instances/${instance.id}/oidc/clients`, {
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
      context: instanceSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile"],
        clientType: "public",
        name: "Authorization client",
        redirectUris: ["https://client.example/callback?channel=one"],
      },
      instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
      runtime: database.runtime,
      sessionToken: authenticated.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    expect(authorization.data.state).toBe("state-value")
    expect(authorization.data.expires_at).toBe(database.runtime.now() + 60_000)
    const stored = database.sqlite
      .query(
        "SELECT r.state_encrypted, r.nonce_encrypted, c.token_hash FROM oidc_authorization_requests r JOIN oidc_authorization_codes c ON c.instance_id = r.instance_id",
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
      instanceId: authenticated.instance.id,
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
        instanceId: authenticated.instance.id,
        runtime: database.runtime,
      }).success,
    ).toBe(false)
  })
})

test("authorization rejects redirect, state, PKCE, expiry, and tenant mismatches", async () => {
  await withDatabase(async (database, testkit) => {
    const authenticated = await createAuthenticatedSession(database, "authorize-negative.example.com")
    const other = await createAuthenticatedSession(database, "authorize-other.example.com")
    const client = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Negative authorization client",
        redirectUris: ["https://client.example/callback"],
      },
      instanceId: authenticated.instance.id,
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
      state: "required-state",
    }
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: { ...input, redirect_uri: "https://client.example/other" },
        instanceId: authenticated.instance.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(false)
    expect(
      oidcAuthorizationRequestAuthorize({
        database,
        input: { ...input, state: "" },
        instanceId: authenticated.instance.id,
        sessionToken: authenticated.token,
      }).success,
    ).toBe(false)
    const issued = oidcAuthorizationRequestAuthorize({
      database,
      input,
      instanceId: authenticated.instance.id,
      runtime: database.runtime,
      sessionToken: authenticated.token,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    expect(
      oidcAuthorizationCodeRedeem({
        database,
        input: {
          client_id: client.data.client.id,
          code: issued.data.code,
          code_verifier: "wrong-verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
          redirect_uri: issued.data.redirect_uri,
        },
        instanceId: authenticated.instance.id,
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
        instanceId: other.instance.id,
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
        instanceId: authenticated.instance.id,
      }).success,
    ).toBe(false)
  })
})

test("authorization and code consumption roll back with their audit events", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "authorize-atomic.example.com")
    const client = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Atomic authorization client",
        redirectUris: ["https://client.example/callback"],
      },
      instanceId: authenticated.instance.id,
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
        instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
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
        instanceId: authenticated.instance.id,
      }).success,
    ).toBe(false)
    expect(database.sqlite.query("SELECT used_at FROM oidc_authorization_codes").get()).toEqual({ used_at: null })
  })
})

test("authorization routes use the authenticated session and the API client contracts", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "authorize-route.example.com")
    const client = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Authorization route client",
        redirectUris: ["https://client.example/callback"],
      },
      instanceId: authenticated.instance.id,
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

test("the standards token endpoint exchanges codes, signs scoped tokens, and rotates refresh tokens", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "token.example.com")
    const client = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile", "email"],
        clientType: "confidential",
        name: "Token client",
        redirectUris: ["https://client.example/callback"],
      },
      instanceId: authenticated.instance.id,
    })
    expect(client.success).toBe(true)
    if (!client.success || client.data.clientSecret === undefined) return
    const key = oidcSigningKeyCreate({
      context: instanceSystemContextCreate(),
      database,
      encryptionSecret: "token-secret",
      instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
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
      context: instanceSystemContextCreate(),
      database,
      input: { clientType: "public", name: "Public token client", redirectUris: ["https://client.example/callback"] },
      instanceId: authenticated.instance.id,
    })
    expect(publicClient.success).toBe(true)
    if (!publicClient.success) return
    const key = oidcSigningKeyCreate({
      context: instanceSystemContextCreate(),
      database,
      encryptionSecret: "token-auth-secret",
      instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
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
      context: instanceSystemContextCreate(),
      database,
      input: {
        clientType: "confidential",
        name: "Basic token client",
        redirectUris: ["https://client.example/callback"],
      },
      instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
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
      instanceId: "018f0b7b-5c6e-7b7d-8e8f-901234567890",
    })
    expect(foreign.success).toBe(false)
  })
})

test("token exchange is atomic with code consumption and token audit events", async () => {
  await withDatabase(async (database) => {
    const authenticated = await createAuthenticatedSession(database, "token-atomic.example.com")
    const client = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: { clientType: "public", name: "Atomic token client", redirectUris: ["https://client.example/callback"] },
      instanceId: authenticated.instance.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    expect(
      oidcSigningKeyCreate({
        context: instanceSystemContextCreate(),
        database,
        encryptionSecret: "atomic-token-secret",
        instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
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
      instanceId: authenticated.instance.id,
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

    await createInstance(database, "userinfo-beta.example.com")
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

    const beta = await createInstance(database, "revoke-beta.example.com")
    const betaClient = oidcClientCreate({
      context: instanceSystemContextCreate(),
      database,
      input: { clientType: "confidential", name: "Beta client", redirectUris: ["https://client.example/callback"] },
      instanceId: beta.id,
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
        .query("SELECT revoked_at FROM oidc_refresh_tokens WHERE instance_id = ?")
        .get(atomic.authenticated.instance.id),
    ).toEqual({ revoked_at: null })
    database.sqlite.run("DROP TRIGGER reject_oidc_revocation_events")
  })
})
