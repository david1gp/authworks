import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { oidcClientCreate } from "../../src/features/oidc/actions/oidcClientCreate.js"
import { oidcApiClientCreate } from "../../src/features/oidc/client/oidcApiClientCreate.js"
import { oidcRepositoryCreate } from "../../src/features/oidc/persistence/oidcRepositoryCreate.js"
import { oidcServerAppCreate } from "../../src/features/oidc/server/oidcServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-oidc-admin-browser-"))
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

async function createUser(database: StorageDatabase, realmId: string, userName: string) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${userName}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: userName },
      userName,
    },
    onVerificationToken: (delivery) => {
      token = delivery.token
    },
    realmId,
  })
  expect(registered.success).toBe(true)
  const verified = passwordEmailVerify({ context, database, input: { token }, realmId })
  expect(verified.success).toBe(true)
  if (!verified.success) throw new Error(verified.errorMessage)
  return verified.data.user.id
}

function sessionCookieGet(response: Response): string {
  const cookie = response.headers.get("set-cookie") ?? ""
  const token = /^session=([^;]+)/.exec(cookie)?.[1]
  if (token === undefined) throw new Error("The browser session cookie was not issued.")
  return token
}

async function csrfGet(app: Hono, domain: string, realmId: string, session: string): Promise<string> {
  const response = await app.request(`https://${domain}/realms/${realmId}/sessions/csrf`, {
    headers: { cookie: `session=${session}`, host: domain },
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { csrfToken: string }).csrfToken
}

function browserHeaders(session: string, csrf?: string, domain = "oidc-admin.example.com"): HeadersInit {
  return {
    ...(csrf === undefined ? {} : { "x-csrf-token": csrf }),
    cookie: `session=${session}${csrf === undefined ? "" : `; csrf=${csrf}`}`,
    host: domain,
    origin: `https://${domain}`,
  }
}

test("OIDC realm administration uses browser sessions, exact settings, pagination, and one-time secrets", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "oidc-admin.example.com")
    const otherRealm = await createRealm(database, "oidc-admin-other.example.com")
    const bootstrap = realmBootstrapAdminCreate({ context: realmSystemContextCreate(), database, realmId: realm.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return

    const app = new Hono()
    app.route("/", sessionServerAppCreate({ database, publicOrigin: "https://oidc-admin.example.com" }))
    app.route("/", oidcServerAppCreate({ database, publicOrigin: "https://oidc-admin.example.com" }))
    const signedIn = await app.request(`https://${realm.domain}/realms/${realm.id}/admin/sign-in`, {
      body: JSON.stringify({ secret: bootstrap.data.bootstrapAdmin.secret.valueGet() }),
      headers: {
        "content-type": "application/json",
        host: realm.domain,
        origin: `https://${realm.domain}`,
      },
      method: "POST",
    })
    expect(signedIn.status).toBe(200)
    const session = sessionCookieGet(signedIn)
    const csrf = await csrfGet(app, realm.domain, realm.id, session)
    const headers = browserHeaders(session, csrf)

    const missingCsrfHeaders = new Headers(headers)
    missingCsrfHeaders.delete("x-csrf-token")
    const missingCsrf = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/clients`, {
      body: JSON.stringify({
        clientType: "public",
        name: "Missing CSRF",
        redirectUris: ["https://client.example/callback"],
      }),
      headers: missingCsrfHeaders,
      method: "POST",
    })
    expect(missingCsrf.status).toBe(403)

    const created = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/clients`, {
      body: JSON.stringify({
        allowedScopes: ["openid", "profile"],
        clientType: "confidential",
        name: "Browser client",
        postLogoutRedirectUris: ["https://client.example/logout"],
        redirectUris: ["https://client.example/callback"],
        requireConsent: false,
        trusted: true,
      }),
      headers,
      method: "POST",
    })
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as { client: { id: string }; clientSecret?: string }
    expect(createdBody.client).toMatchObject({
      allowedScopes: ["openid", "profile"],
      postLogoutRedirectUris: ["https://client.example/logout"],
      redirectUris: ["https://client.example/callback"],
      requireConsent: false,
      trusted: true,
    })
    expect(createdBody.clientSecret).toHaveLength(43)
    if (createdBody.clientSecret === undefined) return

    const listed = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/clients?pageSize=1`, {
      headers: { cookie: `session=${session}`, host: realm.domain },
    })
    expect(listed.status).toBe(200)
    expect(await listed.text()).not.toContain(createdBody.clientSecret)

    const detail = await app.request(
      `https://${realm.domain}/realms/${realm.id}/oidc/clients/${createdBody.client.id}`,
      { headers: { cookie: `session=${session}`, host: realm.domain } },
    )
    expect(detail.status).toBe(200)
    const detailBody = await detail.text()
    expect(detailBody).not.toContain(createdBody.clientSecret)
    expect(detailBody).not.toMatch(/secretHash|encryptedPrivateKey|privateKey/)

    const crossRealm = await app.request(`https://${otherRealm.domain}/realms/${otherRealm.id}/oidc/clients`, {
      headers: { cookie: `session=${session}`, host: otherRealm.domain },
    })
    expect(crossRealm.status).toBe(401)

    const rotatedByBootstrap = await app.request(
      `https://${realm.domain}/realms/${realm.id}/oidc/clients/${createdBody.client.id}/secret/rotate`,
      { headers, method: "POST" },
    )
    expect(rotatedByBootstrap.status).toBe(403)

    const adminUserId = await createUser(database, realm.id, "oidc-admin-user")
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "OIDC administrators", ownerUserId: adminUserId },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    const adminSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "password",
      database,
      mfaMethod: "totp",
      realmId: realm.id,
      subjectId: adminUserId,
      userId: adminUserId,
    })
    expect(adminSession.success).toBe(true)
    if (!adminSession.success) return
    const adminCsrf = await csrfGet(app, realm.domain, realm.id, adminSession.data.token)
    const adminHeaders = browserHeaders(adminSession.data.token, adminCsrf, realm.domain)
    const browserClient = oidcApiClientCreate({
      baseUrl: `https://${realm.domain}`,
      csrfToken: adminCsrf,
      fetch: async (input, init) => {
        const requestHeaders = new Headers(init?.headers)
        requestHeaders.set("cookie", `session=${adminSession.data.token}; csrf=${adminCsrf}`)
        requestHeaders.set("host", realm.domain)
        requestHeaders.set("origin", `https://${realm.domain}`)
        return app.request(input.toString(), { ...init, headers: requestHeaders })
      },
    })
    const clientFromBrowser = await browserClient.oidcClientTenantGet(realm.id, createdBody.client.id)
    expect(clientFromBrowser.success).toBe(true)
    const rotatedKey = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/signing-keys/rotate`, {
      headers: adminHeaders,
      method: "POST",
    })
    expect(rotatedKey.status).toBe(201)
    const rotatedKeyBody = (await rotatedKey.json()) as { signingKey: { id: string } }
    const retiredKey = await app.request(
      `https://${realm.domain}/realms/${realm.id}/oidc/signing-keys/${rotatedKeyBody.signingKey.id}/lifecycle`,
      {
        body: JSON.stringify({ status: "retired" }),
        headers: adminHeaders,
        method: "POST",
      },
    )
    expect(retiredKey.status).toBe(200)
    const rotated = await app.request(
      `https://${realm.domain}/realms/${realm.id}/oidc/clients/${createdBody.client.id}/secret/rotate`,
      { headers: adminHeaders, method: "POST" },
    )
    expect(rotated.status).toBe(200)
    const rotatedBody = (await rotated.json()) as { clientSecret?: string }
    expect(rotatedBody.clientSecret).toHaveLength(43)
    expect(rotatedBody.clientSecret).not.toBe(createdBody.clientSecret)

    const revoked = await app.request(
      `https://${realm.domain}/realms/${realm.id}/oidc/clients/${createdBody.client.id}/secret/revoke`,
      { headers: adminHeaders, method: "POST" },
    )
    expect(revoked.status).toBe(200)
    expect(await revoked.text()).not.toContain(rotatedBody.clientSecret ?? "")
    const events = JSON.stringify(database.sqlite.query("SELECT payload, metadata FROM events").all())
    expect(events).not.toContain(createdBody.clientSecret)
    expect(events).not.toContain(rotatedBody.clientSecret ?? "")
  })
})

test("OIDC administrator routes deny non-administrators and protect signing-key metadata and consent access", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "oidc-admin-denial.example.com")
    const bootstrap = realmBootstrapAdminCreate({ context: realmSystemContextCreate(), database, realmId: realm.id })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const deniedUserId = await createUser(database, realm.id, "oidc-denied-user")
    const deniedSession = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "password",
      database,
      mfaMethod: "totp",
      realmId: realm.id,
      subjectId: deniedUserId,
      userId: deniedUserId,
    })
    expect(deniedSession.success).toBe(true)
    if (!deniedSession.success) return

    const app = new Hono()
    app.route("/", sessionServerAppCreate({ database, publicOrigin: "https://oidc-admin-denial.example.com" }))
    app.route("/", oidcServerAppCreate({ database, publicOrigin: "https://oidc-admin-denial.example.com" }))
    const denied = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/clients`, {
      headers: { authorization: `Bearer ${deniedSession.data.token}`, host: realm.domain },
    })
    expect(denied.status).toBe(403)

    const adminSignIn = await app.request(`https://${realm.domain}/realms/${realm.id}/admin/sign-in`, {
      body: JSON.stringify({ secret: bootstrap.data.bootstrapAdmin.secret.valueGet() }),
      headers: {
        "content-type": "application/json",
        host: realm.domain,
        origin: `https://${realm.domain}`,
      },
      method: "POST",
    })
    expect(adminSignIn.status).toBe(200)
    const session = sessionCookieGet(adminSignIn)
    const csrf = await csrfGet(app, realm.domain, realm.id, session)
    const headers = browserHeaders(session, csrf, realm.domain)
    const client = oidcClientCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        clientType: "public",
        name: "Consent client",
        redirectUris: ["https://client.example/callback"],
      },
      realmId: realm.id,
    })
    expect(client.success).toBe(true)
    if (!client.success) return
    const consent = oidcRepositoryCreate(database.db).consentUpsert({
      clientId: client.data.client.id,
      createdAt: 1_700_000_000,
      realmId: realm.id,
      revokedAt: null,
      scope: JSON.stringify(["openid"]),
      updatedAt: 1_700_000_000,
      userId: deniedUserId,
    })
    expect(consent.success).toBe(true)
    const key = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/signing-keys`, {
      headers: { cookie: `session=${session}`, host: realm.domain },
    })
    expect(key.status).toBe(200)
    const keyBody = await key.text()
    expect(keyBody).not.toMatch(/encryptedPrivateKey|privateKey|secretHash/)

    const consentList = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/consents/${deniedUserId}`, {
      headers: { cookie: `session=${session}`, host: realm.domain },
    })
    expect(consentList.status).toBe(200)
    expect((await consentList.json()) as { items: unknown[] }).toMatchObject({
      items: [{ clientId: client.data.client.id }],
    })

    const revoked = await app.request(
      `https://${realm.domain}/realms/${realm.id}/oidc/consents/${deniedUserId}/${client.data.client.id}/revoke`,
      { headers, method: "POST" },
    )
    expect(revoked.status).toBe(200)
    expect(await revoked.json()).toEqual({ revoked: true })

    const hostileOrigin = await app.request(`https://${realm.domain}/realms/${realm.id}/oidc/signing-keys/rotate`, {
      headers: { ...headers, origin: "https://evil.example.com" },
      method: "POST",
    })
    expect(hostileOrigin.status).toBe(403)

    const internalKey = oidcRepositoryCreate(database.db).signingKeyList(realm.id)
    expect(internalKey.success).toBe(true)
    expect(internalKey.success && internalKey.data).toEqual([])
  })
})
