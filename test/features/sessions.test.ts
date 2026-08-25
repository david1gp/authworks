import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import * as v from "valibot"
import { authorizationPolicyEvaluate } from "../../src/features/authorization/actions/authorizationPolicyEvaluate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionList } from "../../src/features/sessions/actions/sessionList.js"
import { sessionPasswordCreate } from "../../src/features/sessions/actions/sessionPasswordCreate.js"
import { sessionRecentList } from "../../src/features/sessions/actions/sessionRecentList.js"
import { sessionRevoke } from "../../src/features/sessions/actions/sessionRevoke.js"
import { sessionRevokeAll } from "../../src/features/sessions/actions/sessionRevokeAll.js"
import { sessionRotate } from "../../src/features/sessions/actions/sessionRotate.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { sessionResponseSchema } from "../../src/features/sessions/public/sessionResponseSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../src/features/sessions/server/sessionProtectedMiddlewareCreate.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-sessions-"))
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

async function createVerifiedUser(database: StorageDatabase, domain: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let token = ""
  let userId = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: "session@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "Session User" },
      userName: "session-user",
    },
    realmId: realm.data.realm.id,
    onVerificationToken: (delivery) => {
      token = delivery.token
      userId = delivery.userId
    },
  })
  expect(registered.success).toBe(true)
  expect(passwordEmailVerify({ context, database, input: { token }, realmId: realm.data.realm.id }).success).toBe(true)
  return { context, realm: realm.data.realm, userId }
}

function issueTestSession(
  database: StorageDatabase,
  runtime: ReturnType<typeof platformTestkitCreate>["runtime"],
  realmId: string,
  userId: string,
) {
  const issued = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    realmId,
    runtime,
    userId,
  })
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data
}

test("password success issues an opaque session and rotation rejects replay", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedUser(database, "sessions.example.com")
    const loggedIn = passwordLogin({
      context,
      database,
      deviceMetadata: {
        description: "Laptop",
        fingerprint: "device-1",
        ipAddress: "192.0.2.1",
        userAgent: "test-agent",
      },
      input: { identifier: "session-user", password: "Correct Horse 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success || loggedIn.data.session === undefined) return
    const oldToken = loggedIn.data.session.token
    expect(oldToken).toHaveLength(43)
    expect(database.sqlite.query("SELECT token_hash FROM sessions").get()).not.toEqual({ token_hash: oldToken })
    expect(JSON.stringify(database.sqlite.query("SELECT payload, metadata FROM events").all())).not.toContain(oldToken)
    expect(loggedIn.data.session.session.device).toEqual({
      description: "Laptop",
      fingerprint: "device-1",
      ipAddress: "192.0.2.1",
      userAgent: "test-agent",
    })

    const authenticated = sessionAuthenticate({ database, realmId: realm.id, token: oldToken })
    expect(authenticated.success).toBe(true)
    testkit.advance(1)
    const rotated = sessionRotate({ database, realmId: realm.id, token: oldToken })
    expect(rotated.success).toBe(true)
    if (!rotated.success) return
    expect(sessionAuthenticate({ database, realmId: realm.id, token: oldToken }).success).toBe(false)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: rotated.data.token }).success).toBe(true)

    testkit.advance(1)
    const second = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      deviceMetadata: { description: "Phone" },
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const allSessions = sessionList({
      currentSessionId: second.data.session.id,
      database,
      realmId: realm.id,
      userId: loggedIn.data.authentication.userId,
    })
    expect(allSessions.success).toBe(true)
    if (!allSessions.success) return
    expect(allSessions.data.items).toHaveLength(2)
    expect(allSessions.data.items[0]).toMatchObject({ current: true, id: second.data.session.id })
    expect(allSessions.data.items[0]).not.toHaveProperty("loginIdentifier")
    const recentSessions = sessionRecentList({
      currentSessionId: second.data.session.id,
      database,
      realmId: realm.id,
      userId: loggedIn.data.authentication.userId,
    })
    expect(recentSessions.success).toBe(true)
    if (!recentSessions.success) return
    expect(recentSessions.data.items).toHaveLength(2)
    expect(recentSessions.data.items[0]).toMatchObject({
      id: second.data.session.id,
      label: "Session User",
    })

    const expiring = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      expiresAt: testkit.runtime.now() + 1,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(expiring.success).toBe(true)
    if (!expiring.success) return
    testkit.advance(2)
    expect(sessionRotate({ database, realmId: realm.id, token: expiring.data.token }).success).toBe(false)
  })
})

test("session lists enforce ownership, limits, recent ordering, and current markers", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createVerifiedUser(database, "sessions-list-alpha.example.com")
    const beta = await createVerifiedUser(database, "sessions-list-beta.example.com")
    const sessions = []
    for (let index = 0; index < 6; index += 1) {
      sessions.push(issueTestSession(database, testkit.runtime, alpha.realm.id, alpha.userId))
      testkit.advance(1)
    }
    const otherRealm = issueTestSession(database, testkit.runtime, beta.realm.id, beta.userId)

    const limited = sessionList({
      currentSessionId: sessions[5]!.session.id,
      database,
      realmId: alpha.realm.id,
      limit: 1,
      userId: alpha.userId,
    })
    expect(limited.success).toBe(true)
    if (!limited.success) return
    expect(limited.data.items).toHaveLength(1)
    expect(limited.data.items[0]).toMatchObject({ current: true, id: sessions[5]!.session.id })

    const all = sessionList({
      currentSessionId: "unknown-session",
      database,
      realmId: alpha.realm.id,
      userId: alpha.userId,
    })
    expect(all.success).toBe(true)
    if (!all.success) return
    expect(all.data.items.map((session) => session.id)).toEqual(sessions.toReversed().map(({ session }) => session.id))
    expect(all.data.items.every((session) => session.current === false)).toBe(true)

    const firstPage = sessionList({
      database,
      query: { pageSize: 2 },
      realmId: alpha.realm.id,
      userId: alpha.userId,
    })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success || firstPage.data.nextPageToken === undefined) return
    const secondPage = sessionList({
      database,
      query: { pageSize: 2, pageToken: firstPage.data.nextPageToken },
      realmId: alpha.realm.id,
      userId: alpha.userId,
    })
    expect(secondPage.success).toBe(true)
    if (secondPage.success) expect(secondPage.data.items[0]?.id).not.toBe(firstPage.data.items[0]?.id)

    const recent = sessionRecentList({
      currentSessionId: sessions[5]!.session.id,
      database,
      realmId: alpha.realm.id,
      userId: alpha.userId,
    })
    expect(recent.success).toBe(true)
    if (!recent.success) return
    expect(recent.data.items.map((session) => session.id)).toEqual(
      sessions
        .toReversed()
        .slice(0, 5)
        .map(({ session }) => session.id),
    )
    expect(recent.data.items).toHaveLength(5)
    expect(recent.data.items.filter((session) => session.current).map((session) => session.id)).toEqual([
      sessions[5]!.session.id,
    ])

    const differentUser = sessionList({
      database,
      realmId: alpha.realm.id,
      userId: beta.userId,
    })
    expect(differentUser).toMatchObject({ success: true, data: { items: [] } })

    const differentRealm = sessionList({
      database,
      realmId: beta.realm.id,
      userId: beta.userId,
    })
    expect(differentRealm.success).toBe(true)
    if (differentRealm.success) expect(differentRealm.data.items).toHaveLength(1)
    if (differentRealm.success) expect(differentRealm.data.items[0]!.id).toBe(otherRealm.session.id)

    expect(sessionList({ database, realmId: beta.realm.id, userId: alpha.userId })).toMatchObject({
      success: true,
      data: { items: [] },
    })

    for (const limit of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(sessionList({ database, realmId: alpha.realm.id, limit, userId: alpha.userId }).success).toBe(false)
    }
    expect(sessionList({ database, realmId: "", userId: alpha.userId }).success).toBe(false)
    expect(sessionList({ database, realmId: alpha.realm.id, userId: "" }).success).toBe(false)
  })
})

test("multi-factor sessions carry assurance and satisfy protected-session requirements", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, realm } = await createVerifiedUser(database, "sessions-assurance.example.com")
    const loggedIn = passwordLogin({
      context,
      database,
      input: { identifier: "session-user", password: "Correct Horse 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(loggedIn.success).toBe(true)
    if (!loggedIn.success) return
    if (loggedIn.data.session === undefined) return

    const elevated = sessionIssue({
      assurance: "multi_factor",
      authenticationMethod: "password",
      database,
      deviceMetadata: { description: "Authenticator" },
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(elevated.success).toBe(true)
    if (!elevated.success) return
    expect(elevated.data.session).toMatchObject({ assurance: "multi_factor" })

    const protectedApp = new Hono()
    protectedApp.get(
      "/realms/:realmId/strong",
      sessionProtectedMiddlewareCreate({ database, minimumAssurance: "multi_factor" }),
      (request) => request.json({ ok: true }),
    )
    const response = await protectedApp.request(`http://server.test/realms/${realm.id}/strong`, {
      headers: { authorization: `Bearer ${elevated.data.token}` },
    })
    expect(response.status).toBe(200)
    const weakerResponse = await protectedApp.request(`http://server.test/realms/${realm.id}/strong`, {
      headers: { authorization: `Bearer ${loggedIn.data.session.token}` },
    })
    expect(weakerResponse.status).toBe(403)

    const invalidMetadata = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      deviceMetadata: { userAgent: "x".repeat(513) },
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(invalidMetadata.success).toBe(false)
  })
})

test("session revocation is idempotent, isolated, and audit-safe", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createVerifiedUser(database, "sessions-revoke-alpha.example.com")
    const beta = await createVerifiedUser(database, "sessions-revoke-beta.example.com")
    const issued = issueTestSession(database, testkit.runtime, alpha.realm.id, alpha.userId)

    const revoked = sessionRevoke({
      database,
      realmId: alpha.realm.id,
      reason: "security review",
      sessionId: issued.session.id,
      userId: alpha.userId,
    })
    expect(revoked).toEqual({ data: { revoked: true }, success: true })

    const events = database.sqlite
      .query("SELECT event_type, payload, metadata FROM events WHERE aggregate_type = 'session' AND aggregate_id = ?")
      .all(issued.session.id) as Array<{ event_type: string; metadata: string; payload: string }>
    expect(events).toHaveLength(2)
    const revocationEvent = events.find((event) => event.event_type === "session.revoked")
    expect(revocationEvent).toBeDefined()
    if (revocationEvent === undefined) return
    expect(JSON.parse(revocationEvent.metadata)).toMatchObject({ auditSafe: true })
    expect(JSON.parse(revocationEvent.payload)).toMatchObject({ reason: "security review" })

    const repeated = sessionRevoke({
      database,
      realmId: alpha.realm.id,
      sessionId: issued.session.id,
      userId: alpha.userId,
    })
    expect(repeated).toEqual({ data: { revoked: false }, success: true })
    expect(
      database.sqlite
        .query(
          "SELECT COUNT(*) AS count FROM events WHERE aggregate_type = 'session' AND aggregate_id = ? AND event_type = 'session.revoked'",
        )
        .get(issued.session.id),
    ).toEqual({ count: 1 })

    expect(
      sessionRevoke({
        database,
        realmId: alpha.realm.id,
        sessionId: issued.session.id,
        userId: "different-user",
      }).success,
    ).toBe(false)
    expect(
      sessionRevoke({
        database,
        realmId: beta.realm.id,
        sessionId: issued.session.id,
        userId: alpha.userId,
      }).success,
    ).toBe(false)
  })
})

test("revoke-all preserves the requested session and rolls back on event failure", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm, userId } = await createVerifiedUser(database, "sessions-revoke-all.example.com")
    const sessions = [issueTestSession(database, testkit.runtime, realm.id, userId)]
    testkit.advance(1)
    sessions.push(issueTestSession(database, testkit.runtime, realm.id, userId))
    testkit.advance(1)
    sessions.push(issueTestSession(database, testkit.runtime, realm.id, userId))
    testkit.advance(1)
    sessions.push(issueTestSession(database, testkit.runtime, realm.id, userId))
    testkit.advance(1)
    expect(
      sessionRevoke({
        database,
        realmId: realm.id,
        sessionId: sessions[0]!.session.id,
        userId,
      }).success,
    ).toBe(true)

    const allRevoked = sessionRevokeAll({
      database,
      exceptSessionId: sessions[1]!.session.id,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(allRevoked).toEqual({ data: { revoked: true }, success: true })
    const listed = sessionList({ database, realmId: realm.id, userId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items.find(({ id }) => id === sessions[0]!.session.id)?.revokedAt).not.toBeNull()
    expect(listed.data.items.find(({ id }) => id === sessions[1]!.session.id)?.revokedAt).toBeNull()
    expect(listed.data.items.find(({ id }) => id === sessions[2]!.session.id)?.revokedAt).not.toBeNull()
    expect(listed.data.items.find(({ id }) => id === sessions[3]!.session.id)?.revokedAt).not.toBeNull()

    const revokeAllEvents = database.sqlite
      .query(
        "SELECT aggregate_id, occurred_at, command_index FROM events WHERE event_type = 'session.revoked_all' ORDER BY command_index",
      )
      .all() as Array<{ aggregate_id: string; occurred_at: number; command_index: number }>
    expect(revokeAllEvents).toHaveLength(2)
    expect(revokeAllEvents.map(({ aggregate_id }) => aggregate_id)).toEqual([
      sessions[3]!.session.id,
      sessions[2]!.session.id,
    ])
    expect(revokeAllEvents.map(({ command_index }) => command_index)).toEqual([0, 1])
    expect(new Set(revokeAllEvents.map(({ occurred_at }) => occurred_at)).size).toBe(1)

    const rollbackSessions = [issueTestSession(database, testkit.runtime, realm.id, userId)]
    testkit.advance(1)
    rollbackSessions.push(issueTestSession(database, testkit.runtime, realm.id, userId))
    database.sqlite.run(
      "CREATE TRIGGER reject_session_revoke_all_events BEFORE INSERT ON events WHEN NEW.event_type = 'session.revoked_all' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const failed = sessionRevokeAll({
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(failed.success).toBe(false)
    database.sqlite.run("DROP TRIGGER reject_session_revoke_all_events")

    const afterRollback = sessionList({ database, realmId: realm.id, userId })
    expect(afterRollback.success).toBe(true)
    if (!afterRollback.success) return
    for (const issued of rollbackSessions) {
      expect(afterRollback.data.items.find(({ id }) => id === issued.session.id)?.revokedAt).toBeNull()
    }
    expect(
      database.sqlite.query("SELECT COUNT(*) AS count FROM events WHERE event_type = 'session.revoked_all'").get(),
    ).toEqual({ count: 2 })
  })
})

test("the password HTTP success seam returns a session with device metadata", async () => {
  await withDatabase(async (database) => {
    const { realm } = await createVerifiedUser(database, "sessions-http.example.com")
    const app = passwordServerAppCreate({ browserMode: true, database })
    const response = await app.request(`https://sessions-http.example.com/realms/${realm.id}/password/login`, {
      body: JSON.stringify({ identifier: "session-user", password: "Correct Horse 12" }),
      headers: {
        "content-type": "application/json",
        "user-agent": "http-agent",
        "x-device-fingerprint": "http-device",
      },
      method: "POST",
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toBeNull()
    const body = (await response.json()) as {
      session?: { session: { device: { fingerprint?: string } }; token: string }
    }
    expect(body.session?.token).toHaveLength(43)
    expect(body.session?.session.device.fingerprint).toBe("http-device")

    const invalidMarker = await app.request(`https://sessions-http.example.com/realms/${realm.id}/password/login`, {
      body: JSON.stringify({ identifier: "session-user", password: "Correct Horse 12" }),
      headers: { "content-type": "application/json", [sessionBrowserModeHeaderName]: "TRUE" },
      method: "POST",
    })
    expect(invalidMarker.status).toBe(200)
    expect(invalidMarker.headers.get("set-cookie")).toBeNull()
    const invalidMarkerBody = (await invalidMarker.json()) as { session?: { token?: string } }
    expect(invalidMarkerBody.session?.token).toHaveLength(43)
  })
})

test("browser password login, rotation, and logout keep session credentials in cookies", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm } = await createVerifiedUser(database, "sessions-browser-http.example.com")
    const passwordApp = passwordServerAppCreate({ browserMode: true, database })
    const loginResponse = await passwordApp.request(
      `https://sessions-browser-http.example.com/realms/${realm.id}/password/login`,
      {
        body: JSON.stringify({ identifier: "session-user", password: "Correct Horse 12" }),
        headers: { "content-type": "application/json", [sessionBrowserModeHeaderName]: "true" },
        method: "POST",
      },
    )
    expect(loginResponse.status).toBe(200)
    const loginBody = (await loginResponse.json()) as {
      authentication: unknown
      session?: unknown
      challenge?: unknown
    }
    const loginCookie = loginResponse.headers.get("set-cookie") ?? ""
    const loginToken = /^session=([^;]+);/.exec(loginCookie)?.[1]
    expect(loginBody.session).toBeUndefined()
    expect(loginBody.challenge).toBeUndefined()
    expect(loginToken).toHaveLength(43)
    expect(JSON.stringify(loginBody)).not.toContain(loginToken ?? "")
    expect(loginCookie).toContain("Path=/")
    expect(loginCookie).toContain("HttpOnly")
    expect(loginCookie).toContain("Secure")
    expect(loginCookie).toContain("SameSite=Lax")
    if (loginToken === undefined) return
    expect(sessionAuthenticate({ database, realmId: realm.id, token: loginToken }).success).toBe(true)

    const sessionApp = sessionServerAppCreate({
      database,
      publicOrigin: "https://sessions-browser-http.example.com",
    })
    const csrfToken = sessionCsrfTokenCreate(testkit.runtime)
    const browserHeaders = {
      cookie: `${loginCookie.split(";", 1)[0]}; csrf=${csrfToken}`,
      origin: "https://sessions-browser-http.example.com",
      "x-csrf-token": csrfToken,
    }
    const rotatedResponse = await sessionApp.request(`https://server.test/realms/${realm.id}/sessions/rotate`, {
      headers: browserHeaders,
      method: "POST",
    })
    expect(rotatedResponse.status).toBe(200)
    const rotatedBody = (await rotatedResponse.json()) as { token?: string; session?: unknown }
    const rotatedCookie = rotatedResponse.headers.get("set-cookie") ?? ""
    const rotatedToken = /^session=([^;]+);/.exec(rotatedCookie)?.[1]
    expect(rotatedBody.token).toBeUndefined()
    expect(rotatedBody.session).toBeDefined()
    expect(rotatedToken).toHaveLength(43)
    expect(rotatedCookie).toContain("Path=/")
    expect(rotatedCookie).toContain("HttpOnly")
    expect(rotatedCookie).toContain("Secure")
    expect(rotatedCookie).toContain("SameSite=Lax")
    expect(rotatedToken).not.toBe(loginToken)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: loginToken }).success).toBe(false)
    const replayResponse = await sessionApp.request(`https://server.test/realms/${realm.id}/sessions/rotate`, {
      headers: browserHeaders,
      method: "POST",
    })
    expect(replayResponse.status).toBe(401)
    if (rotatedToken === undefined) return
    expect(sessionAuthenticate({ database, realmId: realm.id, token: rotatedToken }).success).toBe(true)

    const logoutResponse = await sessionApp.request(`https://server.test/realms/${realm.id}/sessions/logout`, {
      headers: {
        ...browserHeaders,
        cookie: `${rotatedCookie.split(";", 1)[0]}; csrf=${csrfToken}`,
      },
      method: "POST",
    })
    expect(logoutResponse.status).toBe(200)
    expect(await logoutResponse.json()).toEqual({ revoked: true })
    expect(logoutResponse.headers.get("set-cookie")).toBe(
      "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    )
    expect(sessionAuthenticate({ database, realmId: realm.id, token: rotatedToken }).success).toBe(false)
  })
})

test("sessions support expiry, revocation, tenant isolation, and protected routes", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createVerifiedUser(database, "sessions-alpha.example.com")
    const beta = await createVerifiedUser(database, "sessions-beta.example.com")
    const alphaLogin = passwordLogin({
      context: alpha.context,
      database,
      input: { identifier: "session-user", password: "Correct Horse 12" },
      realmId: alpha.realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(alphaLogin.success).toBe(true)
    if (!alphaLogin.success || alphaLogin.data.session === undefined) return
    const token = alphaLogin.data.session.token
    expect(sessionAuthenticate({ database, realmId: beta.realm.id, token }).success).toBe(false)

    const app = sessionServerAppCreate({ database })
    const client = sessionApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token,
    })
    const current = await client.sessionCurrent(alpha.realm.id)
    expect(current.success).toBe(true)
    const currentResponse = await app.request(`http://server.test/realms/${alpha.realm.id}/sessions/current`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(currentResponse.status).toBe(200)
    const currentResponseBody = await currentResponse.json()
    const currentResponseParsed = v.safeParse(sessionResponseSchema, currentResponseBody)
    expect(currentResponseParsed.success).toBe(true)
    if (currentResponseParsed.success) expect(currentResponseParsed.output.session.current).toBe(true)
    const listed = await client.sessionList(alpha.realm.id)
    expect(listed.success).toBe(true)
    if (listed.success) {
      expect(listed.data.items).toHaveLength(1)
      expect(listed.data.items[0]?.label).toBeUndefined()
      expect(listed.data.items[0]).not.toHaveProperty("loginIdentifier")
    }
    const recent = await client.sessionRecentList(alpha.realm.id)
    expect(recent.success).toBe(true)
    if (recent.success) {
      expect(recent.data.items[0]?.label).toBe("Session User")
      expect(recent.data.items[0]?.loginIdentifier).toBe("session-user")
      expect(recent.data.items[0]).not.toHaveProperty("profile")
      expect(recent.data.items[0]).not.toHaveProperty("userName")
    }
    const protectedResponse = await app.request(`http://server.test/realms/${alpha.realm.id}/protected`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(protectedResponse.status).toBe(200)
    const protectedBody = (await protectedResponse.json()) as { session: { id: string } }
    expect(protectedBody.session.id).toBe(alphaLogin.data.session.session.id)
    expect((await app.request(`http://server.test/realms/${alpha.realm.id}/protected`)).status).toBe(401)
    const bearerRotate = await app.request(`http://server.test/realms/${alpha.realm.id}/sessions/rotate`, {
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
    })
    expect(bearerRotate.status).toBe(200)
    expect(bearerRotate.headers.get("set-cookie")).toBeNull()
    const bearerRotateBody = (await bearerRotate.json()) as { token?: string }
    expect(bearerRotateBody.token).toHaveLength(43)

    const revoked = sessionRevoke({
      database,
      realmId: alpha.realm.id,
      sessionId: alphaLogin.data.session.session.id,
      userId: alphaLogin.data.authentication.userId,
    })
    expect(revoked).toEqual({ data: { revoked: true }, success: true })
    expect(sessionAuthenticate({ database, realmId: alpha.realm.id, token }).success).toBe(false)

    const short = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      executor: database.db,
      expiresAt: testkit.runtime.now() + 10,
      realmId: alpha.realm.id,
      runtime: testkit.runtime,
      userId: alphaLogin.data.authentication.userId,
    })
    if (!short.success) throw new Error(short.errorMessage)
    const ordinary = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      executor: database.db,
      realmId: alpha.realm.id,
      userId: alphaLogin.data.authentication.userId,
    })
    expect(ordinary.success).toBe(true)
    if (!ordinary.success) return
    testkit.advance(11)
    expect(sessionAuthenticate({ database, realmId: alpha.realm.id, token: short.data.token }).success).toBe(false)

    const protectedApp = new Hono()
    protectedApp.get(
      "/realms/:realmId/strong",
      sessionProtectedMiddlewareCreate({ database, minimumAssurance: "multi_factor" }),
      (context) => context.json({ ok: true }),
    )
    const strongResponse = await protectedApp.request(`http://server.test/realms/${alpha.realm.id}/strong`, {
      headers: { authorization: `Bearer ${ordinary.data.token}` },
    })
    expect(strongResponse.status).toBe(403)

    const decision = authorizationPolicyEvaluate({
      actor: {
        actorId: alphaLogin.data.authentication.userId,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        realmId: alpha.realm.id,
        kind: "user",
      },
      realmId: alpha.realm.id,
      permission: "sessions.read",
      policies: [{ effect: "allow", minimumAssurance: "multi_factor", permission: "sessions.read" }],
    })
    expect(decision).toMatchObject({ data: { allowed: false, reason: "insufficient_assurance" }, success: true })
    expect(beta.realm.id).not.toBe(alpha.realm.id)
  })
})

test("browser session middleware resolves cookies and protects unsafe requests with origin and CSRF checks", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm, userId } = await createVerifiedUser(database, "sessions-browser.example.com")
    const issued = issueTestSession(database, testkit.runtime, realm.id, userId)
    const protectedApp = new Hono()
    protectedApp.all(
      "/realms/:realmId/protected",
      sessionProtectedMiddlewareCreate({ database, publicOrigin: "https://sessions-browser.example.com" }),
      (context) => context.json({ cookieAuthenticated: context.get("cookieAuthenticated") }),
    )
    const cookie = `session=${issued.token}`

    const safe = await protectedApp.request(`https://server.test/realms/${realm.id}/protected`, {
      headers: { cookie },
      method: "GET",
    })
    expect(safe.status).toBe(200)
    expect(await safe.json()).toEqual({ cookieAuthenticated: true })

    const missingOrigin = await protectedApp.request(`https://server.test/realms/${realm.id}/protected`, {
      headers: { cookie },
      method: "POST",
    })
    expect(missingOrigin.status).toBe(403)

    const csrfToken = sessionCsrfTokenCreate(testkit.runtime)
    const validBrowserHeaders = {
      cookie: `${cookie}; csrf=${csrfToken}`,
      origin: "https://sessions-browser.example.com",
      "x-csrf-token": csrfToken,
    }
    const validBrowser = await protectedApp.request(`https://server.test/realms/${realm.id}/protected`, {
      headers: validBrowserHeaders,
      method: "POST",
    })
    expect(validBrowser.status).toBe(200)
    expect(await validBrowser.json()).toEqual({ cookieAuthenticated: true })

    const hostileOrigin = await protectedApp.request(`https://server.test/realms/${realm.id}/protected`, {
      headers: { ...validBrowserHeaders, origin: "https://evil.example.test" },
      method: "POST",
    })
    expect(hostileOrigin.status).toBe(403)

    const bearer = await protectedApp.request(`https://server.test/realms/${realm.id}/protected`, {
      headers: { authorization: `Bearer ${issued.token}` },
      method: "POST",
    })
    expect(bearer.status).toBe(200)
    expect(await bearer.json()).toEqual({ cookieAuthenticated: false })

    const bearerTakesPrecedence = await protectedApp.request(`https://server.test/realms/${realm.id}/protected`, {
      headers: { authorization: `Bearer ${issued.token}`, ...validBrowserHeaders, origin: "https://evil.example.test" },
      method: "POST",
    })
    expect(bearerTakesPrecedence.status).toBe(200)
    expect(await bearerTakesPrecedence.json()).toEqual({ cookieAuthenticated: false })

    const invalidBearerTakesPrecedence = await protectedApp.request(
      `https://server.test/realms/${realm.id}/protected`,
      {
        headers: { authorization: "Bearer invalid-token", cookie },
        method: "GET",
      },
    )
    expect(invalidBearerTakesPrecedence.status).toBe(401)

    const csrfApp = sessionServerAppCreate({ database, publicOrigin: "https://sessions-browser.example.com" })
    const csrfResponse = await csrfApp.request(`https://server.test/realms/${realm.id}/sessions/csrf`, {
      headers: { cookie },
    })
    expect(csrfResponse.status).toBe(200)
    const csrfBody = (await csrfResponse.json()) as { csrfToken: string }
    expect(csrfBody.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(csrfResponse.headers.get("set-cookie")).toContain(`csrf=${csrfBody.csrfToken}`)
  })
})

test("session issuance rolls back password success and events atomically", async () => {
  await withDatabase(async (database) => {
    const { context, realm } = await createVerifiedUser(database, "sessions-atomic.example.com")
    database.sqlite.run(
      "CREATE TRIGGER reject_session_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'session' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const before = database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()
    const failed = passwordLogin({
      context,
      database,
      input: { identifier: "session-user", password: "Correct Horse 12" },
      realmId: realm.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(failed.success).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual(before)
    database.sqlite.run("DROP TRIGGER reject_session_events")
  })
})

test("session CLI exposes session management commands", async () => {
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "sessions", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("Manage sessions")
})
