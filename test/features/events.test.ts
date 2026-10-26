import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { authorizationActorContextCreate } from "../../src/features/authorization/domain/authorizationActorContextCreate.js"
import { eventExport } from "../../src/features/events/actions/eventExport.js"
import { eventList } from "../../src/features/events/actions/eventList.js"
import { eventUserSubjectTable } from "../../src/features/events/persistence/eventUserSubjectTable.js"
import type { RealmTenantContext } from "../../src/features/realms/domain/realmTenantContext.js"
import { eventApiClientCreate } from "../../src/features/events/client/eventApiClientCreate.js"
import { eventListResponseSchema } from "../../src/features/events/public/eventListResponseSchema.js"
import { eventServerAppCreate } from "../../src/features/events/server/eventServerAppCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmBootstrapAdminCreate } from "../../src/features/realms/actions/realmBootstrapAdminCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { storageEventAppend } from "../../src/platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../src/platform/storage/storageTransactionRun.js"
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

    const granted = realmAdministratorGrant({
      context: realmSystemContextCreate(),
      database,
      realmId: alpha.id,
      userId: adminId,
    })
    expect(granted.success).toBe(true)
    if (!granted.success) return
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

function machineEventContext(realmId: string, scopes: readonly string[]): RealmTenantContext {
  const actor = authorizationActorContextCreate({
    actorId: "machine-worker",
    assurance: "authenticated",
    authenticationMethod: "api_key",
    kind: "machine",
    realmId,
    scopes: [...scopes],
  })
  return { actor, actorId: actor.actorId, kind: "tenant", realmId }
}

test("event listing requires the event read permission for machine credentials", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "events-machine-authz.example.com")
    createUser(database, realm.id, "authz-user")

    const denied = eventList({ context: machineEventContext(realm.id, []), database, realmId: realm.id })
    expect(denied.success).toBe(false)
    if (denied.success) return
    expect(denied.code).toBe("authorization.forbidden")

    const deniedExport = eventExport({ context: machineEventContext(realm.id, []), database, realmId: realm.id })
    expect(deniedExport.success).toBe(false)
    if (deniedExport.success) return
    expect(deniedExport.code).toBe("authorization.forbidden")

    const allowed = eventList({
      context: machineEventContext(realm.id, ["event.read"]),
      database,
      realmId: realm.id,
    })
    expect(allowed.success).toBe(true)

    const allowedExport = eventExport({
      context: machineEventContext(realm.id, ["event.read"]),
      database,
      realmId: realm.id,
    })
    expect(allowedExport.success).toBe(true)
  })
})

test("event listing and export filter, paginate, cap, and redact", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "events-filters.example.com")
    const subjectId = createUser(database, realm.id, "filter-subject")
    expect(subjectId).toBeString()
    if (subjectId === undefined) return
    const base = {
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: "filter-correlation",
      metadata: {},
      realmId: realm.id,
    }
    const first = storageEventAppend(database.db, {
      ...base,
      actorId: "actor-one",
      aggregateId: "aggregate-one",
      aggregateType: "filter_alpha",
      eventType: "filter.alpha.created",
      occurredAt: 1_000,
      payload: { password: "first-secret", visible: "first-visible" },
    })
    const second = storageEventAppend(database.db, {
      ...base,
      actorId: "actor-two",
      aggregateId: "aggregate-two",
      aggregateType: "filter_beta",
      correlationId: "filter-correlation-two",
      eventType: "filter.beta.created",
      occurredAt: 2_000,
      payload: { visible: "second-visible" },
    })
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success) return
    database.db
      .insert(eventUserSubjectTable)
      .values({
        category: "sessions",
        displayCode: "session.created",
        eventPosition: second.data.position,
        eventType: "filter.beta.created",
        realmId: realm.id,
        userId: subjectId,
      })
      .run()

    const system = realmSystemContextCreate()
    const filtered = eventList({
      context: system,
      database,
      query: { eventType: "filter.alpha.created" },
      realmId: realm.id,
    })
    expect(filtered.success).toBe(true)
    if (!filtered.success) return
    expect(filtered.data.items.map((event) => event.id)).toEqual([first.data.id])

    const combined = eventList({
      context: system,
      database,
      query: { actorId: "actor-two", aggregateType: "filter_beta", occurredFrom: 1_500, occurredTo: 2_500 },
      realmId: realm.id,
    })
    expect(combined.success).toBe(true)
    if (!combined.success) return
    expect(combined.data.items.map((event) => event.id)).toEqual([second.data.id])

    const bySubject = eventList({
      context: system,
      database,
      query: { userSubjectId: subjectId },
      realmId: realm.id,
    })
    expect(bySubject.success).toBe(true)
    if (!bySubject.success) return
    expect(bySubject.data.items.map((event) => event.id)).toEqual([second.data.id])

    const byMissingSubject = eventList({
      context: system,
      database,
      query: { userSubjectId: "subject-missing" },
      realmId: realm.id,
    })
    expect(byMissingSubject.success).toBe(true)
    if (!byMissingSubject.success) return
    expect(byMissingSubject.data.items).toEqual([])

    const exported = eventExport({
      context: system,
      database,
      query: { aggregateId: "aggregate-one" },
      realmId: realm.id,
    })
    expect(exported.success).toBe(true)
    if (!exported.success) return
    expect(exported.data.truncated).toBe(false)
    expect(exported.data.items).toHaveLength(1)
    expect(exported.data.items[0]?.payload).toEqual({ password: "[REDACTED]", visible: "first-visible" })

    const listed = eventList({ context: system, database, realmId: realm.id })
    expect(listed.success).toBe(true)
    if (!listed.success) return
    const listedFirst = listed.data.items.find((event) => event.id === first.data.id)
    expect(listedFirst?.payload).toEqual({ password: "[REDACTED]", visible: "first-visible" })
  })
})

test("event export caps at ten thousand rows with a truncation flag", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "events-export-cap.example.com")
    const seeded = storageTransactionRun(database, (transaction) => {
      for (let index = 0; index < 10_050; index++) {
        const appended = storageEventAppend(transaction, {
          aggregateId: `aggregate-${index % 10}`,
          aggregateType: "probe",
          aggregateVersion: 1,
          commandIndex: 0,
          correlationId: "export-cap-correlation",
          eventType: "probe.event",
          metadata: {},
          occurredAt: index,
          payload: {},
          realmId: realm.id,
        })
        if (!appended.success) return appended
      }
      return resultCreate(undefined)
    })
    expect(seeded.success).toBe(true)
    if (!seeded.success) return

    const exported = eventExport({ context: realmSystemContextCreate(), database, realmId: realm.id })
    expect(exported.success).toBe(true)
    if (!exported.success) return
    expect(exported.data.truncated).toBe(true)
    expect(exported.data.items).toHaveLength(10_000)

    const filtered = eventExport({
      context: realmSystemContextCreate(),
      database,
      query: { aggregateId: "aggregate-0" },
      realmId: realm.id,
    })
    expect(filtered.success).toBe(true)
    if (!filtered.success) return
    expect(filtered.data.truncated).toBe(false)
    expect(filtered.data.items).toHaveLength(1_005)
    expect(filtered.data.items.every((event) => event.aggregateId === "aggregate-0")).toBe(true)
  })
})

test("event routes parse server-side filters and serve exports", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "events-route-filters.example.com")
    const appended = storageEventAppend(database.db, {
      aggregateId: "route-aggregate",
      aggregateType: "route",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: "route-correlation",
      eventType: "route.created",
      metadata: {},
      occurredAt: 5_000,
      payload: { token: "route-secret" },
      realmId: realm.id,
    })
    expect(appended.success).toBe(true)
    if (!appended.success) return

    const app = eventServerAppCreate({ database, systemSecret: "route-secret" })
    const filtered = await app.request(
      `http://server.test/system/realms/${realm.id}/events?eventType=route.created&aggregateType=route&aggregateId=route-aggregate&occurredFrom=1000&occurredTo=9000`,
      { headers: { authorization: "Bearer route-secret" } },
    )
    expect(filtered.status).toBe(200)
    const filteredBody = (await filtered.json()) as { items: Array<{ id: string }> }
    expect(filteredBody.items.map((event) => event.id)).toEqual([appended.data.id])

    const missing = await app.request(`http://server.test/system/realms/${realm.id}/events?eventType=route.missing`, {
      headers: { authorization: "Bearer route-secret" },
    })
    expect(missing.status).toBe(200)
    expect(((await missing.json()) as { items: unknown[] }).items).toEqual([])

    const invalid = await app.request(`http://server.test/system/realms/${realm.id}/events?occurredFrom=not-a-number`, {
      headers: { authorization: "Bearer route-secret" },
    })
    expect(invalid.status).toBe(400)

    const exported = await app.request(`http://server.test/system/realms/${realm.id}/events/export`, {
      headers: { authorization: "Bearer route-secret" },
    })
    expect(exported.status).toBe(200)
    const exportedBody = (await exported.json()) as { items: Array<{ payload: unknown }>; truncated: boolean }
    expect(exportedBody.truncated).toBe(false)
    expect(exportedBody.items).toContainEqual(expect.objectContaining({ payload: { token: "[REDACTED]" } }))

    const client = eventApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "route-secret",
    })
    const clientExport = await client.eventExport(realm.id, { eventType: "route.created" })
    expect(clientExport.success).toBe(true)
    if (!clientExport.success) return
    expect(clientExport.data.truncated).toBe(false)
    expect(clientExport.data.items).toHaveLength(1)
  })
})
