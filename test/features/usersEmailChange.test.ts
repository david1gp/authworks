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
    expect(database.db.select().from(storageEventTable).all().at(-1)?.eventType).toBe(userEventTypes.emailChangeFailed)

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
