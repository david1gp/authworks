import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { oidcDiscoveryGet } from "../../src/features/oidc/actions/oidcDiscoveryGet.js"
import { oidcSigningKeyCreate } from "../../src/features/oidc/actions/oidcSigningKeyCreate.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { oidcSecretHashCreate } from "../../src/features/oidc/domain/oidcSecretHashCreate.js"
import { oidcClientTable } from "../../src/features/oidc/persistence/oidcClientTable.js"
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

const systemSecret = "oidc-client-secret-rotation-test-system-secret"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-secret-rotation-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({ context: realmSystemContextCreate(), database, input: { domain, name: domain } })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

async function createAuthenticatedSession(database: StorageDatabase, realmId: string, domain: string) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let verificationToken = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "oidc-rotation-user@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "OIDC rotation user" },
      userName: "oidc-rotation-user",
    },
    onVerificationToken: (delivery) => {
      verificationToken = delivery.token
    },
    realmId,
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token: verificationToken }, realmId })
  expect(verified.success).toBe(true)
  const login = passwordLogin({
    context,
    database,
    input: { identifier: "oidc-rotation-user", password: "Correct Horse 12" },
    realmId,
    sessionCreate: sessionPasswordCreate(),
  })
  expect(login.success).toBe(true)
  if (!login.success || login.data.session === undefined) throw new Error(`The session for ${domain} was not created.`)
  return login.data.session.token
}

function pkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url")
}

function oauthClientPasswordEncode(value: string): string {
  const encoded = encodeURIComponent(value)
  const first = value.charCodeAt(0).toString(16).padStart(2, "0")
  return `%${first}${encoded.slice(1)}`
}

function clientSecretBasicCreate(clientId: string, clientSecret: string): string {
  const credentials = `${oauthClientPasswordEncode(clientId)}:${oauthClientPasswordEncode(clientSecret)}`
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`
}

async function tokenRequest(
  app: ReturnType<typeof oidcServerAppCreate>,
  domain: string,
  authorization: string,
  input: Record<string, string>,
) {
  return app.request(`https://${domain}/oauth2/token`, {
    body: new URLSearchParams(input),
    headers: {
      authorization,
      "content-type": "application/x-www-form-urlencoded",
      host: domain,
    },
    method: "POST",
  })
}

test("rotated confidential clients complete authorization-code PKCE with client_secret_basic", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "oidc-rotation.example.com")
    const sessionToken = await createAuthenticatedSession(database, realm.id, realm.domain)
    const app = oidcServerAppCreate({ database, systemSecret })
    const clientResponse = await app.request(`https://system.example/system/realms/${realm.id}/oidc/clients`, {
      body: JSON.stringify({
        allowedScopes: ["openid", "profile", "email"],
        clientType: "confidential",
        name: "Rotation integration client",
        redirectUris: ["https://client.example/callback"],
        requireConsent: false,
        trusted: true,
      }),
      headers: { authorization: `Bearer ${systemSecret}`, "content-type": "application/json" },
      method: "POST",
    })
    expect(clientResponse.status).toBe(201)
    const created = (await clientResponse.json()) as { client: { id: string }; clientSecret?: string }
    expect(created.clientSecret).toBeString()
    if (created.clientSecret === undefined) return
    const oldSecret = created.clientSecret
    const beforeRotation = database.db
      .select({ secretHash: oidcClientTable.secretHash })
      .from(oidcClientTable)
      .where(eq(oidcClientTable.id, created.client.id))
      .get()
    expect(beforeRotation?.secretHash).toBe(oidcSecretHashCreate(oldSecret))
    expect(beforeRotation?.secretHash).not.toBe(oldSecret)

    const rotatedResponse = await app.request(
      `https://system.example/system/realms/${realm.id}/oidc/clients/${created.client.id}/secret/rotate`,
      { headers: { authorization: `Bearer ${systemSecret}` }, method: "POST" },
    )
    expect(rotatedResponse.status).toBe(200)
    const rotated = (await rotatedResponse.json()) as { clientSecret?: string }
    expect(rotated.clientSecret).toBeString()
    if (rotated.clientSecret === undefined) return
    const newSecret = rotated.clientSecret
    expect(newSecret).not.toBe(oldSecret)
    const afterRotation = database.db
      .select({ secretHash: oidcClientTable.secretHash })
      .from(oidcClientTable)
      .where(eq(oidcClientTable.id, created.client.id))
      .get()
    expect(afterRotation?.secretHash).toBe(oidcSecretHashCreate(newSecret))
    expect(afterRotation?.secretHash).not.toBe(oldSecret)
    expect(afterRotation?.secretHash).not.toBe(newSecret)
    const signingKey = oidcSigningKeyCreate({
      context: realmSystemContextCreate(),
      database,
      encryptionSecret: systemSecret,
      realmId: realm.id,
    })
    expect(signingKey.success).toBe(true)

    const discovery = oidcDiscoveryGet({ database, realmId: realm.id })
    expect(discovery.success).toBe(true)
    expect(discovery.success && discovery.data.token_endpoint_auth_methods_supported).toContain("client_secret_basic")
    const verifier = "rotation-verifier-abcdefghijklmnopqrstuvwxyz-0123456789._~"
    const authorizationUrl = new URL(`https://${realm.domain}/oauth2/authorize`)
    authorizationUrl.search = new URLSearchParams({
      client_id: created.client.id,
      code_challenge: pkceChallengeCreate(verifier),
      code_challenge_method: "S256",
      redirect_uri: "https://client.example/callback",
      response_type: "code",
      scope: "openid profile email",
      state: "rotation-state",
    }).toString()
    const authorizationResponse = await app.request(authorizationUrl.toString(), {
      headers: { accept: "application/json", authorization: `Bearer ${sessionToken}`, host: realm.domain },
    })
    expect(authorizationResponse.status).toBe(200)
    const authorization = (await authorizationResponse.json()) as { code: string; redirect_uri: string }

    const tokenInput = {
      code: authorization.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: authorization.redirect_uri,
    }
    const malformed = await tokenRequest(
      app,
      realm.domain,
      `Basic ${Buffer.from(`${oauthClientPasswordEncode(created.client.id)}:%ZZ`, "utf8").toString("base64")}`,
      tokenInput,
    )
    expect(malformed.status).toBe(401)
    expect(await malformed.json()).toMatchObject({ error: "invalid_client" })
    const oldCredentials = await tokenRequest(
      app,
      realm.domain,
      clientSecretBasicCreate(created.client.id, oldSecret),
      tokenInput,
    )
    expect(oldCredentials.status).toBe(401)
    expect(await oldCredentials.json()).toMatchObject({ error: "invalid_client" })
    const issued = await tokenRequest(
      app,
      realm.domain,
      clientSecretBasicCreate(created.client.id, newSecret),
      tokenInput,
    )
    expect(issued.status).toBe(200)
    expect(await issued.json()).toMatchObject({ token_type: "Bearer", scope: "openid profile email" })
  })
})
