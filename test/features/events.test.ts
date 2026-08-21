import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { eventList } from "../../src/features/events/actions/eventList.js"
import { eventApiClientCreate } from "../../src/features/events/client/eventApiClientCreate.js"
import { eventListResponseSchema } from "../../src/features/events/public/eventListResponseSchema.js"
import { eventServerAppCreate } from "../../src/features/events/server/eventServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../src/platform/storage/storageEventAppend.js"
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
  if (!created.success) return undefined
  return created.data.user.id
}

function createActiveUser(database: StorageDatabase, realmId: string, userName: string) {
  const userId = createUser(database, realmId, userName)
  expect(userId).toBeString()
  if (userId === undefined) return undefined
  const activated = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId,
    userId,
  })
  expect(activated.success).toBe(true)
  return userId
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

    const bootstrap = realmBootstrapAdminCreate({
      context: realmSystemContextCreate(),
      database,
      realmId: realm.id,
    })
    expect(bootstrap.success).toBe(true)
    if (!bootstrap.success) return
    const tenantBearer = await app.request(`http://events-api.example.com/realms/${realm.id}/events`, {
      headers: { authorization: `Bearer ${bootstrap.data.bootstrapAdmin.secret.valueGet()}` },
    })
    expect(tenantBearer.status).toBe(200)

    const unauthorized = await app.request(`http://server.test/system/realms/${realm.id}/events`)
    expect(unauthorized.status).toBe(401)
    const body = (await unauthorized.json()) as { error: { code: string } }
    expect(body.error.code).toBe("events.unauthorized")
  })
})

test("tenant event listing authenticates browser sessions, enforces permissions, isolates realms, and redacts payloads", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "events-tenant-alpha.example.com")
    const beta = await createRealm(database, "events-tenant-beta.example.com")
    const adminId = createActiveUser(database, alpha.id, "events-admin")
    const memberId = createActiveUser(database, alpha.id, "events-member")
    expect(adminId).toBeString()
    expect(memberId).toBeString()
    if (adminId === undefined || memberId === undefined) return

    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Events administrators", ownerUserId: adminId },
      realmId: alpha.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const membership = organizationMembershipCreate({
      context: realmSystemContextCreate(),
      database,
      input: { roles: ["member"], userId: memberId },
      organizationId: organization.data.organization.id,
      realmId: alpha.id,
    })
    expect(membership.success).toBe(true)
    if (!membership.success) return

    const appended = storageEventAppend(database.db, {
      aggregateId: "sensitive-audit-event",
      aggregateType: "test",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: "sensitive-audit-correlation",
      eventType: "test.sensitive",
      metadata: { safe: "metadata-visible", secret: "metadata-secret" },
      payload: {
        nested: { token: "nested-secret", visible: "payload-visible" },
        password: "password-secret",
      },
      realmId: alpha.id,
    })
    expect(appended.success).toBe(true)

    const adminSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      userId: adminId,
    })
    const memberSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      userId: memberId,
    })
    expect(adminSession.success).toBe(true)
    expect(memberSession.success).toBe(true)
    if (!adminSession.success || !memberSession.success) return

    const app = eventServerAppCreate({ database })
    const cookieResponse = await app.request(`http://server.test/realms/${alpha.id}/events?pageSize=1`, {
      headers: { cookie: `session=${adminSession.data.token}` },
    })
    expect(cookieResponse.status).toBe(200)
    const cookiePage = (await cookieResponse.json()) as { items: Array<{ payload: unknown }>; nextPageToken?: string }
    expect(cookiePage.items).toHaveLength(1)
    expect(cookiePage.nextPageToken).toBeString()

    const anonymous = await app.request(`http://server.test/realms/${alpha.id}/events`)
    expect(anonymous.status).toBe(401)

    const denied = await app.request(`http://server.test/realms/${alpha.id}/events`, {
      headers: { authorization: `Bearer ${memberSession.data.token}` },
    })
    expect(denied.status).toBe(403)
    expect((await denied.json()).error.code).toBe("authorization.forbidden")

    const crossRealm = await app.request(`http://server.test/realms/${beta.id}/events`, {
      headers: { authorization: `Bearer ${adminSession.data.token}` },
    })
    expect(crossRealm.status).toBe(401)

    const tenantClient = eventApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: adminSession.data.token,
    })
    const allEvents: Array<{ metadata: unknown; payload: unknown }> = []
    let pageToken: string | undefined
    do {
      const page = await tenantClient.eventTenantList(alpha.id, {
        pageSize: 1,
        pageToken,
        sortBy: "id",
        sortDirection: "asc",
      })
      expect(page.success).toBe(true)
      if (!page.success) return
      allEvents.push(...page.data.items)
      pageToken = page.data.nextPageToken
    } while (pageToken !== undefined)

    expect(allEvents.length).toBeGreaterThan(1)
    const sensitive = allEvents.find((event) => JSON.stringify(event.payload).includes("payload-visible"))
    expect(sensitive).toBeDefined()
    if (sensitive === undefined) return
    expect(JSON.stringify(sensitive)).not.toContain("password-secret")
    expect(JSON.stringify(sensitive)).not.toContain("nested-secret")
    expect(sensitive.payload).toEqual({
      nested: { token: "[REDACTED]", visible: "payload-visible" },
      password: "[REDACTED]",
    })
    expect(sensitive.metadata).toEqual({ safe: "metadata-visible", secret: "[REDACTED]" })
  })
})
