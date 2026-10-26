import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { oidcAccessTokenContextResolve } from "../../src/features/oidc/actions/oidcAccessTokenContextResolve.js"
import { oidcAuthorizationRequestAuthorize } from "../../src/features/oidc/actions/oidcAuthorizationRequestAuthorize.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcDiscoveryGet } from "../../src/features/oidc/actions/oidcDiscoveryGet.js"
import { oidcLogout } from "../../src/features/oidc/actions/oidcLogout.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcTokenIssue } from "../../src/features/oidc/actions/oidcTokenIssue.js"
import { oidcUserInfoGet } from "../../src/features/oidc/actions/oidcUserInfoGet.js"
import { oidcBasicCredentialsParse } from "../../src/features/oidc/domain/oidcBasicCredentialsParse.js"
import { oidcJwtSign } from "../../src/features/oidc/domain/oidcJwtSign.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
import { oidcValueDecrypt } from "../../src/features/oidc/domain/oidcValueEncrypt.js"
import { oidcResourceOwnerScope } from "../../src/features/oidc/domain/oidcResourceOwnerScope.js"
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
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-correctness-"))
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

async function createSession(
  database: StorageDatabase,
  realm: Awaited<ReturnType<typeof createRealm>>,
  local: string,
  phoneNumber?: string,
) {
  const context = realmTenantContextCreate(realm.id, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${local}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: "Correctness User" },
      ...(phoneNumber === undefined ? {} : { phoneNumber }),
      userName: local,
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
    input: { identifier: local, password: "Correct Horse 12" },
    realmId: realm.id,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error("The session could not be created.")
  if (phoneNumber !== undefined)
    database.sqlite
      .query("UPDATE users SET phone_number = ?, phone_number_verified_at = ? WHERE realm_id = ? AND id = ?")
      .run(phoneNumber, database.runtime.now(), realm.id, login.data.authentication.userId)
  return {
    sessionId: login.data.session.session.id,
    token: login.data.session.token,
    userId: login.data.authentication.userId,
  }
}

function createClient(
  database: StorageDatabase,
  realmId: string,
  allowedScopes: string[],
  trusted = true,
  requireConsent = false,
) {
  const client = oidcClientCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      allowedScopes,
      clientType: "confidential",
      name: "Correctness client",
      redirectUris: ["https://client.example/callback"],
      requireConsent,
      trusted,
    },
    realmId,
  })
  expect(client.success).toBe(true)
  if (!client.success || client.data.clientSecret === undefined) throw new Error("The client could not be created.")
  return { client: client.data.client, clientSecret: client.data.clientSecret }
}

function createKey(database: StorageDatabase, realmId: string) {
  const key = oidcSigningKeyCreate({
    context: realmSystemContextCreate(),
    database,
    encryptionSecret: "correctness-secret",
    realmId,
  })
  expect(key.success).toBe(true)
  if (!key.success) throw new Error(key.errorMessage)
  return key.data.signingKey
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

function authorizeInputCreate(clientId: string, scope: string, extra?: Record<string, string>) {
  return {
    client_id: clientId,
    code_challenge: pkceChallengeCreate("verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"),
    code_challenge_method: "S256" as const,
    redirect_uri: "https://client.example/callback",
    response_type: "code" as const,
    scope,
    state: "correctness-state",
    ...extra,
  }
}

async function redeemCode(
  database: StorageDatabase,
  domain: string,
  input: Record<string, string>,
  authorization?: string,
) {
  const app = oidcServerAppCreate({ database, systemSecret: "correctness-secret" })
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" }
  if (authorization !== undefined) headers.authorization = authorization
  const response = await app.fetch(
    new Request(`https://${domain}/oauth2/token`, {
      body: new URLSearchParams(input),
      headers,
      method: "POST",
    }),
  )
  return { body: (await response.json()) as Record<string, unknown>, status: response.status }
}

test("discovery exposes offline_access/phone/address scopes, corrected claims, and query response mode", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "discovery-correctness.example.com")
    const discovery = oidcDiscoveryGet({ database, realmId: realm.id })
    expect(discovery.success).toBe(true)
    if (!discovery.success) return
    expect(discovery.data.scopes_supported).toContain("offline_access")
    expect(discovery.data.scopes_supported).toContain("phone")
    expect(discovery.data.scopes_supported).toContain("address")
    expect(discovery.data.scopes_supported).toContain("openid")
    expect(discovery.data.scopes_supported).toContain(oidcResourceOwnerScope)
    expect(discovery.data.claims_supported).not.toContain("nonce")
    expect(discovery.data.claims_supported).not.toContain("sid")
    expect(discovery.data.claims_supported).toContain("phone_number")
    expect(discovery.data.claims_supported).toContain("phone_number_verified")
    expect(discovery.data).toMatchObject({ response_modes_supported: ["query"] })
    expect(discovery.data.issuer).toBe("https://discovery-correctness.example.com")
    expect(discovery.data.userinfo_endpoint).toBe("https://discovery-correctness.example.com/oauth2/userinfo")
  })
})

test("authorization_code redeem without offline_access issues no refresh token", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "no-refresh.example.com")
    const session = await createSession(database, realm, "no-refresh-user")
    const { client, clientSecret } = createClient(database, realm.id, ["openid"])
    createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const { body, status } = await redeemCode(database, "no-refresh.example.com", {
      client_id: client.id,
      client_secret: clientSecret,
      code: authorization.data.code,
      code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
      grant_type: "authorization_code",
      redirect_uri: authorization.data.redirect_uri,
    })
    expect(status).toBe(200)
    expect(body).not.toHaveProperty("refresh_token")
    expect(body.scope).toBe("openid")
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM oidc_refresh_tokens").get()).toEqual({ count: 0 })
  })
})

test("authorization_code redeem with offline_access issues a usable refresh token", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "with-refresh.example.com")
    const session = await createSession(database, realm, "with-refresh-user")
    const { client, clientSecret } = createClient(database, realm.id, ["openid", "offline_access"])
    createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid offline_access"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const { body, status } = await redeemCode(database, "with-refresh.example.com", {
      client_id: client.id,
      client_secret: clientSecret,
      code: authorization.data.code,
      code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
      grant_type: "authorization_code",
      redirect_uri: authorization.data.redirect_uri,
    })
    expect(status).toBe(200)
    expect(typeof body.refresh_token).toBe("string")
    const rotated = await redeemCode(database, "with-refresh.example.com", {
      client_id: client.id,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: body.refresh_token as string,
    })
    expect(rotated.status).toBe(200)
  })
})

test("phone scope emits verified phone claims and address scope is accepted without claims", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "phone-claims.example.com")
    const session = await createSession(database, realm, "phone-user", "+14155552671")
    const { client, clientSecret } = createClient(database, realm.id, ["openid", "phone", "address"])
    createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid phone address"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const issued = oidcTokenIssue({
      database,
      encryptionSecret: "correctness-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        code: authorization.data.code,
        code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId: realm.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const userInfo = oidcUserInfoGet({ database, realmId: realm.id, token: issued.data.access_token })
    expect(userInfo.success).toBe(true)
    if (!userInfo.success) return
    expect(userInfo.data).toMatchObject({ phone_number: "+14155552671", phone_number_verified: true })
    expect(userInfo.data).not.toHaveProperty("address")
  })
})

test("phone scope omits phone claims when the user has no verified number", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "no-phone.example.com")
    const session = await createSession(database, realm, "no-phone-user")
    const { client, clientSecret } = createClient(database, realm.id, ["openid", "phone"])
    createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid phone"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const issued = oidcTokenIssue({
      database,
      encryptionSecret: "correctness-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        code: authorization.data.code,
        code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId: realm.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const userInfo = oidcUserInfoGet({ database, realmId: realm.id, token: issued.data.access_token })
    expect(userInfo.success).toBe(true)
    if (!userInfo.success) return
    expect(userInfo.data).not.toHaveProperty("phone_number")
    expect(userInfo.data.phone_number_verified).toBe(false)
  })
})

test("token endpoint Basic auth decodes RFC7617 credentials without URL decoding", async () => {
  const secret = "p:a%s s+word✓"
  const header = `Basic ${Buffer.from(`client-id:${secret}`, "utf8").toString("base64")}`
  const parsed = oidcBasicCredentialsParse(header, {})
  expect(parsed).toMatchObject({ clientId: "client-id", clientSecret: secret, success: true })
  const bodySecret = oidcBasicCredentialsParse(undefined, { client_id: "client-id", client_secret: secret })
  expect(bodySecret).toMatchObject({ clientId: "client-id", clientSecret: secret, success: true })
  // A body secret alongside a Basic header is rejected, and a mismatched body client_id is rejected.
  expect(oidcBasicCredentialsParse(header, { client_id: "client-id", client_secret: "other" })).toMatchObject({
    success: false,
  })
  expect(oidcBasicCredentialsParse(header, { client_id: "other-id" })).toMatchObject({ success: false })
  expect(oidcBasicCredentialsParse("Bearer token", {})).toMatchObject({ success: false })
  // A literal plus or percent sequence survives: no form-decoding is applied.
  const plus = oidcBasicCredentialsParse(`Basic ${Buffer.from("client-id:a+b%2Bc", "utf8").toString("base64")}`, {})
  expect(plus).toMatchObject({ clientSecret: "a+b%2Bc", success: true })
})

test("token endpoint accepts Basic client authentication end to end", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "basic-auth.example.com")
    const session = await createSession(database, realm, "basic-user")
    const { client, clientSecret } = createClient(database, realm.id, ["openid", "offline_access"])
    createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid offline_access"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const { body, status } = await redeemCode(
      database,
      "basic-auth.example.com",
      {
        client_id: client.id,
        code: authorization.data.code,
        code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      },
      `Basic ${Buffer.from(`${client.id}:${clientSecret}`, "utf8").toString("base64")}`,
    )
    expect(status).toBe(200)
    expect(typeof body.access_token).toBe("string")
  })
})

test("prompt=login and prompt=select_account force re-authentication", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "prompt-login.example.com")
    const session = await createSession(database, realm, "prompt-user")
    const { client } = createClient(database, realm.id, ["openid"])
    for (const prompt of ["login", "select_account"]) {
      const forced = oidcAuthorizationRequestAuthorize({
        database,
        encryptionSecret: "correctness-secret",
        input: authorizeInputCreate(client.id, "openid", { prompt }),
        realmId: realm.id,
        sessionToken: session.token,
      })
      expect(forced.success).toBe(false)
      if (forced.success) continue
      expect(forced.op).toBe("oidcAuthorizationInteractionRequired")
    }
    const plain = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(plain.success).toBe(true)
  })
})

test("prompt=consent forces the consent screen for a trusted client", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "prompt-consent.example.com")
    const session = await createSession(database, realm, "consent-user")
    const { client } = createClient(database, realm.id, ["openid"], true, true)
    const plain = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(plain.success).toBe(true)
    const forced = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid", { prompt: "consent" }),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(forced.success).toBe(false)
    if (forced.success) return
    expect(forced.op).toBe("oidcAuthorizationConsentRequired")
  })
})

test("invalid prompt values and none combinations are rejected as invalid_request", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "prompt-invalid.example.com")
    const session = await createSession(database, realm, "invalid-prompt-user")
    const { client } = createClient(database, realm.id, ["openid"])
    for (const prompt of ["none login", "bogus", "login login", "none consent"]) {
      const rejected = oidcAuthorizationRequestAuthorize({
        database,
        encryptionSecret: "correctness-secret",
        input: authorizeInputCreate(client.id, "openid", { prompt }),
        realmId: realm.id,
        sessionToken: session.token,
      })
      expect(rejected.success).toBe(false)
      if (rejected.success) continue
      expect(rejected.code).toBe("oidc.invalid-request")
    }
    const none = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid", { prompt: "none" }),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(none.success).toBe(true)
  })
})

test("max_age older than the session auth_time forces re-authentication", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "max-age.example.com")
    const session = await createSession(database, realm, "max-age-user")
    const { client } = createClient(database, realm.id, ["openid"])
    const staleRuntime = {
      now: () => testkit.runtime.now() + 120_000,
      randomBytes: testkit.runtime.randomBytes,
    }
    const stale = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid", { max_age: "60" }),
      realmId: realm.id,
      runtime: staleRuntime,
      sessionToken: session.token,
    })
    expect(stale.success).toBe(false)
    if (stale.success) return
    expect(stale.op).toBe("oidcAuthorizationInteractionRequired")
    const fresh = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid", { max_age: "3600" }),
      realmId: realm.id,
      runtime: staleRuntime,
      sessionToken: session.token,
    })
    expect(fresh.success).toBe(true)
  })
})

test("access token expiry tolerates five seconds of clock skew", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "skew-access.example.com")
    const session = await createSession(database, realm, "skew-user")
    const { client, clientSecret } = createClient(database, realm.id, ["openid"])
    createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const issued = oidcTokenIssue({
      database,
      encryptionSecret: "correctness-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        code: authorization.data.code,
        code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId: realm.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const row = database.sqlite.query("SELECT expires_at AS expiresAt FROM oidc_access_tokens").get() as {
      expiresAt: number
    }
    const skewed = oidcAccessTokenContextResolve({
      database,
      realmId: realm.id,
      runtime: { now: () => row.expiresAt + 4_000, randomBytes: testkit.runtime.randomBytes },
      token: issued.data.access_token,
    })
    expect(skewed.success).toBe(true)
    const expired = oidcAccessTokenContextResolve({
      database,
      realmId: realm.id,
      runtime: { now: () => row.expiresAt + 60_000, randomBytes: testkit.runtime.randomBytes },
      token: issued.data.access_token,
    })
    expect(expired.success).toBe(false)
  })
})

test("logout id_token_hint tolerates five seconds of expiry skew", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "skew-logout.example.com")
    const session = await createSession(database, realm, "logout-skew-user")
    const { client, clientSecret } = createClient(database, realm.id, ["openid"])
    const key = createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const issued = oidcTokenIssue({
      database,
      encryptionSecret: "correctness-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        code: authorization.data.code,
        code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
        grant_type: "authorization_code",
        redirect_uri: authorization.data.redirect_uri,
      },
      realmId: realm.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success || issued.data.id_token === undefined) return
    const claims = oidcJwtVerify(issued.data.id_token, key.publicJwk as unknown as Record<string, unknown>)
    expect(claims.success).toBe(true)
    if (!claims.success) return
    const exp = claims.data.exp as number
    const withinSkew = oidcLogout({
      database,
      encryptionSecret: "correctness-secret",
      input: { id_token_hint: issued.data.id_token },
      realmId: realm.id,
      runtime: { now: () => exp * 1_000 + 3_000, randomBytes: testkit.runtime.randomBytes },
    })
    expect(withinSkew.success).toBe(true)
  })
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "skew-logout-expired.example.com")
    const session = await createSession(database, realm, "logout-expired-user")
    const { client, clientSecret } = createClient(database, realm.id, ["openid"])
    const key = createKey(database, realm.id)
    const authorization = oidcAuthorizationRequestAuthorize({
      database,
      encryptionSecret: "correctness-secret",
      input: authorizeInputCreate(client.id, "openid"),
      realmId: realm.id,
      sessionToken: session.token,
    })
    expect(authorization.success).toBe(true)
    if (!authorization.success) return
    const issued = oidcTokenIssue({
      database,
      encryptionSecret: "correctness-secret",
      input: {
        client_id: client.id,
        client_secret: clientSecret,
        code: authorization.data.code,
        code_verifier: "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~",
        grant_type: "authorization_code",
        redirect_uri: "https://client.example/callback",
      },
      realmId: realm.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success || issued.data.id_token === undefined) return
    const claims = oidcJwtVerify(issued.data.id_token, key.publicJwk as unknown as Record<string, unknown>)
    expect(claims.success).toBe(true)
    if (!claims.success) return
    const exp = claims.data.exp as number
    const beyondSkew = oidcLogout({
      database,
      encryptionSecret: "correctness-secret",
      input: { id_token_hint: issued.data.id_token },
      realmId: realm.id,
      runtime: { now: () => exp * 1_000 + 60_000, randomBytes: testkit.runtime.randomBytes },
    })
    expect(beyondSkew.success).toBe(false)
  })
})

test("oidcJwtVerify enforces exp and nbf with skew only when a clock is provided", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "skew-verify.example.com")
    createKey(database, realm.id)
    const stored = database.sqlite
      .query("SELECT id, encrypted_private_key AS encryptedPrivateKey, public_jwk AS publicJwk FROM oidc_signing_keys")
      .get() as {
      encryptedPrivateKey: string
      id: string
      publicJwk: string
    }
    const privateKey = oidcValueDecrypt(stored.encryptedPrivateKey, realm.id, "correctness-secret")
    expect(privateKey.success).toBe(true)
    if (!privateKey.success) return
    const publicJwk = JSON.parse(stored.publicJwk) as Record<string, unknown>
    const now = 1_700_000_000_000
    const signed = oidcJwtSign(
      { alg: "RS256", kid: stored.id, typ: "JWT" },
      { aud: "client", exp: Math.floor(now / 1_000), iat: Math.floor(now / 1_000), iss: "issuer", sub: "user" },
      privateKey.data,
    )
    expect(signed.success).toBe(true)
    if (!signed.success) return
    // Signature-only verification keeps working for callers without a clock.
    expect(oidcJwtVerify(signed.data, publicJwk).success).toBe(true)
    // Within skew the token is still valid; a minute past expiry it is not.
    expect(oidcJwtVerify(signed.data, publicJwk, { now: now + 3_000 }).success).toBe(true)
    expect(oidcJwtVerify(signed.data, publicJwk, { now: now + 60_000 }).success).toBe(false)
    const future = oidcJwtSign(
      { alg: "RS256", kid: stored.id, typ: "JWT" },
      {
        aud: "client",
        exp: Math.floor((now + 600_000) / 1_000),
        iat: Math.floor(now / 1_000),
        iss: "issuer",
        nbf: Math.floor((now + 3_000) / 1_000),
        sub: "user",
      },
      privateKey.data,
    )
    expect(future.success).toBe(true)
    if (!future.success) return
    expect(oidcJwtVerify(future.data, publicJwk, { now }).success).toBe(true)
    const farFuture = oidcJwtSign(
      { alg: "RS256", kid: stored.id, typ: "JWT" },
      {
        aud: "client",
        exp: Math.floor((now + 600_000) / 1_000),
        iat: Math.floor(now / 1_000),
        iss: "issuer",
        nbf: Math.floor((now + 60_000) / 1_000),
        sub: "user",
      },
      privateKey.data,
    )
    expect(farFuture.success).toBe(true)
    if (!farFuture.success) return
    expect(oidcJwtVerify(farFuture.data, publicJwk, { now }).success).toBe(false)
  })
})
