import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { eventList } from "../../src/features/events/actions/eventList.js"
import { eventApiClientCreate } from "../../src/features/events/client/eventApiClientCreate.js"
import { eventListResponseSchema } from "../../src/features/events/public/eventListResponseSchema.js"
import { eventServerAppCreate } from "../../src/features/events/server/eventServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-events-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function createUser(database: StorageDatabase, realmId: string, userName: string) {
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      email: `${userName}@example.com`,
      profile: { displayName: userName, firstName: userName, lastName: "User" },
      userName,
    },
    realmId,
  })
  expect(created.success).toBe(true)
}

test("events list is public-schema safe, cursor paginated, and realm isolated", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "events-alpha.example.com")
    const beta = await createRealm(database, "events-beta.example.com")
    createUser(database, alpha.id, "alpha-one")
    createUser(database, alpha.id, "alpha-two")
    createUser(database, beta.id, "beta-one")

    const alphaEventIds = new Set<string>()
    let pageToken: string | undefined
    do {
      const page = eventList({
        context: realmSystemContextCreate(),
        database,
        query: { pageSize: 2, pageToken, sortBy: "occurredAt", sortDirection: "desc" },
        realmId: alpha.id,
      })
      expect(page.success).toBe(true)
      if (!page.success) return
      const parsed = v.safeParse(eventListResponseSchema, page.data)
      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      for (const event of parsed.output.items) {
        alphaEventIds.add(event.id)
        expect(event.realmId).toBe(alpha.id)
        expect("position" in event).toBe(false)
        expect("commandIndex" in event).toBe(false)
      }
      pageToken = page.data.nextPageToken
    } while (pageToken !== undefined)

    expect(alphaEventIds).toHaveLength(3)
    expect([...alphaEventIds].every((id) => typeof id === "string" && id.length > 0)).toBe(true)

    const betaEvents = eventList({ context: realmSystemContextCreate(), database, realmId: beta.id })
    expect(betaEvents.success).toBe(true)
    if (!betaEvents.success) return
    expect(betaEvents.data.items).toHaveLength(2)
    expect(betaEvents.data.items.every((event) => event.realmId === beta.id)).toBe(true)
    expect(betaEvents.data.items.every((event) => !alphaEventIds.has(event.id))).toBe(true)

    expect(
      eventList({
        context: realmTenantContextCreate(alpha.id, "actor"),
        database,
        realmId: beta.id,
      }),
    ).toEqual({
      code: "events.tenant-mismatch",
      errorMessage: "The events are not available in this tenant context.",
      op: "eventList",
      success: false,
    })
  })
})

test("events system route and client require system authorization", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "events-api.example.com")
    createUser(database, realm.id, "api-user")
    const app = eventServerAppCreate({ database, systemSecret: "system-secret" })
    const client = eventApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })

    const listed = await client.eventList(realm.id, { pageSize: 1 })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items).toHaveLength(1)
    expect(listed.data.nextPageToken).toBeString()

    const clamped = await app.request(`http://server.test/system/realms/${realm.id}/events?pageSize=1000`, {
      headers: { authorization: "Bearer system-secret" },
    })
    expect(clamped.status).toBe(200)

    const unauthorized = await app.request(`http://server.test/system/realms/${realm.id}/events`)
    expect(unauthorized.status).toBe(401)
    const body = (await unauthorized.json()) as { error: { code: string } }
    expect(body.error.code).toBe("events.unauthorized")
  })
})
