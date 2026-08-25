import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { userEmailChangeResend } from "../../src/features/users/actions/userEmailChangeResend.js"
import { userEmailChangeStart } from "../../src/features/users/actions/userEmailChangeStart.js"
import { userEmailChangeVerify } from "../../src/features/users/actions/userEmailChangeVerify.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userGet } from "../../src/features/users/actions/userGet.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const emailChangeSecret = "users-email-change-test-secret"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-users-email-change-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data, testkit)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function withDatabasePair<T>(
  operation: (
    first: StorageDatabase,
    second: StorageDatabase,
    testkit: ReturnType<typeof platformTestkitCreate>,
  ) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-users-email-change-pair-"))
  const testkit = platformTestkitCreate()
  const path = join(directory, "authworks.sqlite")
  const first = storageDatabaseOpen(path, testkit.runtime)
  expect(first.success).toBe(true)
  if (!first.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(first.errorMessage)
  }
  const second = storageDatabaseOpen(path, testkit.runtime)
  expect(second.success).toBe(true)
  if (!second.success) {
    first.data.close()
    await rm(directory, { force: true, recursive: true })
    throw new Error(second.errorMessage)
  }
  try {
    return await operation(first.data, second.data, testkit)
  } finally {
    first.data.close()
    second.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

async function runConcurrent<T>(count: number, operation: (index: number) => T): Promise<T[]> {
  return Promise.all(
    Array.from(
      { length: count },
      (_, index) =>
        new Promise<T>((resolve, reject) => {
          setTimeout(() => {
            try {
              resolve(operation(index))
            } catch (error) {
              reject(error)
            }
          }, 0)
        }),
    ),
  )
}

async function realmCreateForTest(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}

function userInput(userName: string, email: string) {
  return {
    email,
    profile: { displayName: userName },
    userName,
  }
}

async function activeUserCreate(database: StorageDatabase, realmId: string, userName: string, email: string) {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: userInput(userName, email),
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
  return created.data.user
}

async function sessionCreate(
  database: StorageDatabase,
  realmId: string,
  userId: string,
  testkit: ReturnType<typeof platformTestkitCreate>,
) {
  const issued = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    realmId,
    runtime: testkit.runtime,
    userId,
  })
  expect(issued.success).toBe(true)
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data
}

test("email changes keep the old address active until a verified, atomic replacement", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await realmCreateForTest(database, "email-change-flow.example.com")
    const user = await activeUserCreate(database, realm.id, "email-change-user", "old@example.com")
    const session = (await sessionCreate(database, realm.id, user.id, testkit)).session
    const context = realmTenantContextCreate(realm.id, user.id)
    const deliveries: { email: string; token: string }[] = []
    const notifications: { email: string; newEmail: string; realmId: string; userId: string }[] = []

    expect(
      userEmailChangeStart({
        context,
        database,
        input: { email: " old@example.com " },
        rateLimitSecret: emailChangeSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.conflict", success: false })

    const started = userEmailChangeStart({
      context,
      database,
      input: { email: "New@Example.com" },
      onDelivery: (delivery) => {
        deliveries.push({ email: delivery.email, token: delivery.token })
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.email).toBe("new@example.com")
    expect(
      userGet({ context: realmSystemContextCreate("system"), database, realmId: realm.id, userId: user.id }),
    ).toMatchObject({
      data: { user: { email: "old@example.com" } },
      success: true,
    })

    const immediateResend = userEmailChangeResend({
      context,
      database,
      input: { challengeId: started.data.challengeId, email: "new@example.com" },
      onDelivery: (delivery) => {
        deliveries.push({ email: delivery.email, token: delivery.token })
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(immediateResend).toMatchObject({ data: { challengeId: started.data.challengeId }, success: true })
    expect(deliveries).toHaveLength(1)

    testkit.advance(60_001)
    const resent = userEmailChangeResend({
      context,
      database,
      input: { challengeId: started.data.challengeId, email: "new@example.com" },
      onDelivery: (delivery) => {
        deliveries.push({ email: delivery.email, token: delivery.token })
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(resent.success).toBe(true)
    if (!resent.success) return
    expect(resent.data.challengeId).not.toBe(started.data.challengeId)
    expect(deliveries).toHaveLength(2)

    const oldToken = userEmailChangeVerify({
      context,
      database,
      input: { challengeId: started.data.challengeId, token: deliveries[0]?.token ?? "" },
      onNotification: (notification) => {
        notifications.push(notification)
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(oldToken).toMatchObject({ code: "users.invalid", success: false })

    const verified = userEmailChangeVerify({
      context,
      database,
      input: { challengeId: resent.data.challengeId, token: deliveries[1]?.token ?? "" },
      onNotification: (notification) => {
        notifications.push(notification)
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(verified).toMatchObject({ data: { user: { email: "new@example.com", emailVerified: true } }, success: true })
    expect(notifications).toEqual([
      {
        email: "old@example.com",
        newEmail: "new@example.com",
        realmId: realm.id,
        userId: user.id,
      },
    ])

    const replay = userEmailChangeVerify({
      context,
      database,
      input: { challengeId: resent.data.challengeId, token: deliveries[1]?.token ?? "" },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(replay).toMatchObject({ code: "users.invalid", success: false })

    const events = database.db.select().from(storageEventTable).all()
    const emailEvents = events.filter((event) => event.eventType.startsWith("user.email_change"))
    expect(emailEvents.map((event) => event.eventType)).toEqual([
      userEventTypes.emailChangeRequested,
      userEventTypes.emailChangeRequested,
      userEventTypes.emailChangeVerified,
      userEventTypes.emailChanged,
    ])
    const serialized = JSON.stringify(emailEvents)
    expect(serialized).not.toContain("old@example.com")
    expect(serialized).not.toContain("new@example.com")
    expect(serialized).not.toContain(deliveries[1]?.token ?? "")
  })
})

test("email change rejects expiry, conflicts, stale sessions, tenant mismatches, and excessive requests", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await realmCreateForTest(database, "email-change-security.example.com")
    const otherRealm = await realmCreateForTest(database, "email-change-other.example.com")
    const user = await activeUserCreate(database, realm.id, "email-security-user", "security-old@example.com")
    const session = (await sessionCreate(database, realm.id, user.id, testkit)).session
    const context = realmTenantContextCreate(realm.id, user.id)

    const started = userEmailChangeStart({
      context,
      database,
      input: { email: "security-new@example.com" },
      onDelivery: () => undefined,
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    testkit.advance(10 * 60_000 + 1)
    const freshSession = (await sessionCreate(database, realm.id, user.id, testkit)).session
    const expired = userEmailChangeVerify({
      context,
      database,
      input: { challengeId: started.data.challengeId, token: "x".repeat(43) },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session: freshSession,
      userId: user.id,
    })
    expect(expired).toMatchObject({ code: "users.invalid", success: false })
    const expiredEvent = database.db.select().from(storageEventTable).all().at(-1)
    expect(expiredEvent?.eventType).toBe(userEventTypes.emailChangeFailed)
    expect(expiredEvent?.payload).toEqual({ reason: "expired" })
    expect(JSON.stringify(expiredEvent?.payload)).not.toContain(started.data.challengeId)
    expect(JSON.stringify(expiredEvent?.payload)).not.toContain("x".repeat(43))

    const mismatched = userEmailChangeStart({
      context: realmTenantContextCreate(otherRealm.id, user.id),
      database,
      input: { email: "wrong-tenant@example.com" },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      session,
      userId: user.id,
    })
    expect(mismatched).toMatchObject({ code: "users.forbidden", success: false })

    const stale = userEmailChangeStart({
      context,
      database,
      input: { email: "stale@example.com" },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(stale).toMatchObject({ code: "users.unauthorized", success: false })

    for (const index of [0, 1, 2, 3, 4]) {
      expect(
        userEmailChangeStart({
          context,
          database,
          input: { email: `limit-${index}@example.com` },
          rateLimitSecret: emailChangeSecret,
          realmId: realm.id,
          runtime: testkit.runtime,
          session: freshSession,
          userId: user.id,
        }).success,
      ).toBe(true)
    }
    expect(
      userEmailChangeStart({
        context,
        database,
        input: { email: "limit-4@example.com" },
        rateLimitSecret: emailChangeSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: freshSession,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.rate-limited", success: false })
  })
})

test("email replacement rejects an address claimed during the pending challenge and rolls back consumption", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await realmCreateForTest(database, "email-change-atomic.example.com")
    const user = await activeUserCreate(database, realm.id, "email-atomic-user", "atomic-old@example.com")
    const session = (await sessionCreate(database, realm.id, user.id, testkit)).session
    const context = realmTenantContextCreate(realm.id, user.id)
    let token = ""
    const started = userEmailChangeStart({
      context,
      database,
      input: { email: "atomic-new@example.com" },
      onDelivery: (delivery) => {
        token = delivery.token
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return

    const claimed = await activeUserCreate(database, realm.id, "email-claiming-user", "atomic-new@example.com")
    const concurrent = userEmailChangeVerify({
      context,
      database,
      input: { challengeId: started.data.challengeId, token },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(concurrent).toMatchObject({ code: "users.conflict", success: false })
    expect(
      userGet({ context: realmSystemContextCreate("system"), database, realmId: realm.id, userId: user.id }),
    ).toMatchObject({
      data: { user: { email: "atomic-old@example.com" } },
      success: true,
    })
    expect(claimed.email).toBe("atomic-new@example.com")
    const challenge = database.sqlite
      .query("SELECT consumed_at AS consumedAt FROM user_email_change_challenges WHERE id = ?")
      .get(started.data.challengeId) as { consumedAt: number | null } | null
    expect(challenge?.consumedAt).toBeNull()
  })
})

test("verification throttling spans replacement challenges and denied dimensions remain unconsumed", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await realmCreateForTest(database, "email-change-throttle.example.com")
    const user = await activeUserCreate(database, realm.id, "email-throttle-user", "throttle-old@example.com")
    const session = (await sessionCreate(database, realm.id, user.id, testkit)).session
    const context = realmTenantContextCreate(realm.id, user.id)
    let firstToken = ""
    let replacementToken = ""
    const first = userEmailChangeStart({
      context,
      database,
      input: { email: "throttle-first@example.com" },
      onDelivery: (delivery) => {
        firstToken = delivery.token
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        userEmailChangeVerify({
          context,
          database,
          input: { challengeId: first.data.challengeId, token: "x".repeat(43) },
          rateLimitSecret: emailChangeSecret,
          realmId: realm.id,
          runtime: testkit.runtime,
          session,
          userId: user.id,
        }),
      ).toMatchObject({ code: "users.invalid", success: false })
    }

    const replacement = userEmailChangeStart({
      context,
      database,
      input: { email: "throttle-replacement@example.com" },
      onDelivery: (delivery) => {
        replacementToken = delivery.token
      },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(replacement.success).toBe(true)
    if (!replacement.success) return

    expect(
      userEmailChangeVerify({
        context,
        database,
        input: { challengeId: replacement.data.challengeId, token: "y".repeat(43) },
        rateLimitSecret: emailChangeSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.rate-limited", success: false })

    const rateLimits = database.sqlite
      .query("SELECT scope, count FROM rate_limits WHERE scope LIKE 'users.email_change.verify.%' ORDER BY scope")
      .all() as Array<{ count: number; scope: string }>
    expect(rateLimits).toEqual([
      { count: 5, scope: "users.email_change.verify.account" },
      { count: 5, scope: "users.email_change.verify.identifier" },
      { count: 5, scope: "users.email_change.verify.ip" },
      { count: 5, scope: "users.email_change.verify.user" },
    ])

    const replacementChallenge = database.sqlite
      .query("SELECT attempts FROM user_email_change_challenges WHERE id = ?")
      .get(replacement.data.challengeId) as { attempts: number } | null
    expect(replacementChallenge?.attempts).toBe(0)

    const failedEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.eventType === userEventTypes.emailChangeFailed)
    expect(failedEvents).toHaveLength(5)
    expect(failedEvents.map((event) => event.payload)).toEqual(
      Array.from({ length: 5 }, () => ({ reason: "invalid_token" })),
    )
    expect(JSON.stringify(failedEvents.map((event) => event.payload))).not.toContain(firstToken)
    expect(JSON.stringify(failedEvents.map((event) => event.payload))).not.toContain(replacementToken)

    testkit.advance(60_001)
    expect(
      userEmailChangeVerify({
        context,
        database,
        input: { challengeId: first.data.challengeId, token: firstToken },
        rateLimitSecret: emailChangeSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.invalid", success: false })
    expect(
      database.db
        .select()
        .from(storageEventTable)
        .all()
        .filter((event) => event.eventType === userEventTypes.emailChangeFailed),
    ).toHaveLength(5)
  })
})

test("concurrent email-change starts consume one account budget and leave one active replacement", async () => {
  await withDatabasePair(async (firstDatabase, secondDatabase, testkit) => {
    const realm = await realmCreateForTest(firstDatabase, "email-change-concurrent-start.example.com")
    const user = await activeUserCreate(
      firstDatabase,
      realm.id,
      "email-concurrent-start",
      "concurrent-start-old@example.com",
    )
    const session = (await sessionCreate(firstDatabase, realm.id, user.id, testkit)).session
    const context = realmTenantContextCreate(realm.id, user.id)
    const results = await runConcurrent(6, (index) =>
      userEmailChangeStart({
        context,
        database: index % 2 === 0 ? firstDatabase : secondDatabase,
        input: { email: `concurrent-start-${index}@example.com` },
        rateLimitSecret: emailChangeSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session,
        userId: user.id,
      }),
    )
    expect(results.filter((result) => result.success)).toHaveLength(5)
    expect(results.filter((result) => !result.success && result.code === "users.rate-limited")).toHaveLength(1)
    expect(
      firstDatabase.sqlite
        .query("SELECT count FROM rate_limits WHERE scope = 'users.email_change.start.user'")
        .get() as {
        count: number
      } | null,
    ).toEqual({ count: 5 })
    expect(
      firstDatabase.sqlite
        .query("SELECT count(*) AS count FROM user_email_change_challenges WHERE consumed_at IS NULL")
        .get() as { count: number },
    ).toEqual({ count: 1 })
  })
})

test("concurrent email-change resends create one replacement and retain challenge throttles", async () => {
  await withDatabasePair(async (firstDatabase, secondDatabase, testkit) => {
    const realm = await realmCreateForTest(firstDatabase, "email-change-concurrent-resend.example.com")
    const user = await activeUserCreate(
      firstDatabase,
      realm.id,
      "email-concurrent-resend",
      "concurrent-resend-old@example.com",
    )
    const session = (await sessionCreate(firstDatabase, realm.id, user.id, testkit)).session
    const context = realmTenantContextCreate(realm.id, user.id)
    const email = "concurrent-resend-new@example.com"
    const started = userEmailChangeStart({
      context,
      database: firstDatabase,
      input: { email },
      rateLimitSecret: emailChangeSecret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session,
      userId: user.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    testkit.advance(60_001)

    const results = await runConcurrent(5, (index) =>
      userEmailChangeResend({
        context,
        database: index % 2 === 0 ? firstDatabase : secondDatabase,
        input: { challengeId: started.data.challengeId, email },
        rateLimitSecret: emailChangeSecret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session,
        userId: user.id,
      }),
    )
    expect(results.filter((result) => result.success)).toHaveLength(1)
    expect(results.filter((result) => !result.success && result.code === "users.invalid")).toHaveLength(4)
    expect(
      firstDatabase.sqlite
        .query("SELECT count(*) AS count FROM user_email_change_challenges WHERE consumed_at IS NULL")
        .get() as { count: number },
    ).toEqual({ count: 1 })
    expect(
      firstDatabase.sqlite.query("SELECT count(*) AS count FROM user_email_change_challenges").get() as {
        count: number
      },
    ).toEqual({ count: 2 })
    expect(
      firstDatabase.sqlite
        .query("SELECT count FROM rate_limits WHERE scope = 'users.email_change.resend.user'")
        .get() as {
        count: number
      } | null,
    ).toEqual({ count: 1 })
  })
})

test("email-change routes and the public client keep the session subject and delivery boundary", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await realmCreateForTest(database, "email-change-api.example.com")
    const user = await activeUserCreate(database, realm.id, "email-api-user", "api-old@example.com")
    const issued = await sessionCreate(database, realm.id, user.id, testkit)
    const session = issued.session
    const deliveries: { email: string; token: string }[] = []
    const notifications: { email: string; newEmail: string; realmId: string; userId: string }[] = []
    const app = userServerAppCreate({
      database,
      onEmailChangeDelivery: (delivery) => {
        deliveries.push({ email: delivery.email, token: delivery.token })
      },
      onEmailChangeNotification: (notification) => {
        notifications.push(notification)
      },
      publicOrigin: "https://email-change-api.example.com",
      systemSecret: emailChangeSecret,
    })
    const client = userApiClientCreate({
      baseUrl: "https://email-change-api.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issued.token,
    })

    const started = await client.userMeEmailChangeStart(realm.id, { email: "api-new@example.com" })
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(deliveries[0]?.email).toBe("api-new@example.com")
    const verified = await client.userMeEmailChangeVerify(realm.id, {
      challengeId: started.data.challengeId,
      token: deliveries[0]?.token ?? "",
    })
    expect(verified).toMatchObject({ data: { user: { email: "api-new@example.com" } }, success: true })
    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.email).toBe("api-old@example.com")
  })
})

test("email-change mutation routes enforce CSRF and same-origin browser requests", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await realmCreateForTest(database, "email-change-route-security.example.com")
    const user = await activeUserCreate(database, realm.id, "email-route-security", "route-security-old@example.com")
    const issued = await sessionCreate(database, realm.id, user.id, testkit)
    const origin = "https://email-change-route-security.example.com"
    const app = userServerAppCreate({ database, publicOrigin: origin, systemSecret: emailChangeSecret })
    const cookie = `session=${issued.token}`
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const endpoints = [
      `/realms/${realm.id}/me/email-change/start`,
      `/realms/${realm.id}/me/email-change/resend`,
      `/realms/${realm.id}/me/email-change/verify`,
    ]

    for (const endpoint of endpoints) {
      const missingOrigin = await app.request(`${origin}${endpoint}`, {
        body: "{}",
        headers: { cookie, "content-type": "application/json" },
        method: "POST",
      })
      expect(missingOrigin.status).toBe(403)
      const wrongOrigin = await app.request(`${origin}${endpoint}`, {
        body: "{}",
        headers: {
          cookie: `${cookie}; csrf=${csrf}`,
          "content-type": "application/json",
          origin: "https://evil.example.com",
          "x-csrf-token": csrf,
        },
        method: "POST",
      })
      expect(wrongOrigin.status).toBe(403)
      const wrongCsrf = await app.request(`${origin}${endpoint}`, {
        body: "{}",
        headers: {
          cookie: `${cookie}; csrf=${csrf}`,
          "content-type": "application/json",
          origin,
          "x-csrf-token": "wrong",
        },
        method: "POST",
      })
      expect(wrongCsrf.status).toBe(403)
    }

    let token = ""
    const deliveries: { token: string }[] = []
    const deliveryApp = userServerAppCreate({
      database,
      onEmailChangeDelivery: (delivery) => {
        token = delivery.token
        deliveries.push({ token: delivery.token })
      },
      publicOrigin: origin,
      systemSecret: emailChangeSecret,
    })
    const validHeaders = {
      cookie: `${cookie}; csrf=${csrf}`,
      "content-type": "application/json",
      origin,
      "x-csrf-token": csrf,
    }
    const started = await deliveryApp.request(`${origin}/realms/${realm.id}/me/email-change/start`, {
      body: JSON.stringify({ email: "route-security-new@example.com" }),
      headers: validHeaders,
      method: "POST",
    })
    expect(started.status).toBe(200)
    const startedBody = (await started.json()) as { challengeId: string }
    const resent = await deliveryApp.request(`${origin}/realms/${realm.id}/me/email-change/resend`, {
      body: JSON.stringify({ challengeId: startedBody.challengeId, email: "route-security-new@example.com" }),
      headers: validHeaders,
      method: "POST",
    })
    expect(resent.status).toBe(200)
    const verified = await deliveryApp.request(`${origin}/realms/${realm.id}/me/email-change/verify`, {
      body: JSON.stringify({ challengeId: startedBody.challengeId, token }),
      headers: validHeaders,
      method: "POST",
    })
    expect(verified.status).toBe(200)
    expect(deliveries).toHaveLength(1)
  })
})

test("email-change rate limits return HTTP 429 and Retry-After", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await realmCreateForTest(database, "email-change-rate-limit-route.example.com")
    const user = await activeUserCreate(
      database,
      realm.id,
      "email-rate-limit-route",
      "rate-limit-route-old@example.com",
    )
    const issued = await sessionCreate(database, realm.id, user.id, testkit)
    const origin = "https://email-change-rate-limit-route.example.com"
    const app = userServerAppCreate({
      clientIpResolve: () => "192.0.2.10",
      database,
      publicOrigin: origin,
      systemSecret: emailChangeSecret,
    })
    const headers = { authorization: `Bearer ${issued.token}`, "content-type": "application/json" }
    const rateLimitedAssert = async (response: Response) => {
      expect(response.status).toBe(429)
      const retryAfter = response.headers.get("retry-after")
      expect(retryAfter).toMatch(/^[1-9][0-9]*$/)
      const body = (await response.json()) as {
        error: { code: string; details?: { retryAfterSeconds?: number }; retryable?: boolean; status?: number }
      }
      expect(body.error.code).toBe("rate_limited")
      expect(body.error.retryable).toBe(true)
      expect(body.error.status).toBe(429)
      expect(body.error.details?.retryAfterSeconds).toBe(Number(retryAfter))
    }
    let challengeId = ""
    for (let index = 0; index < 5; index += 1) {
      const accepted = await app.request(`${origin}/realms/${realm.id}/me/email-change/start`, {
        body: JSON.stringify({ email: `rate-limit-route-${index}@example.com` }),
        headers,
        method: "POST",
      })
      expect(accepted.status).toBe(200)
      challengeId = ((await accepted.json()) as { challengeId: string }).challengeId
    }
    const limited = await app.request(`${origin}/realms/${realm.id}/me/email-change/start`, {
      body: JSON.stringify({ email: "rate-limit-route-sixth@example.com" }),
      headers,
      method: "POST",
    })
    await rateLimitedAssert(limited)

    for (let index = 0; index < 5; index += 1) {
      const accepted = await app.request(`${origin}/realms/${realm.id}/me/email-change/resend`, {
        body: JSON.stringify({ challengeId, email: "rate-limit-route-4@example.com" }),
        headers,
        method: "POST",
      })
      expect(accepted.status).toBe(200)
    }
    await rateLimitedAssert(
      await app.request(`${origin}/realms/${realm.id}/me/email-change/resend`, {
        body: JSON.stringify({ challengeId, email: "rate-limit-route-4@example.com" }),
        headers,
        method: "POST",
      }),
    )

    for (let index = 0; index < 5; index += 1) {
      const failed = await app.request(`${origin}/realms/${realm.id}/me/email-change/verify`, {
        body: JSON.stringify({ challengeId, token: "z".repeat(43) }),
        headers,
        method: "POST",
      })
      expect(failed.status).toBe(400)
    }
    await rateLimitedAssert(
      await app.request(`${origin}/realms/${realm.id}/me/email-change/verify`, {
        body: JSON.stringify({ challengeId, token: "z".repeat(43) }),
        headers,
        method: "POST",
      }),
    )
  })
})
