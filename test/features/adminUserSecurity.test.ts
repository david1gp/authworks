import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { adminApiCreate } from "../../src/features/admin/ui/adminApiCreate.js"
import { authorizationBootstrapAdminActorContextCreate } from "../../src/features/authorization/domain/authorizationBootstrapAdminActorContextCreate.js"
import { passkeyRepositoryCreate } from "../../src/features/passkeys/persistence/passkeyRepositoryCreate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionAdministratorList } from "../../src/features/sessions/actions/sessionAdministratorList.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import { userAuthenticationMethodsAdministratorGet } from "../../src/features/users/actions/userAuthenticationMethodsAdministratorGet.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-admin-user-security-"))
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
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function sessionTokenGet(response: Response): string {
  const token = /^session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1]
  if (token === undefined) throw new Error("The session cookie was not issued.")
  return token
}

test("administrator session and authentication metadata actions keep actor, target, and realm separate", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "admin-user-security.example.com")
    const otherRealm = await createRealm(database, "admin-user-security-other.example.com")
    const bootstrap = realmBootstrapAdminCreate({
      context: realmSystemContextCreate("system"),
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return

    const created = userCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { email: "target@example.com", profile: { displayName: "Target" }, userName: "target" },
      realmId: realm.id,
      runtime: testkit.runtime,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(
      userLifecycleSet({
        context: realmSystemContextCreate("system"),
        database,
        input: { state: "active" },
        realmId: realm.id,
        userId: created.data.user.id,
        runtime: testkit.runtime,
      }).success,
    ).toBe(true)
    const targetSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(targetSession.success).toBe(true)
    if (!targetSession.success) return

    const passkey = passkeyRepositoryCreate(database.db).passkeyCredentialCreate({
      aaguid: "aaguid",
      backedUp: 0,
      counter: 0,
      createdAt: testkit.runtime.now(),
      credentialId: "web-authn-secret",
      deviceType: "singleDevice",
      id: "passkey-row",
      lastUsedAt: null,
      publicKey: Buffer.from("private-credential-material"),
      realmId: realm.id,
      revokedAt: null,
      rpId: realm.domain,
      transports: '["internal"]',
      userId: created.data.user.id,
      version: 1,
    })
    expect(passkey.success).toBe(true)

    const actor = authorizationBootstrapAdminActorContextCreate(realm.id, bootstrap.data.bootstrapAdmin.adminId)
    const sessions = sessionAdministratorList({
      actor,
      database,
      query: { pageSize: 1 },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(sessions).toMatchObject({
      success: true,
      data: { items: [{ id: targetSession.data.session.id, current: false }] },
    })
    const methods = userAuthenticationMethodsAdministratorGet({
      actor,
      database,
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(methods).toMatchObject({ success: true, data: { passkeys: { credentials: [{ id: "passkey-row" }] } } })
    expect(JSON.stringify(methods)).not.toContain("web-authn-secret")
    expect(JSON.stringify(methods)).not.toContain("private-credential-material")

    const app = new Hono()
    app.route("/", sessionServerAppCreate({ database, publicOrigin: "https://admin-user-security.example.com" }))
    app.route("/", userServerAppCreate({ database, publicOrigin: "https://admin-user-security.example.com" }))
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
    const adminToken = sessionTokenGet(signedIn)
    const sessionsClient = sessionApiClientCreate({
      baseUrl: `https://${realm.domain}`,
      fetch: async (input, init) => app.request(input.toString(), init),
      token: adminToken,
    })
    const usersClient = userApiClientCreate({
      baseUrl: `https://${realm.domain}`,
      fetch: async (input, init) => app.request(input.toString(), init),
      token: adminToken,
    })
    const listed = await sessionsClient.sessionUserList(realm.id, created.data.user.id, { pageSize: 1 })
    expect(listed).toMatchObject({ success: true, data: { items: [{ subjectId: created.data.user.id }] } })
    const authenticationMethods = await usersClient.userTenantAuthenticationMethodsGet(realm.id, created.data.user.id)
    expect(authenticationMethods.success).toBe(true)
    expect(JSON.stringify(authenticationMethods)).not.toContain("web-authn-secret")

    const crossRealm = await sessionsClient.sessionUserList(otherRealm.id, created.data.user.id)
    expect(crossRealm.success).toBe(false)

    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const cookie = `session=${adminToken}`
    const missingOrigin = await app.request(
      `https://${realm.domain}/realms/${realm.id}/users/${created.data.user.id}/sessions/${targetSession.data.session.id}`,
      { headers: { cookie }, method: "DELETE" },
    )
    expect(missingOrigin.status).toBe(403)
    const revoked = await app.request(
      `https://${realm.domain}/realms/${realm.id}/users/${created.data.user.id}/sessions/${targetSession.data.session.id}`,
      {
        headers: {
          cookie: `${cookie}; csrf=${csrf}`,
          host: realm.domain,
          origin: `https://${realm.domain}`,
          "x-csrf-token": csrf,
        },
        method: "DELETE",
      },
    )
    expect(revoked.status).toBe(200)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: targetSession.data.token }).success).toBe(false)
    const event = database.sqlite
      .query(
        "SELECT actor_id FROM events WHERE aggregate_type = 'session' AND aggregate_id = ? ORDER BY aggregate_version DESC",
      )
      .get(targetSession.data.session.id) as { actor_id: string } | null
    expect(event?.actor_id).toBe(bootstrap.data.bootstrapAdmin.adminId)
  })
})

test("admin browser adapter exposes target reads and fetches CSRF before target revocation", async () => {
  const requests: { init?: RequestInit; url: string }[] = []
  const api = adminApiCreate({
    baseUrl: "https://admin.example.com",
    fetch: async (input, init) => {
      const url = String(input)
      requests.push({ init, url })
      if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-fixture" })
      if (url.endsWith("/authentication-methods"))
        return Response.json({
          emailOtp: { available: false },
          passkeys: { credentials: [] },
          password: { available: false },
          recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
          totp: { enrolled: false, enrollments: [] },
        })
      if (init?.method === "DELETE") return Response.json({ revoked: true })
      return Response.json({ items: [] })
    },
  })
  const methods = await api.userAuthenticationMethodsGet("realm-1", "user-2")
  const sessions = await api.userSessionsList("realm-1", "user-2", { pageSize: 5 })
  const revoked = await api.userSessionRevoke("realm-1", "user-2", "session-3")
  expect(methods.success).toBe(true)
  expect(sessions.success).toBe(true)
  expect(revoked).toEqual({ data: { revoked: true }, success: true })
  expect(requests.map(({ url }) => url)).toEqual([
    "https://admin.example.com/realms/realm-1/users/user-2/authentication-methods",
    "https://admin.example.com/realms/realm-1/users/user-2/sessions?pageSize=5",
    "https://admin.example.com/realms/realm-1/sessions/csrf",
    "https://admin.example.com/realms/realm-1/users/user-2/sessions/session-3",
  ])
  expect(new Headers(requests[3]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
  expect(requests[3]?.init?.credentials).toBe("include")
})
