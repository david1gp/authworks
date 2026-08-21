import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmServerAppCreate } from "../../src/features/realms/server/realmServerAppCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionProtectedMiddlewareCreate } from "../../src/features/sessions/server/sessionProtectedMiddlewareCreate.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-bootstrap-admin-session-"))
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

function sessionTokenGet(cookie: string | null): string | undefined {
  return cookie === null ? undefined : /^session=([^;]+);/.exec(cookie)?.[1]
}

test("bootstrap administrator exchange issues a short browser session without a user row", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "bootstrap-admin.example.com", name: "Bootstrap Admin" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const bootstrap = realmBootstrapAdminCreate({
      context: realmSystemContextCreate("system"),
      database,
      realmId: realm.data.realm.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const secret = bootstrap.data.bootstrapAdmin.secret.valueGet()
    const app = new Hono()
    app.route("/", sessionServerAppCreate({ database, publicOrigin: "https://bootstrap-admin.example.com" }))
    app.route("/", userServerAppCreate({ database, publicOrigin: "https://bootstrap-admin.example.com" }))

    const invalid = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/admin/sign-in`,
      {
        body: JSON.stringify({ secret: `${secret.slice(0, -1)}x` }),
        headers: {
          "content-type": "application/json",
          host: "bootstrap-admin.example.com",
          origin: "https://bootstrap-admin.example.com",
        },
        method: "POST",
      },
    )
    expect(invalid.status).toBe(401)
    expect(invalid.headers.get("set-cookie")).toBeNull()
    const hostileOrigin = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/admin/sign-in`,
      {
        body: JSON.stringify({ secret }),
        headers: {
          "content-type": "application/json",
          host: "bootstrap-admin.example.com",
          origin: "https://evil.example.com",
        },
        method: "POST",
      },
    )
    expect(hostileOrigin.status).toBe(403)
    expect(hostileOrigin.headers.get("set-cookie")).toBeNull()

    const signedIn = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/admin/sign-in`,
      {
        body: JSON.stringify({ secret }),
        headers: {
          "content-type": "application/json",
          host: "bootstrap-admin.example.com",
          origin: "https://bootstrap-admin.example.com",
          "user-agent": "admin-browser",
          "x-device-fingerprint": "admin-device",
        },
        method: "POST",
      },
    )
    expect(signedIn.status).toBe(200)
    const signedInBody = (await signedIn.json()) as {
      adminId?: string
      expiresAt?: number
      realmId?: string
      sessionId?: string
    }
    const signInCookie = signedIn.headers.get("set-cookie")
    const firstToken = sessionTokenGet(signInCookie)
    expect(signedInBody).toMatchObject({
      adminId: bootstrap.data.bootstrapAdmin.adminId,
      realmId: realm.data.realm.id,
    })
    expect(signedInBody.sessionId).toBeString()
    expect(signedInBody.expiresAt).toBe(testkit.runtime.now() + 15 * 60 * 1_000)
    expect(signInCookie).toContain("Path=/")
    expect(signInCookie).toContain("HttpOnly")
    expect(signInCookie).toContain("Secure")
    expect(signInCookie).toContain("SameSite=Lax")
    expect(firstToken).toHaveLength(43)
    expect(JSON.stringify(signedInBody)).not.toContain(secret)
    expect(JSON.stringify(signedInBody)).not.toContain(firstToken ?? "")
    if (signedInBody.sessionId === undefined) return

    const stored = database.sqlite
      .query("SELECT subject_id, subject_type, user_id FROM sessions WHERE id = ?")
      .get(signedInBody.sessionId) as { subject_id: string; subject_type: string; user_id: string | null } | null
    expect(stored).toEqual({
      subject_id: bootstrap.data.bootstrapAdmin.adminId,
      subject_type: "bootstrap_admin",
      user_id: null,
    })
    expect(
      database.sqlite.query("SELECT id FROM users WHERE id = ?").get(bootstrap.data.bootstrapAdmin.adminId),
    ).toBeNull()
    if (firstToken === undefined) return
    const authenticated = sessionAuthenticate({ database, realmId: realm.data.realm.id, token: firstToken })
    expect(authenticated).toMatchObject({
      data: {
        actor: {
          actorId: bootstrap.data.bootstrapAdmin.adminId,
          authenticationMethod: "bootstrap_admin",
          kind: "bootstrap_admin",
        },
      },
      success: true,
    })

    const protectedResponse = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/protected`,
      { headers: { cookie: `session=${firstToken}`, host: "bootstrap-admin.example.com" } },
    )
    expect(protectedResponse.status).toBe(200)
    expect((await protectedResponse.json()) as { actor: { kind: string } }).toMatchObject({
      actor: { kind: "bootstrap_admin" },
    })
    const permissionApp = new Hono()
    permissionApp.get(
      "/realms/:realmId/permission",
      sessionProtectedMiddlewareCreate({ database, permission: "realm.read" }),
      (context) => context.json({ allowed: true }),
    )
    const permissionResponse = await permissionApp.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/permission`,
      { headers: { authorization: `Bearer ${firstToken}`, host: "bootstrap-admin.example.com" } },
    )
    expect(permissionResponse.status).toBe(200)

    const meResponse = await app.request(`https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/me`, {
      headers: { cookie: `session=${firstToken}`, host: "bootstrap-admin.example.com" },
    })
    expect(meResponse.status).toBe(403)
    const meSessionsResponse = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/me/sessions`,
      { headers: { cookie: `session=${firstToken}`, host: "bootstrap-admin.example.com" } },
    )
    expect(meSessionsResponse.status).toBe(403)

    const csrfResponse = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/sessions/csrf`,
      { headers: { cookie: `session=${firstToken}`, host: "bootstrap-admin.example.com" } },
    )
    expect(csrfResponse.status).toBe(200)
    const csrf = ((await csrfResponse.json()) as { csrfToken: string }).csrfToken
    const browserHeaders = {
      cookie: `session=${firstToken}; csrf=${csrf}`,
      host: "bootstrap-admin.example.com",
      origin: "https://bootstrap-admin.example.com",
      "x-csrf-token": csrf,
    }
    const rotated = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/sessions/rotate`,
      { headers: browserHeaders, method: "POST" },
    )
    expect(rotated.status).toBe(200)
    const rotatedBody = await rotated.json()
    const rotatedToken = sessionTokenGet(rotated.headers.get("set-cookie"))
    expect(rotatedToken).toHaveLength(43)
    expect(JSON.stringify(rotatedBody)).not.toContain(firstToken)
    expect(JSON.stringify(rotatedBody)).not.toContain(secret)
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: firstToken }).success).toBe(false)
    if (rotatedToken === undefined) return
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: rotatedToken }).success).toBe(true)

    const revoked = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/sessions/${signedInBody.sessionId}`,
      {
        headers: { ...browserHeaders, cookie: `session=${rotatedToken}; csrf=${csrf}` },
        method: "DELETE",
      },
    )
    expect(revoked.status).toBe(200)
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: rotatedToken }).success).toBe(false)

    const secondSignIn = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/admin/sign-in`,
      {
        body: JSON.stringify({ secret }),
        headers: {
          "content-type": "application/json",
          host: "bootstrap-admin.example.com",
          origin: "https://bootstrap-admin.example.com",
        },
        method: "POST",
      },
    )
    const secondToken = sessionTokenGet(secondSignIn.headers.get("set-cookie"))
    expect(secondToken).toHaveLength(43)
    if (secondToken === undefined) return
    const logout = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/sessions/logout`,
      {
        headers: {
          cookie: `session=${secondToken}; csrf=${csrf}`,
          host: "bootstrap-admin.example.com",
          origin: "https://bootstrap-admin.example.com",
          "x-csrf-token": csrf,
        },
        method: "POST",
      },
    )
    expect(logout.status).toBe(200)
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0")
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: secondToken }).success).toBe(false)

    const expiring = await app.request(
      `https://bootstrap-admin.example.com/realms/${realm.data.realm.id}/admin/sign-in`,
      {
        body: JSON.stringify({ secret }),
        headers: {
          "content-type": "application/json",
          host: "bootstrap-admin.example.com",
          origin: "https://bootstrap-admin.example.com",
        },
        method: "POST",
      },
    )
    const expiringToken = sessionTokenGet(expiring.headers.get("set-cookie"))
    expect(expiringToken).toHaveLength(43)
    if (expiringToken === undefined) return
    testkit.advance(15 * 60 * 1_000 + 1)
    expect(sessionAuthenticate({ database, realmId: realm.data.realm.id, token: expiringToken }).success).toBe(false)

    const systemApp = realmServerAppCreate({ database, systemSecret: "system-secret" })
    const systemOnly = await systemApp.request(
      `https://bootstrap-admin.example.com/system/realms/${realm.data.realm.id}/bootstrap-admin`,
      { method: "POST" },
    )
    expect(systemOnly.status).toBe(401)
  })
})
