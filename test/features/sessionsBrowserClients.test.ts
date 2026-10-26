import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionAuthenticate } from "../../src/features/sessions/actions/sessionAuthenticate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionApiClientCreate } from "../../src/features/sessions/client/sessionApiClientCreate.js"
import { sessionServerAppCreate } from "../../src/features/sessions/server/sessionServerAppCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const publicOrigin = "https://sessions-browser-clients.example.com"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-sessions-browser-clients-"))
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

function createActiveUser(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: `${userName}@example.com`, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: realmSystemContextCreate("system"),
    database,
    input: { state: "active" },
    realmId,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  return active.data.user
}

test("sessionCsrfGet and sessionProtectedGet round-trip against the session server app", async () => {
  await withDatabase(async (database, testkit) => {
    const created = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "sessions-browser-clients.example.com", name: "browser clients" },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const realm = created.data.realm
    const user = createActiveUser(database, realm.id, "browser-client-user")
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    const app = sessionServerAppCreate({ database, publicOrigin })
    const client = sessionApiClientCreate({
      baseUrl: "https://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issued.data.token,
    })

    const csrf = await client.sessionCsrfGet(realm.id)
    expect(csrf.success).toBe(true)
    if (!csrf.success) return
    expect(csrf.data.csrfToken.length).toBeGreaterThan(0)
    const second = await client.sessionCsrfGet(realm.id)
    expect(second.success).toBe(true)
    if (second.success) expect(second.data.csrfToken).not.toBe(csrf.data.csrfToken)

    const probe = await client.sessionProtectedGet(realm.id)
    expect(probe.success).toBe(true)
    if (!probe.success) return
    expect(probe.data.actor).toMatchObject({ actorId: user.id, kind: "user" })
    expect(probe.data.session).toMatchObject({ id: issued.data.session.id, realmId: realm.id })
  })
})

test("sessionLogout drives the browser-cookie logout flow and revokes the session", async () => {
  await withDatabase(async (database, testkit) => {
    const created = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "sessions-logout.example.com", name: "logout" },
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const realm = created.data.realm
    const user = createActiveUser(database, realm.id, "logout-user")
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    const app = sessionServerAppCreate({ database, publicOrigin })
    const jar = new Map<string, string>([["session", issued.data.token]])
    const cookieFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers)
      headers.set("cookie", [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "))
      headers.set("origin", publicOrigin)
      const response = await app.request(input.toString(), { ...init, headers })
      for (const pair of response.headers.getSetCookie()) {
        const match = /^([^=]+)=([^;]*)/.exec(pair)
        if (match?.[1] !== undefined && match[2] !== undefined) {
          if (match[2].length === 0) jar.delete(match[1])
          else jar.set(match[1], match[2])
        }
      }
      return response
    }
    const client = sessionApiClientCreate({ baseUrl: "https://server.test", fetch: cookieFetch })

    const loggedOut = await client.sessionLogout(realm.id)
    expect(loggedOut).toEqual({ data: { revoked: true }, success: true })
    expect(sessionAuthenticate({ database, realmId: realm.id, token: issued.data.token }).success).toBe(false)
  })
})
