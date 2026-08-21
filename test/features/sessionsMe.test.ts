import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-sessions-me-"))
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

async function createUser(database: StorageDatabase, realmId: string, name: string) {
  const context = realmTenantContextCreate(realmId, "anonymous")
  let token = ""
  let userId = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `${name}@example.com`,
      password: "Correct Horse 12",
      profile: { displayName: name },
      userName: name,
    },
    onVerificationToken: (delivery) => {
      token = delivery.token
      userId = delivery.userId
    },
    realmId,
  })
  expect(registered.success).toBe(true)
  expect(passwordEmailVerify({ context, database, input: { token }, realmId }).success).toBe(true)
  return userId
}

function issueSession(
  database: StorageDatabase,
  runtime: ReturnType<typeof platformTestkitCreate>["runtime"],
  realmId: string,
  userId: string,
  description: string,
) {
  const issued = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    deviceMetadata: {
      description,
      fingerprint: `${description}-fingerprint`,
      ipAddress: "192.0.2.1",
      userAgent: "session-test-agent",
    },
    realmId,
    runtime,
    userId,
  })
  expect(issued.success).toBe(true)
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data
}

test("subject-bound session APIs paginate, mark the active session, and redact credentials and fingerprints", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "sessions-me.example.com")
    const userId = await createUser(database, realm.id, "sessions-me-user")
    const otherUserId = await createUser(database, realm.id, "sessions-me-other")
    const otherRealm = await createRealm(database, "sessions-me-other-realm.example.com")
    const otherRealmUserId = await createUser(database, otherRealm.id, "sessions-me-realm-user")
    const sessions = [issueSession(database, testkit.runtime, realm.id, userId, "first")]
    testkit.advance(1)
    sessions.push(issueSession(database, testkit.runtime, realm.id, userId, "second"))
    testkit.advance(1)
    sessions.push(issueSession(database, testkit.runtime, realm.id, userId, "current"))
    const otherUserSession = issueSession(database, testkit.runtime, realm.id, otherUserId, "other-user")
    const otherRealmSession = issueSession(database, testkit.runtime, otherRealm.id, otherRealmUserId, "other-realm")
    const app = sessionServerAppCreate({ database, publicOrigin: "https://identity.example.com" })
    const current = sessions[2]!
    const client = sessionApiClientCreate({
      baseUrl: "https://identity.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: current.token,
    })

    const firstPage = await client.sessionMeList(realm.id, { pageSize: 2 })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success) return
    expect(firstPage.data.items).toHaveLength(2)
    expect(firstPage.data.items[0]).toMatchObject({ current: true, device: { description: "current" } })
    expect(firstPage.data.nextPageToken).toBeDefined()
    expect(JSON.stringify(firstPage.data)).not.toContain(current.token)
    expect(JSON.stringify(firstPage.data)).not.toContain("tokenHash")
    expect(JSON.stringify(firstPage.data)).not.toContain("current-fingerprint")
    expect(firstPage.data.items[0]).not.toHaveProperty("userId")
    expect(firstPage.data.items[0]).not.toHaveProperty("realmId")
    expect(firstPage.data.items[0]?.device).toEqual({
      description: "current",
      ipAddress: "192.0.2.1",
      userAgent: "session-test-agent",
    })

    const secondPage = await client.sessionMeList(realm.id, { pageSize: 2, pageToken: firstPage.data.nextPageToken })
    expect(secondPage.success).toBe(true)
    if (secondPage.success) expect(secondPage.data.items.map(({ id }) => id)).not.toContain(firstPage.data.items[0]!.id)

    const otherUserResponse = await app.request(`https://server.test/realms/${realm.id}/me/sessions`, {
      headers: { authorization: `Bearer ${otherUserSession.token}` },
    })
    expect(otherUserResponse.status).toBe(200)
    expect((await otherUserResponse.json()).items).toHaveLength(1)

    const crossRealmResponse = await app.request(`https://server.test/realms/${otherRealm.id}/me/sessions`, {
      headers: { authorization: `Bearer ${current.token}` },
    })
    expect(crossRealmResponse.status).toBe(401)
    const crossUserRevokeResponse = await app.request(
      `https://server.test/realms/${realm.id}/me/sessions/${otherUserSession.session.id}`,
      { headers: { authorization: `Bearer ${current.token}` }, method: "DELETE" },
    )
    expect(crossUserRevokeResponse.status).toBe(404)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: otherUserSession.token }).success).toBe(true)
    expect(sessionAuthenticate({ database, realmId: otherRealm.id, token: otherRealmSession.token }).success).toBe(true)
  })
})

test("subject-bound revocation requires browser CSRF/origin and preserves the active session", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "sessions-me-revoke.example.com")
    const userId = await createUser(database, realm.id, "sessions-me-revoke-user")
    const current = issueSession(database, testkit.runtime, realm.id, userId, "current")
    const revoked = issueSession(database, testkit.runtime, realm.id, userId, "revoked")
    const app = sessionServerAppCreate({ database, publicOrigin: "https://identity.example.com" })
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const cookie = `session=${current.token}; csrf=${csrf}`
    const browserHeaders = {
      cookie,
      origin: "https://identity.example.com",
      "x-csrf-token": csrf,
    }

    const missingCsrf = await app.request(`https://server.test/realms/${realm.id}/me/sessions`, {
      headers: { cookie, origin: "https://identity.example.com" },
      method: "DELETE",
    })
    expect(missingCsrf.status).toBe(403)
    const hostileOrigin = await app.request(`https://server.test/realms/${realm.id}/me/sessions`, {
      headers: { ...browserHeaders, origin: "https://evil.example.com" },
      method: "DELETE",
    })
    expect(hostileOrigin.status).toBe(403)

    const currentRevoke = await app.request(
      `https://server.test/realms/${realm.id}/me/sessions/${current.session.id}`,
      { headers: browserHeaders, method: "DELETE" },
    )
    expect(currentRevoke.status).toBe(403)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: current.token }).success).toBe(true)

    const all = await app.request(`https://server.test/realms/${realm.id}/me/sessions`, {
      headers: browserHeaders,
      method: "DELETE",
    })
    expect(all.status).toBe(200)
    expect(await all.json()).toEqual({ revoked: true })
    expect(sessionAuthenticate({ database, realmId: realm.id, token: current.token }).success).toBe(true)
    expect(sessionAuthenticate({ database, realmId: realm.id, token: revoked.token }).success).toBe(false)
  })
})
