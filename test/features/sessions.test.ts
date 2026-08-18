import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordLogin } from "../../src/features/passwords/actions/passwordLogin.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { passwordServerAppCreate } from "../../src/features/passwords/server/passwordServerAppCreate.js"
import { authorizationPolicyEvaluate } from "../../src/features/authorization/actions/authorizationPolicyEvaluate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { sessionRevoke } from "../../src/features/sessions/actions/sessionRevoke.js"
import { sessionRevokeAll } from "../../src/features/sessions/actions/sessionRevokeAll.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionList } from "../../src/features/sessions/actions/sessionList.js"
import { sessionRecentList } from "../../src/features/sessions/actions/sessionRecentList.js"
import { sessionProtectedMiddlewareCreate } from "../../src/features/sessions/server/sessionProtectedMiddlewareCreate.js"
import { sessionPasswordCreate } from "../../src/features/sessions/public/sessionPasswordCreate.js"
import { sessionRotate } from "../../src/features/sessions/actions/sessionRotate.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-sessions-"))
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

async function createVerifiedUser(database: StorageDatabase, domain: string) {
  const instance = instanceCreate({
    context: instanceSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(instance.success).toBe(true)
  if (!instance.success) throw new Error(instance.errorMessage)
  const context = instanceTenantContextCreate(instance.data.instance.id, "anonymous")
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
    instanceId: instance.data.instance.id,
    onVerificationToken: (delivery) => {
      token = delivery.token
      userId = delivery.userId
    },
  })
  expect(registered.success).toBe(true)
  expect(
    passwordEmailVerify({ context, database, input: { token }, instanceId: instance.data.instance.id }).success,
  ).toBe(true)
  return { context, instance: instance.data.instance, userId }
}

function issueTestSession(
  database: StorageDatabase,
  runtime: ReturnType<typeof platformTestkitCreate>["runtime"],
  instanceId: string,
  userId: string,
) {
  const issued = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    instanceId,
    runtime,
    userId,
  })
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data
}

test("password success issues an opaque session and rotation rejects replay", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, instance } = await createVerifiedUser(database, "sessions.example.com")
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
      instanceId: instance.id,
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

    const authenticated = sessionAuthenticate({ database, instanceId: instance.id, token: oldToken })
    expect(authenticated.success).toBe(true)
    testkit.advance(1)
    const rotated = sessionRotate({ database, instanceId: instance.id, token: oldToken })
    expect(rotated.success).toBe(true)
    if (!rotated.success) return
    expect(sessionAuthenticate({ database, instanceId: instance.id, token: oldToken }).success).toBe(false)
    expect(sessionAuthenticate({ database, instanceId: instance.id, token: rotated.data.token }).success).toBe(true)

    testkit.advance(1)
    const second = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      deviceMetadata: { description: "Phone" },
      instanceId: instance.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(second.success).toBe(true)
    if (!second.success) return
    const allSessions = sessionList({
      currentSessionId: second.data.session.id,
      database,
      instanceId: instance.id,
      userId: loggedIn.data.authentication.userId,
    })
    expect(allSessions.success).toBe(true)
    if (!allSessions.success) return
    expect(allSessions.data.total).toBe(2)
    expect(allSessions.data.sessions[0]).toMatchObject({ current: true, id: second.data.session.id })
    const recentSessions = sessionRecentList({
      currentSessionId: second.data.session.id,
      database,
      instanceId: instance.id,
      userId: loggedIn.data.authentication.userId,
    })
    expect(recentSessions.success).toBe(true)
    if (!recentSessions.success) return
    expect(recentSessions.data.total).toBe(2)
    expect(recentSessions.data.sessions[0]).toMatchObject({ id: second.data.session.id })

    const expiring = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      expiresAt: testkit.runtime.now() + 1,
      instanceId: instance.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(expiring.success).toBe(true)
    if (!expiring.success) return
    testkit.advance(2)
    expect(sessionRotate({ database, instanceId: instance.id, token: expiring.data.token }).success).toBe(false)
  })
})

test("session lists enforce ownership, limits, recent ordering, and current markers", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createVerifiedUser(database, "sessions-list-alpha.example.com")
    const beta = await createVerifiedUser(database, "sessions-list-beta.example.com")
    const sessions = []
    for (let index = 0; index < 6; index += 1) {
      sessions.push(issueTestSession(database, testkit.runtime, alpha.instance.id, alpha.userId))
      testkit.advance(1)
    }
    const otherInstance = issueTestSession(database, testkit.runtime, beta.instance.id, beta.userId)

    const limited = sessionList({
      currentSessionId: sessions[5]!.session.id,
      database,
      instanceId: alpha.instance.id,
      limit: 1,
      userId: alpha.userId,
    })
    expect(limited.success).toBe(true)
    if (!limited.success) return
    expect(limited.data).toMatchObject({ total: 1 })
    expect(limited.data.sessions[0]).toMatchObject({ current: true, id: sessions[5]!.session.id })

    const all = sessionList({
      currentSessionId: "unknown-session",
      database,
      instanceId: alpha.instance.id,
      userId: alpha.userId,
    })
    expect(all.success).toBe(true)
    if (!all.success) return
    expect(all.data.sessions.map((session) => session.id)).toEqual(
      sessions.toReversed().map(({ session }) => session.id),
    )
    expect(all.data.sessions.every((session) => session.current === false)).toBe(true)

    const recent = sessionRecentList({
      currentSessionId: sessions[5]!.session.id,
      database,
      instanceId: alpha.instance.id,
      userId: alpha.userId,
    })
    expect(recent.success).toBe(true)
    if (!recent.success) return
    expect(recent.data.sessions.map((session) => session.id)).toEqual(
      sessions
        .toReversed()
        .slice(0, 5)
        .map(({ session }) => session.id),
    )
    expect(recent.data.total).toBe(5)
    expect(recent.data.sessions.filter((session) => session.current).map((session) => session.id)).toEqual([
      sessions[5]!.session.id,
    ])

    const differentUser = sessionList({
      database,
      instanceId: alpha.instance.id,
      userId: beta.userId,
    })
    expect(differentUser).toMatchObject({ success: true, data: { total: 0, sessions: [] } })

    const differentInstance = sessionList({
      database,
      instanceId: beta.instance.id,
      userId: beta.userId,
    })
    expect(differentInstance).toMatchObject({ success: true, data: { total: 1 } })
    if (differentInstance.success) expect(differentInstance.data.sessions[0]!.id).toBe(otherInstance.session.id)

    expect(sessionList({ database, instanceId: beta.instance.id, userId: alpha.userId })).toMatchObject({
      success: true,
      data: { sessions: [], total: 0 },
    })

    for (const limit of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(sessionList({ database, instanceId: alpha.instance.id, limit, userId: alpha.userId }).success).toBe(false)
    }
    expect(sessionList({ database, instanceId: "", userId: alpha.userId }).success).toBe(false)
    expect(sessionList({ database, instanceId: alpha.instance.id, userId: "" }).success).toBe(false)
  })
})

test("multi-factor sessions carry assurance and satisfy protected-session requirements", async () => {
  await withDatabase(async (database, testkit) => {
    const { context, instance } = await createVerifiedUser(database, "sessions-assurance.example.com")
    const loggedIn = passwordLogin({
      context,
      database,
      input: { identifier: "session-user", password: "Correct Horse 12" },
      instanceId: instance.id,
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
      instanceId: instance.id,
      runtime: testkit.runtime,
      userId: loggedIn.data.authentication.userId,
    })
    expect(elevated.success).toBe(true)
    if (!elevated.success) return
    expect(elevated.data.session).toMatchObject({ assurance: "multi_factor" })

    const protectedApp = new Hono()
    protectedApp.get(
      "/instances/:instanceId/strong",
      sessionProtectedMiddlewareCreate({ database, minimumAssurance: "multi_factor" }),
      (request) => request.json({ ok: true }),
    )
    const response = await protectedApp.request(`http://server.test/instances/${instance.id}/strong`, {
      headers: { authorization: `Bearer ${elevated.data.token}` },
    })
    expect(response.status).toBe(200)
    const weakerResponse = await protectedApp.request(`http://server.test/instances/${instance.id}/strong`, {
      headers: { authorization: `Bearer ${loggedIn.data.session.token}` },
    })
    expect(weakerResponse.status).toBe(403)

    const invalidMetadata = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      deviceMetadata: { userAgent: "x".repeat(513) },
      instanceId: instance.id,
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
    const issued = issueTestSession(database, testkit.runtime, alpha.instance.id, alpha.userId)

    const revoked = sessionRevoke({
      database,
      instanceId: alpha.instance.id,
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
      instanceId: alpha.instance.id,
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
        instanceId: alpha.instance.id,
        sessionId: issued.session.id,
        userId: "different-user",
      }).success,
    ).toBe(false)
    expect(
      sessionRevoke({
        database,
        instanceId: beta.instance.id,
        sessionId: issued.session.id,
        userId: alpha.userId,
      }).success,
    ).toBe(false)
  })
})

test("revoke-all preserves the requested session and rolls back on event failure", async () => {
  await withDatabase(async (database, testkit) => {
    const { instance, userId } = await createVerifiedUser(database, "sessions-revoke-all.example.com")
    const sessions = [issueTestSession(database, testkit.runtime, instance.id, userId)]
    testkit.advance(1)
    sessions.push(issueTestSession(database, testkit.runtime, instance.id, userId))
    testkit.advance(1)
    sessions.push(issueTestSession(database, testkit.runtime, instance.id, userId))
    testkit.advance(1)
    sessions.push(issueTestSession(database, testkit.runtime, instance.id, userId))
    testkit.advance(1)
    expect(
      sessionRevoke({
        database,
        instanceId: instance.id,
        sessionId: sessions[0]!.session.id,
        userId,
      }).success,
    ).toBe(true)

    const allRevoked = sessionRevokeAll({
      database,
      exceptSessionId: sessions[1]!.session.id,
      instanceId: instance.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(allRevoked).toEqual({ data: { revoked: true }, success: true })
    const listed = sessionList({ database, instanceId: instance.id, userId })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.sessions.find(({ id }) => id === sessions[0]!.session.id)?.revokedAt).not.toBeNull()
    expect(listed.data.sessions.find(({ id }) => id === sessions[1]!.session.id)?.revokedAt).toBeNull()
    expect(listed.data.sessions.find(({ id }) => id === sessions[2]!.session.id)?.revokedAt).not.toBeNull()
    expect(listed.data.sessions.find(({ id }) => id === sessions[3]!.session.id)?.revokedAt).not.toBeNull()

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

    const rollbackSessions = [issueTestSession(database, testkit.runtime, instance.id, userId)]
    testkit.advance(1)
    rollbackSessions.push(issueTestSession(database, testkit.runtime, instance.id, userId))
    database.sqlite.run(
      "CREATE TRIGGER reject_session_revoke_all_events BEFORE INSERT ON events WHEN NEW.event_type = 'session.revoked_all' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const failed = sessionRevokeAll({
      database,
      instanceId: instance.id,
      runtime: testkit.runtime,
      userId,
    })
    expect(failed.success).toBe(false)
    database.sqlite.run("DROP TRIGGER reject_session_revoke_all_events")

    const afterRollback = sessionList({ database, instanceId: instance.id, userId })
    expect(afterRollback.success).toBe(true)
    if (!afterRollback.success) return
    for (const issued of rollbackSessions) {
      expect(afterRollback.data.sessions.find(({ id }) => id === issued.session.id)?.revokedAt).toBeNull()
    }
    expect(
      database.sqlite.query("SELECT COUNT(*) AS count FROM events WHERE event_type = 'session.revoked_all'").get(),
    ).toEqual({ count: 2 })
  })
})

test("the password HTTP success seam returns a session with device metadata", async () => {
  await withDatabase(async (database) => {
    const { instance } = await createVerifiedUser(database, "sessions-http.example.com")
    const app = passwordServerAppCreate({ database })
    const response = await app.request(`https://sessions-http.example.com/instances/${instance.id}/password/login`, {
      body: JSON.stringify({ identifier: "session-user", password: "Correct Horse 12" }),
      headers: {
        "content-type": "application/json",
        "user-agent": "http-agent",
        "x-device-fingerprint": "http-device",
      },
      method: "POST",
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      session?: { session: { device: { fingerprint?: string } }; token: string }
    }
    expect(body.session?.token).toHaveLength(43)
    expect(body.session?.session.device.fingerprint).toBe("http-device")
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
      instanceId: alpha.instance.id,
      sessionCreate: sessionPasswordCreate(),
    })
    expect(alphaLogin.success).toBe(true)
    if (!alphaLogin.success || alphaLogin.data.session === undefined) return
    const token = alphaLogin.data.session.token
    expect(sessionAuthenticate({ database, instanceId: beta.instance.id, token }).success).toBe(false)

    const app = sessionServerAppCreate({ database })
    const client = sessionApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token,
    })
    const current = await client.sessionCurrent(alpha.instance.id)
    expect(current.success).toBe(true)
    const listed = await client.sessionList(alpha.instance.id)
    expect(listed).toMatchObject({ success: true, data: { total: 1 } })
    const protectedResponse = await app.request(`http://server.test/instances/${alpha.instance.id}/protected`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(protectedResponse.status).toBe(200)
    const protectedBody = (await protectedResponse.json()) as { session: { id: string } }
    expect(protectedBody.session.id).toBe(alphaLogin.data.session.session.id)
    expect((await app.request(`http://server.test/instances/${alpha.instance.id}/protected`)).status).toBe(401)

    const revoked = sessionRevoke({
      database,
      instanceId: alpha.instance.id,
      sessionId: alphaLogin.data.session.session.id,
      userId: alphaLogin.data.authentication.userId,
    })
    expect(revoked).toEqual({ data: { revoked: true }, success: true })
    expect(sessionAuthenticate({ database, instanceId: alpha.instance.id, token }).success).toBe(false)

    const short = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      executor: database.db,
      expiresAt: testkit.runtime.now() + 10,
      instanceId: alpha.instance.id,
      runtime: testkit.runtime,
      userId: alphaLogin.data.authentication.userId,
    })
    if (!short.success) throw new Error(short.errorMessage)
    const ordinary = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      executor: database.db,
      instanceId: alpha.instance.id,
      userId: alphaLogin.data.authentication.userId,
    })
    expect(ordinary.success).toBe(true)
    if (!ordinary.success) return
    testkit.advance(11)
    expect(sessionAuthenticate({ database, instanceId: alpha.instance.id, token: short.data.token }).success).toBe(
      false,
    )

    const protectedApp = new Hono()
    protectedApp.get(
      "/instances/:instanceId/strong",
      sessionProtectedMiddlewareCreate({ database, minimumAssurance: "multi_factor" }),
      (context) => context.json({ ok: true }),
    )
    const strongResponse = await protectedApp.request(`http://server.test/instances/${alpha.instance.id}/strong`, {
      headers: { authorization: `Bearer ${ordinary.data.token}` },
    })
    expect(strongResponse.status).toBe(403)

    const decision = authorizationPolicyEvaluate({
      actor: {
        actorId: alphaLogin.data.authentication.userId,
        assurance: "authenticated",
        authenticationMethod: "trusted",
        instanceId: alpha.instance.id,
        kind: "user",
      },
      instanceId: alpha.instance.id,
      permission: "sessions.read",
      policies: [{ effect: "allow", minimumAssurance: "multi_factor", permission: "sessions.read" }],
    })
    expect(decision).toMatchObject({ data: { allowed: false, reason: "insufficient_assurance" }, success: true })
    expect(beta.instance.id).not.toBe(alpha.instance.id)
  })
})

test("session issuance rolls back password success and events atomically", async () => {
  await withDatabase(async (database) => {
    const { context, instance } = await createVerifiedUser(database, "sessions-atomic.example.com")
    database.sqlite.run(
      "CREATE TRIGGER reject_session_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'session' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const before = database.sqlite.query("SELECT COUNT(*) AS count FROM sessions").get()
    const failed = passwordLogin({
      context,
      database,
      input: { identifier: "session-user", password: "Correct Horse 12" },
      instanceId: instance.id,
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
