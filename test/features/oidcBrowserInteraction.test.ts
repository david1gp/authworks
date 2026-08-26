import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { oidcAuthorizationInteractionCreate } from "../../src/features/oidc/actions/oidcAuthorizationInteractionCreate.js"
import { oidcAuthorizationInteractionResolve } from "../../src/features/oidc/actions/oidcAuthorizationInteractionResolve.js"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcJwtVerify } from "../../src/features/oidc/domain/oidcJwtVerify.js"
import { oidcTokenResponseSchema } from "../../src/features/oidc/public/oidcTokenResponseSchema.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { runtimeCreate } from "../../src/platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-browser-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function cookieGet(value: string | null, name: string): string {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(value ?? "")
  return match?.[1] ?? ""
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

test("HTML authorization uses an opaque interaction, cookie binding, consent, and one-time resume", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "browser-oidc.example.com", name: "Browser OIDC" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "browser@example.com",
        password: "Correct Horse 12",
        profile: {},
        userName: "browser-user",
      },
      realmId: realm.data.realm.id,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
    })
    expect(registered.success).toBe(true)
    expect(
      passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.data.realm.id })
        .success,
    ).toBe(true)
    const login = passwordLogin({
      context,
      database,
      input: { identifier: "browser-user", password: "Correct Horse 12" },
      realmId: realm.data.realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Browser client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: true,
      },
      realmId: realm.data.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const app = oidcServerAppCreate({
      database,
      publicOrigin: "https://browser-oidc.example.com",
      systemSecret: "browser-oidc-secret",
    })
    const request = new URLSearchParams({
      client_id: client.data.client.id,
      code_challenge: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
      code_challenge_method: "S256",
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope: "openid",
      state: "browser-state",
    })
    const started = await app.request(`https://browser-oidc.example.com/oauth2/authorize?${request}`, {
      headers: { accept: "text/html" },
    })
    expect(started.status).toBe(302)
    const startLocation = started.headers.get("location")
    expect(startLocation).toStartWith("/login?")
    expect(startLocation).not.toContain("client_id")
    expect(startLocation).not.toContain("browser-state")
    const interaction =
      new URL(`https://browser-oidc.example.com${startLocation}`).searchParams.get("interaction") ?? ""
    const interactionCookie = cookieGet(started.headers.get("set-cookie"), "oidc-interaction")
    expect(interaction).toHaveLength(43)
    expect(interactionCookie).toHaveLength(43)

    const tampered = `${interaction.slice(0, -1)}${interaction.endsWith("A") ? "B" : "A"}`
    const tamperedResponse = await app.request(
      `https://browser-oidc.example.com/oauth2/authorize?interaction=${tampered}`,
      {
        headers: {
          accept: "text/html",
          cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}`,
        },
      },
    )
    expect(tamperedResponse.status).toBe(400)

    const unsafeReturn = await app.request(
      `https://browser-oidc.example.com/oauth2/authorize?interaction=${interaction}&return_to=${encodeURIComponent("https://evil.example/resume")}`,
      {
        headers: {
          accept: "text/html",
          cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}`,
        },
      },
    )
    expect(unsafeReturn.status).toBe(400)

    const resumed = await app.request(`https://browser-oidc.example.com/oauth2/authorize?interaction=${interaction}`, {
      headers: {
        accept: "text/html",
        cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}`,
      },
    })
    expect(resumed.status).toBe(302)
    const consentLocation = resumed.headers.get("location")
    expect(consentLocation).toStartWith("/consent?")
    expect(consentLocation).not.toContain("browser-state")

    const csrf = sessionCsrfTokenCreate(database.runtime)
    const missingCsrf = await app.request("https://browser-oidc.example.com/oauth2/consent", {
      body: new URLSearchParams({ decision: "approve", interaction }).toString(),
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}`,
        origin: "https://browser-oidc.example.com",
      },
      method: "POST",
    })
    expect(missingCsrf.status).toBe(400)

    const wrongOrigin = await app.request("https://browser-oidc.example.com/oauth2/consent", {
      body: new URLSearchParams({ decision: "approve", interaction }).toString(),
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}; csrf=${csrf}`,
        origin: "https://evil.example.com",
        "x-csrf-token": csrf,
      },
      method: "POST",
    })
    expect(wrongOrigin.status).toBe(400)
    const consent = await app.request("https://browser-oidc.example.com/oauth2/consent", {
      body: new URLSearchParams({ decision: "approve", interaction }).toString(),
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}; csrf=${csrf}`,
        origin: "https://browser-oidc.example.com",
        "x-csrf-token": csrf,
      },
      method: "POST",
    })
    expect(consent.status).toBe(302)
    expect(consent.headers.get("location")).toStartWith("https://client.example/callback?")
    expect(consent.headers.get("set-cookie")).toContain("oidc-interaction=")

    const replay = await app.request("https://browser-oidc.example.com/oauth2/consent", {
      body: new URLSearchParams({ decision: "approve", interaction }).toString(),
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}; csrf=${csrf}`,
        origin: "https://browser-oidc.example.com",
        "x-csrf-token": csrf,
      },
      method: "POST",
    })
    expect(replay.status).toBe(400)

    const directRequest = new URLSearchParams(request)
    directRequest.set("state", "direct-state")
    const direct = await app.request(`https://browser-oidc.example.com/oauth2/authorize?${directRequest}`, {
      headers: { accept: "application/json", cookie: `session=${login.data.session.token}` },
    })
    expect(direct.status).toBe(200)
    expect(((await direct.json()) as { code?: string }).code).toBeString()

    const logout = await app.request(
      `https://browser-oidc.example.com/oauth2/logout?client_id=${encodeURIComponent(client.data.client.id)}`,
      {
        headers: {
          accept: "application/json",
          cookie: `session=${login.data.session.token}`,
        },
      },
    )
    expect(logout.status).toBe(200)
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0")
    expect(
      sessionAuthenticate({ database, realmId: realm.data.realm.id, token: login.data.session.token }).success,
    ).toBe(false)
  })
})

test("OIDC interaction resume preserves nonce through consent, code redemption, and signed ID token verification", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "nonce-interaction.example.com", name: "Nonce interaction OIDC" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
    let verificationToken = ""
    const registered = passwordRegister({
      context,
      database,
      input: {
        email: "nonce@example.com",
        password: "Correct Horse 12",
        profile: {},
        userName: "nonce-user",
      },
      realmId: realm.data.realm.id,
      onVerificationToken: ({ token }) => {
        verificationToken = token
      },
    })
    expect(registered.success).toBe(true)
    expect(
      passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId: realm.data.realm.id })
        .success,
    ).toBe(true)
    const login = passwordLogin({
      context,
      database,
      input: { identifier: "nonce-user", password: "Correct Horse 12" },
      realmId: realm.data.realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(login.success).toBe(true)
    if (!login.success || login.data.session === undefined) return
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        allowedScopes: ["openid", "profile", "email"],
        clientType: "confidential",
        name: "Nonce interaction client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: true,
      },
      realmId: realm.data.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success || client.data.clientSecret === undefined) return
    const key = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: "nonce-interaction-secret",
      realmId: realm.data.realm.id,
    })
    expect(key.success).toBe(true)
    if (!key.success) return

    const verifier = "verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const nonce = "nonce-preserved-through-interaction-resume"
    const state = "nonce-interaction-state"
    const started = await appRequestAuthorization(database, {
      client_id: client.data.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256",
      nonce,
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope: "openid profile email",
      state,
    })
    expect(started.status).toBe(302)
    const startLocation = started.headers.get("location")
    expect(startLocation).toStartWith("/login?")
    if (startLocation === null) return
    const interaction = new URL(`https://nonce-interaction.example.com${startLocation}`).searchParams.get("interaction")
    expect(interaction).toBeString()
    if (interaction === null) return
    const interactionCookie = cookieGet(started.headers.get("set-cookie"), "oidc-interaction")
    expect(interactionCookie).toHaveLength(43)

    const app = oidcServerAppCreate({
      database,
      publicOrigin: "https://nonce-interaction.example.com",
      systemSecret: "nonce-interaction-secret",
    })
    const resumed = await app.request(
      `https://nonce-interaction.example.com/oauth2/authorize?interaction=${interaction}`,
      {
        headers: {
          accept: "text/html",
          cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}`,
        },
      },
    )
    expect(resumed.status).toBe(302)
    const consentLocation = resumed.headers.get("location")
    expect(consentLocation).toStartWith("/consent?")

    const csrf = sessionCsrfTokenCreate(database.runtime)
    const consent = await app.request("https://nonce-interaction.example.com/oauth2/consent", {
      body: new URLSearchParams({ decision: "approve", interaction }).toString(),
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        cookie: `oidc-interaction=${interactionCookie}; session=${login.data.session.token}; csrf=${csrf}`,
        origin: "https://nonce-interaction.example.com",
        "x-csrf-token": csrf,
      },
      method: "POST",
    })
    expect(consent.status).toBe(302)
    const callbackLocation = consent.headers.get("location")
    expect(callbackLocation).toStartWith("https://client.example/callback?")
    if (callbackLocation === null) return
    const callback = new URL(callbackLocation)
    expect(callback.searchParams.get("state")).toBe(state)
    const code = callback.searchParams.get("code")
    expect(code).toBeString()
    if (code === null) return

    const tokenResponse = await app.request("https://nonce-interaction.example.com/oauth2/token", {
      body: new URLSearchParams({
        client_id: client.data.client.id,
        client_secret: client.data.clientSecret,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: "https://client.example/callback",
      }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    })
    expect(tokenResponse.status).toBe(200)
    const token = v.parse(oidcTokenResponseSchema, await tokenResponse.json())
    expect(token.id_token).toBeString()
    const idToken = oidcJwtVerify(token.id_token, key.data.signingKey.publicJwk)
    expect(idToken).toMatchObject({
      data: {
        aud: client.data.client.id,
        iss: "https://nonce-interaction.example.com",
        nonce,
        sub: login.data.authentication.userId,
      },
      success: true,
    })
  })
})

async function appRequestAuthorization(database: StorageDatabase, input: Record<string, string>): Promise<Response> {
  const app = oidcServerAppCreate({
    database,
    publicOrigin: "https://nonce-interaction.example.com",
    systemSecret: "nonce-interaction-secret",
  })
  return app.request(`https://nonce-interaction.example.com/oauth2/authorize?${new URLSearchParams(input)}`, {
    headers: { accept: "text/html" },
  })
}

test("OIDC interactions reject expiry and cross-realm resolution", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "expired-oidc.example.com", name: "Expired OIDC" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const otherRealm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "other-oidc.example.com", name: "Other OIDC" },
    })
    expect(otherRealm.success).toBe(true)
    if (!otherRealm.success) return
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Expiry client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: true,
      },
      realmId: realm.data.realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const interaction = oidcAuthorizationInteractionCreate({
      database,
      encryptionSecret: "expiry-secret",
      input: {
        client_id: client.data.client.id,
        code_challenge: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        code_challenge_method: "S256",
        redirect_uri: "https://client.example/callback",
        response_type: "code",
        scope: "openid",
        state: "expiry-state",
      },
      publicOrigin: "https://expired-oidc.example.com",
      realmId: realm.data.realm.id,
      runtime: runtimeCreate({ now: () => 1_000 }),
    })
    expect(interaction.success).toBe(true)
    if (!interaction.success) return
    const expired = oidcAuthorizationInteractionResolve({
      binding: interaction.data.binding,
      database,
      encryptionSecret: "expiry-secret",
      handle: interaction.data.handle,
      publicOrigin: "https://expired-oidc.example.com",
      realmId: realm.data.realm.id,
    })
    expect(expired.success).toBe(false)
    const crossRealm = oidcAuthorizationInteractionResolve({
      binding: interaction.data.binding,
      database,
      encryptionSecret: "expiry-secret",
      handle: interaction.data.handle,
      publicOrigin: "https://other-oidc.example.com",
      realmId: otherRealm.data.realm.id,
    })
    expect(crossRealm.success).toBe(false)
  })
})
