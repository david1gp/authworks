import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcClientUpdate } from "../../src/features/oidc/actions/oidcClientUpdate.js"
import { oidcDiscoveryGet } from "../../src/features/oidc/actions/oidcDiscoveryGet.js"
import { oidcJwksGet } from "../../src/features/oidc/actions/oidcJwksGet.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcSigningKeyDelete } from "../../src/features/oidc/actions/oidcSigningKeyDelete.js"
import { oidcSigningKeyLifecycleSet } from "../../src/features/oidc/actions/oidcSigningKeyLifecycleSet.js"
import { oidcTokenIntrospect } from "../../src/features/oidc/actions/oidcTokenIntrospect.js"
import { oidcTokenIssue } from "../../src/features/oidc/actions/oidcTokenIssue.js"
import { oidcRedirectUriValidate } from "../../src/features/oidc/domain/oidcRedirectUriValidate.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-config-"))
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

function runtimeAt(testkit: ReturnType<typeof platformTestkitCreate>, now: number) {
  return { now: () => now, randomBytes: testkit.runtime.randomBytes }
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

function jwtPayloadGet(token: string): Record<string, unknown> {
  const payload = token.split(".")[1]
  if (payload === undefined) throw new Error("The OIDC test token has no payload.")
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
}

async function createAuthenticatedSession(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const realm = created.data.realm
  const context = realmTenantContextCreate(realm.id, "anonymous")
  const suffix = domain.replaceAll(".", "-")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${suffix}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "OIDC Config User" },
      userName: suffix,
    },
    realmId: realm.id,
    onVerificationToken: (delivery) => {
      verificationToken = delivery.token
    },
  })
  expect(registered.success).toBe(true)
  expect(
    passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.id }).success,
  ).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: suffix, password: "Correct Horse 12" },
    realmId: realm.id,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The OIDC test session could not be created.")
  return {
    realm,
    sessionId: login.data.session.session.id,
    token: login.data.session.token,
    userId: login.data.authentication.userId,
  }
}

type OidcConfigClientInput = Parameters<typeof oidcClientCreate>[0]["input"]

async function createConfigClient(
  database: StorageDatabase,
  realmId: string,
  input: OidcConfigClientInput,
  now: number,
  testkit: ReturnType<typeof platformTestkitCreate>,
) {
  const created = oidcClientCreate({
    context: realmSystemContextCreate(),
    database,
    input,
    realmId,
    runtime: runtimeAt(testkit, now),
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  if (created.data.clientSecret === undefined) throw new Error("The OIDC config fixture client has no secret.")
  return { client: created.data.client, clientSecret: created.data.clientSecret }
}

async function createConfigSigningKey(
  database: StorageDatabase,
  realmId: string,
  now: number,
  testkit: ReturnType<typeof platformTestkitCreate>,
) {
  const key = oidcSigningKeyCreate({
    context: realmSystemContextCreate(),
    database,
    encryptionSecret: "oidc-config-fixture-secret",
    realmId,
    runtime: runtimeAt(testkit, now),
  })
  expect(key.success).toBe(true)
  if (!key.success) throw new Error(key.errorMessage)
  return key.data.signingKey
}

async function authorizeCodeGrant(
  database: StorageDatabase,
  realmId: string,
  clientId: string,
  sessionToken: string,
  now: number,
  testkit: ReturnType<typeof platformTestkitCreate>,
  verifier: string,
) {
  const authorization = oidcAuthorizationRequestAuthorize({
    database,
    input: {
      client_id: clientId,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256",
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope: "openid profile offline_access",
      state: "config-state",
    },
    realmId,
    runtime: runtimeAt(testkit, now),
    sessionToken,
  })
  expect(authorization.success).toBe(true)
  if (!authorization.success) throw new Error(authorization.errorMessage)
  return authorization.data
}

async function issueCodeGrant(
  database: StorageDatabase,
  realmId: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  verifier: string,
  now: number,
  testkit: ReturnType<typeof platformTestkitCreate>,
) {
  const issued = oidcTokenIssue({
    database,
    encryptionSecret: "oidc-config-fixture-secret",
    input: {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    },
    realmId,
    runtime: runtimeAt(testkit, now),
  })
  expect(issued.success).toBe(true)
  if (!issued.success) throw new Error(issued.errorMessage)
  if (issued.data.refresh_token === undefined) throw new Error("The OIDC config fixture has no refresh token.")
  return issued.data
}

test("per-client lifetimes are reflected in issued token expiry claims", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "lifetimes.example")
    const { client, clientSecret } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile", "offline_access"],
        accessTokenLifetimeSeconds: 600,
        clientType: "confidential",
        idTokenLifetimeSeconds: 3600,
        name: "lifetimes client",
        redirectUris: ["https://client.example/callback"],
        refreshTokenAbsoluteLifetimeSeconds: 86400,
        refreshTokenIdleLifetimeSeconds: 3600,
        trusted: true,
      },
      now,
      testkit,
    )
    expect(client.accessTokenLifetimeSeconds).toBe(600)
    expect(client.idTokenLifetimeSeconds).toBe(3600)
    expect(client.refreshTokenAbsoluteLifetimeSeconds).toBe(86400)
    expect(client.refreshTokenIdleLifetimeSeconds).toBe(3600)
    await createConfigSigningKey(database, authenticated.realm.id, now, testkit)
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorized = await authorizeCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      authenticated.token,
      now,
      testkit,
      verifier,
    )
    const issued = await issueCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      clientSecret,
      authorized.code,
      authorized.redirect_uri,
      verifier,
      now,
      testkit,
    )
    const access = jwtPayloadGet(issued.access_token)
    const idToken = jwtPayloadGet(issued.id_token ?? "")
    expect((access.exp as number) - (access.iat as number)).toBe(600)
    expect((idToken.exp as number) - (idToken.iat as number)).toBe(3600)
    expect(issued.expires_in).toBe(600)
  })
})

test("refresh idle expiry kills rotation while activity within idle rotates", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "idle.example")
    const { client, clientSecret } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile", "offline_access"],
        clientType: "confidential",
        name: "idle client",
        redirectUris: ["https://client.example/callback"],
        refreshTokenIdleLifetimeSeconds: 60,
        trusted: true,
      },
      now,
      testkit,
    )
    await createConfigSigningKey(database, authenticated.realm.id, now, testkit)
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorized = await authorizeCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      authenticated.token,
      now,
      testkit,
      verifier,
    )
    const issued = await issueCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      clientSecret,
      authorized.code,
      authorized.redirect_uri,
      verifier,
      now,
      testkit,
    )
    const rotated = oidcTokenIssue({
      database,
      encryptionSecret: "oidc-config-fixture-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: issued.refresh_token ?? "",
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 30_000),
    })
    expect(rotated.success).toBe(true)
    const expired = oidcTokenIssue({
      database,
      encryptionSecret: "oidc-config-fixture-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: issued.refresh_token ?? "",
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 61_000),
    })
    expect(expired.success).toBe(false)
  })
})

test("refresh absolute lifetime kills the family after its creation window", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "absolute.example")
    const { client, clientSecret } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile", "offline_access"],
        clientType: "confidential",
        name: "absolute client",
        redirectUris: ["https://client.example/callback"],
        refreshTokenAbsoluteLifetimeSeconds: 120,
        trusted: true,
      },
      now,
      testkit,
    )
    await createConfigSigningKey(database, authenticated.realm.id, now, testkit)
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorized = await authorizeCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      authenticated.token,
      now,
      testkit,
      verifier,
    )
    const issued = await issueCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      clientSecret,
      authorized.code,
      authorized.redirect_uri,
      verifier,
      now,
      testkit,
    )
    const rotated = oidcTokenIssue({
      database,
      encryptionSecret: "oidc-config-fixture-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: issued.refresh_token ?? "",
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 30_000),
    })
    expect(rotated.success).toBe(true)
    if (!rotated.success || rotated.data.refresh_token === undefined)
      throw new Error("The OIDC config rotation fixture failed.")
    const killed = oidcTokenIssue({
      database,
      encryptionSecret: "oidc-config-fixture-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: rotated.data.refresh_token,
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 121_000),
    })
    expect(killed.success).toBe(false)
  })
})

test("refresh grant allowlist denies refresh_token when removed from the client", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "grants.example")
    const { client, clientSecret } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile", "offline_access"],
        clientType: "confidential",
        grantTypes: ["authorization_code"],
        name: "grants client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      now,
      testkit,
    )
    expect(client.grantTypes).toEqual(["authorization_code"])
    await createConfigSigningKey(database, authenticated.realm.id, now, testkit)
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorized = await authorizeCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      authenticated.token,
      now,
      testkit,
      verifier,
    )
    const issued = oidcTokenIssue({
      database,
      encryptionSecret: "oidc-config-fixture-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        code: authorized.code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: authorized.redirect_uri,
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
    })
    expect(issued.success).toBe(true)
    if (!issued.success || issued.data.refresh_token === undefined)
      throw new Error("The OIDC grants fixture has no refresh token.")
    const denied = oidcTokenIssue({
      database,
      encryptionSecret: "oidc-config-fixture-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: issued.data.refresh_token,
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 1_000),
    })
    expect(denied.success).toBe(false)
    if (denied.success) throw new Error("The removed refresh_token grant was unexpectedly allowed.")
    expect(denied.op).toBe("oidcTokenUnauthorizedClient")
  })
})

test("response_type allowlist denies code when the client does not allow it", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "responsetype.example")
    const { client } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile"],
        clientType: "confidential",
        name: "response type client",
        redirectUris: ["https://client.example/callback"],
        responseTypes: [],
        trusted: true,
      },
      now,
      testkit,
    )
    expect(client.responseTypes).toEqual([])
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      input: {
        client_id: client.id,
        code_challenge: pkceChallengeCreate("verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"),
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid profile",
        state: "config-state",
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
      sessionToken: authenticated.token,
    })
    expect(authorization.success).toBe(false)
    if (authorization.success) throw new Error("The disallowed response_type was unexpectedly allowed.")
    expect(authorization.op).toBe("oidcAuthorizationUnsupportedResponseType")
  })
})

test("devMode allows http redirects on non-loopback hosts and defaults reject them", async () => {
  expect(oidcRedirectUriValidate("http://192.168.1.10:3000/callback", true, true).success).toBe(true)
  expect(oidcRedirectUriValidate("http://192.168.1.10:3000/callback").success).toBe(false)
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "devmode.example")
    const created = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid"],
        clientType: "public",
        devMode: true,
        name: "dev client",
        redirectUris: ["http://192.168.1.10:3000/callback"],
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    expect(created.data.client.devMode).toBe(true)
    const rejected = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid"],
        clientType: "public",
        name: "prod client",
        redirectUris: ["http://192.168.1.10:3000/callback"],
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
    })
    expect(rejected.success).toBe(false)
  })
})

test("introspection reports active tokens, rejects inactive, cross-client, and wrong auth", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "introspect.example")
    const { client, clientSecret } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile", "offline_access"],
        clientType: "confidential",
        name: "introspect client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      now,
      testkit,
    )
    const other = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile", "offline_access"],
        clientType: "confidential",
        name: "other client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      now,
      testkit,
    )
    await createConfigSigningKey(database, authenticated.realm.id, now, testkit)
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorized = await authorizeCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      authenticated.token,
      now,
      testkit,
      verifier,
    )
    const issued = await issueCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      clientSecret,
      authorized.code,
      authorized.redirect_uri,
      verifier,
      now,
      testkit,
    )
    const active = oidcTokenIntrospect({
      database,
      input: { client_id: client.id, client_secret: clientSecret, token: issued.access_token },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 1_000),
    })
    expect(active.success).toBe(true)
    if (!active.success) throw new Error(active.errorMessage)
    expect(active.data).toMatchObject({ active: true, client_id: client.id, sub: authenticated.userId })
    const refreshed = oidcTokenIntrospect({
      database,
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        token: issued.refresh_token ?? "",
        token_type_hint: "refresh_token",
      },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 1_000),
    })
    expect(refreshed.success).toBe(true)
    if (!refreshed.success) throw new Error(refreshed.errorMessage)
    expect(refreshed.data).toMatchObject({ active: true, client_id: client.id, token_type: "refresh_token" })
    const unknown = oidcTokenIntrospect({
      database,
      input: { client_id: client.id, client_secret: clientSecret, token: "not-a-token" },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 1_000),
    })
    expect(unknown.success).toBe(true)
    if (!unknown.success) throw new Error(unknown.errorMessage)
    expect(unknown.data).toEqual({ active: false })
    const crossClient = oidcTokenIntrospect({
      database,
      input: { client_id: other.client.id, client_secret: other.clientSecret, token: issued.access_token },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 1_000),
    })
    expect(crossClient.success).toBe(true)
    if (!crossClient.success) throw new Error(crossClient.errorMessage)
    expect(crossClient.data).toEqual({ active: false })
    const wrongAuth = oidcTokenIntrospect({
      database,
      input: { client_id: client.id, client_secret: "wrong-secret", token: issued.access_token },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 1_000),
    })
    expect(wrongAuth.success).toBe(false)
  })
})

test("jwks excludes long-retired keys and retired keys are deletable while active are not", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "jwksprune.example")
    const first = await createConfigSigningKey(database, authenticated.realm.id, now, testkit)
    const retired = oidcSigningKeyLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { status: "retired" },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
      signingKeyId: first.id,
    })
    expect(retired.success).toBe(true)
    const second = await createConfigSigningKey(database, authenticated.realm.id, now + 1_000, testkit)
    const fresh = oidcJwksGet({ database, realmId: authenticated.realm.id, runtime: runtimeAt(testkit, now + 2_000) })
    expect(fresh.success).toBe(true)
    if (!fresh.success) throw new Error(fresh.errorMessage)
    expect(fresh.data.keys.map((key) => key.kid)).toContain(first.id)
    const pruned = oidcJwksGet({
      database,
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 24 * 60 * 60 * 1_000 + 1_000),
    })
    expect(pruned.success).toBe(true)
    if (!pruned.success) throw new Error(pruned.errorMessage)
    expect(pruned.data.keys.map((key) => key.kid)).not.toContain(first.id)
    expect(pruned.data.keys.map((key) => key.kid)).toContain(second.id)
    const activeDelete = oidcSigningKeyDelete({
      context: realmSystemContextCreate(),
      database,
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 3_000),
      signingKeyId: second.id,
    })
    expect(activeDelete.success).toBe(false)
    const retiredDelete = oidcSigningKeyDelete({
      context: realmSystemContextCreate(),
      database,
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now + 3_000),
      signingKeyId: first.id,
    })
    expect(retiredDelete.success).toBe(true)
  })
})

test("discovery advertises the introspection endpoint", async () => {
  await withDatabase(async (database) => {
    const created = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "discovery.example", name: "discovery.example" },
    })
    expect(created.success).toBe(true)
    if (!created.success) throw new Error(created.errorMessage)
    const discovery = oidcDiscoveryGet({ database, realmId: created.data.realm.id })
    expect(discovery.success).toBe(true)
    if (!discovery.success) throw new Error(discovery.errorMessage)
    expect(discovery.data.introspection_endpoint.endsWith("/oauth2/introspect")).toBe(true)
    expect(discovery.data.introspection_endpoint_auth_methods_supported).toEqual([
      "client_secret_basic",
      "client_secret_post",
      "none",
    ])
  })
})

test("introspection is served over both oauth2 and oidc paths", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "introspecthttp.example")
    const { client, clientSecret } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid", "profile", "offline_access"],
        clientType: "confidential",
        name: "introspect http client",
        redirectUris: ["https://client.example/callback"],
        trusted: true,
      },
      now,
      testkit,
    )
    await createConfigSigningKey(database, authenticated.realm.id, now, testkit)
    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorized = await authorizeCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      authenticated.token,
      now,
      testkit,
      verifier,
    )
    const issued = await issueCodeGrant(
      database,
      authenticated.realm.id,
      client.id,
      clientSecret,
      authorized.code,
      authorized.redirect_uri,
      verifier,
      now,
      testkit,
    )
    const app = oidcServerAppCreate({ database, systemSecret: "oidc-config-fixture-secret" })
    const credentials = Buffer.from(`${client.id}:${clientSecret}`).toString("base64")
    for (const path of ["/oauth2/introspect", "/oidc/introspect"]) {
      const response = await app.fetch(
        new Request(`https://introspecthttp.example${path}`, {
          body: new URLSearchParams({ token: issued.access_token }),
          headers: {
            authorization: `Basic ${credentials}`,
            "content-type": "application/x-www-form-urlencoded",
            host: "introspecthttp.example",
          },
          method: "POST",
        }),
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as Record<string, unknown>
      expect(body).toMatchObject({ active: true, client_id: client.id })
    }
  })
})

test("lifetime and allowlist updates validate ranges and clear back to defaults", async () => {
  await withDatabase(async (database, testkit) => {
    const now = 1_700_000_000_000
    const authenticated = await createAuthenticatedSession(database, "updates.example")
    const { client } = await createConfigClient(
      database,
      authenticated.realm.id,
      {
        allowedScopes: ["openid"],
        clientType: "confidential",
        name: "updates client",
        redirectUris: ["https://client.example/callback"],
      },
      now,
      testkit,
    )
    expect(client.accessTokenLifetimeSeconds).toBeNull()
    const invalid = oidcClientUpdate({
      clientId: client.id,
      context: realmSystemContextCreate(),
      database,
      input: { accessTokenLifetimeSeconds: 100_000 },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
    })
    expect(invalid.success).toBe(false)
    const inverted = oidcClientUpdate({
      clientId: client.id,
      context: realmSystemContextCreate(),
      database,
      input: { refreshTokenAbsoluteLifetimeSeconds: 60, refreshTokenIdleLifetimeSeconds: 3600 },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
    })
    expect(inverted.success).toBe(false)
    const updated = oidcClientUpdate({
      clientId: client.id,
      context: realmSystemContextCreate(),
      database,
      input: { accessTokenLifetimeSeconds: 900, devMode: true, grantTypes: ["authorization_code"] },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
    })
    expect(updated.success).toBe(true)
    if (!updated.success) throw new Error(updated.errorMessage)
    expect(updated.data.client.accessTokenLifetimeSeconds).toBe(900)
    expect(updated.data.client.devMode).toBe(true)
    const cleared = oidcClientUpdate({
      clientId: client.id,
      context: realmSystemContextCreate(),
      database,
      input: { accessTokenLifetimeSeconds: null },
      realmId: authenticated.realm.id,
      runtime: runtimeAt(testkit, now),
    })
    expect(cleared.success).toBe(true)
    if (!cleared.success) throw new Error(cleared.errorMessage)
    expect(cleared.data.client.accessTokenLifetimeSeconds).toBeNull()
  })
})
