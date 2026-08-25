import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userEmailAddressAddResend } from "../../src/features/users/actions/userEmailAddressAddResend.js"
import { userEmailAddressAddStart } from "../../src/features/users/actions/userEmailAddressAddStart.js"
import { userEmailAddressAddVerify } from "../../src/features/users/actions/userEmailAddressAddVerify.js"
import { userEmailAddressList } from "../../src/features/users/actions/userEmailAddressList.js"
import { userEmailAddressPrimarySet } from "../../src/features/users/actions/userEmailAddressPrimarySet.js"
import { userEmailAddressRemove } from "../../src/features/users/actions/userEmailAddressRemove.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userEmailRepositoryCreate } from "../../src/features/users/persistence/userEmailRepositoryCreate.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const secret = "user-email-address-test-secret"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-email-address-"))
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

async function fixture(database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain: "user-email-address.example.com", name: "user-email-address" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email: "primary@example.com", profile: { displayName: "Email User" }, userName: "email-user" },
    realmId: realm.data.realm.id,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const active = userLifecycleSet({
    context: realmSystemContextCreate("system"),
    database,
    input: { state: "active" },
    realmId: realm.data.realm.id,
    userId: created.data.user.id,
  })
  expect(active.success).toBe(true)
  if (!active.success) throw new Error(active.errorMessage)
  const session = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    realmId: realm.data.realm.id,
    runtime: testkit.runtime,
    userId: created.data.user.id,
  })
  expect(session.success).toBe(true)
  if (!session.success) throw new Error(session.errorMessage)
  return { realm: realm.data.realm, session: session.data, user: created.data.user }
}

test("current-user email addresses support verified secondary lifecycle and safe events", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm, session, user } = await fixture(database, testkit)
    const context = realmTenantContextCreate(realm.id, user.id)
    const deliveries: { token: string }[] = []
    expect(
      userEmailAddressAddStart({
        context,
        database,
        input: { email: "unauthorized@example.com" },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.unauthorized", success: false })
    const started = userEmailAddressAddStart({
      context,
      database,
      input: { email: " secondary@example.com " },
      onDelivery: (delivery) => {
        deliveries.push({ token: delivery.token })
      },
      rateLimitSecret: secret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session: session.session,
      userId: user.id,
    })
    expect(started).toMatchObject({ data: { accepted: true }, success: true })
    expect(deliveries).toHaveLength(1)
    if (!started.success) return

    const pending = userEmailAddressList({ context, database, realmId: realm.id, userId: user.id })
    expect(pending).toMatchObject({
      data: {
        items: [
          { email: "primary@example.com", isPrimary: true },
          { email: "secondary@example.com", verifiedAt: null },
        ],
      },
      success: true,
    })
    expect(
      userEmailAddressAddStart({
        context,
        database,
        input: { email: "secondary@example.com" },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: session.session,
        userId: user.id,
      }),
    ).toMatchObject({ data: { challengeId: started.data.challengeId }, success: true })
    expect(deliveries).toHaveLength(1)

    testkit.advance(60_001)
    const resent = userEmailAddressAddResend({
      context,
      database,
      input: { challengeId: started.data.challengeId, email: "secondary@example.com" },
      onDelivery: (delivery) => {
        deliveries.push({ token: delivery.token })
      },
      rateLimitSecret: secret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session: session.session,
      userId: user.id,
    })
    expect(resent.success).toBe(true)
    if (!resent.success) return
    expect(deliveries).toHaveLength(2)
    expect(
      userEmailAddressAddVerify({
        context,
        database,
        input: { challengeId: resent.data.challengeId, token: "x".repeat(43) },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: session.session,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.invalid", success: false })
    const verified = userEmailAddressAddVerify({
      context,
      database,
      input: { challengeId: resent.data.challengeId, token: deliveries[1]?.token ?? "" },
      rateLimitSecret: secret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session: session.session,
      userId: user.id,
    })
    expect(verified).toMatchObject({
      data: { email: { email: "secondary@example.com", verifiedAt: testkit.runtime.now() } },
      success: true,
    })
    if (!verified.success) return

    const listed = userEmailAddressList({ context, database, realmId: realm.id, userId: user.id })
    expect(listed).toMatchObject({
      data: { items: [{ isPrimary: true }, { email: "secondary@example.com", verifiedAt: testkit.runtime.now() }] },
      success: true,
    })
    const secondary = listed.success
      ? listed.data.items.find((email) => email.email === "secondary@example.com")
      : undefined
    expect(secondary).toBeDefined()
    if (secondary === undefined) return
    const beforePromotion = database.sqlite
      .query("SELECT updated_at, version FROM users WHERE id = ?")
      .get(user.id) as { updated_at: number; version: number }
    const promoted = userEmailAddressPrimarySet({
      context,
      database,
      emailId: secondary.id,
      input: { expectedVersion: secondary.version },
      realmId: realm.id,
      runtime: testkit.runtime,
      session: session.session,
      userId: user.id,
    })
    expect(promoted).toMatchObject({
      data: { email: { email: "secondary@example.com", isPrimary: true } },
      success: true,
    })
    expect(database.sqlite.query("SELECT updated_at, version FROM users WHERE id = ?").get(user.id)).toEqual({
      updated_at: testkit.runtime.now(),
      version: beforePromotion.version + 1,
    })
    expect(database.sqlite.query("SELECT email FROM users WHERE id = ?").get(user.id)).toEqual({
      email: "secondary@example.com",
    })

    const primary = userEmailAddressList({ context, database, realmId: realm.id, userId: user.id })
    expect(primary.success).toBe(true)
    if (!primary.success) return
    const old = primary.data.items.find((email) => email.email === "primary@example.com")
    const currentPrimary = primary.data.items.find((email) => email.isPrimary)
    expect(old).toBeDefined()
    expect(currentPrimary).toBeDefined()
    if (old === undefined || currentPrimary === undefined) return
    expect(
      userEmailAddressRemove({
        context,
        database,
        emailId: currentPrimary.id,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: session.session,
        userId: user.id,
      }),
    ).toMatchObject({ code: "users.conflict", success: false })
    expect(
      userEmailAddressRemove({
        context,
        database,
        emailId: old.id,
        expectedVersion: old.version,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: session.session,
        userId: user.id,
      }),
    ).toEqual({ data: { removed: true }, success: true })

    const eventTypes = database.db
      .select()
      .from(storageEventTable)
      .all()
      .map((event) => event.eventType)
    expect(eventTypes).toContain(userEventTypes.emailAddressAdded)
    expect(eventTypes).toContain(userEventTypes.emailAddressVerificationRequested)
    expect(eventTypes).toContain(userEventTypes.emailAddressVerificationFailed)
    expect(eventTypes).toContain(userEventTypes.emailAddressVerified)
    expect(eventTypes).toContain(userEventTypes.emailAddressPrimarySet)
    expect(eventTypes).toContain(userEventTypes.emailAddressRemoved)
    const serialized = JSON.stringify(database.db.select().from(storageEventTable).all())
    expect(serialized).not.toContain("secondary@example.com")
    expect(serialized).not.toContain(deliveries[1]?.token ?? "")
  })
})

test("pending email addresses do not reserve verified addresses and expire cleanly", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm, session, user } = await fixture(database, testkit)
    const secondCreated = userCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { email: "second-primary@example.com", profile: { displayName: "Second User" }, userName: "second-user" },
      realmId: realm.id,
    })
    expect(secondCreated.success).toBe(true)
    if (!secondCreated.success) return
    expect(
      userLifecycleSet({
        context: realmSystemContextCreate("system"),
        database,
        input: { state: "active" },
        realmId: realm.id,
        userId: secondCreated.data.user.id,
      }).success,
    ).toBe(true)
    const secondSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: secondCreated.data.user.id,
    })
    expect(secondSession.success).toBe(true)
    if (!secondSession.success) return

    let firstToken = ""
    const firstStarted = userEmailAddressAddStart({
      context: realmTenantContextCreate(realm.id, user.id),
      database,
      input: { email: "shared@example.com" },
      onDelivery: ({ token }) => {
        firstToken = token
      },
      rateLimitSecret: secret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session: session.session,
      userId: user.id,
    })
    expect(firstStarted).toMatchObject({ data: { accepted: true }, success: true })

    let secondToken = ""
    const secondStarted = userEmailAddressAddStart({
      context: realmTenantContextCreate(realm.id, secondCreated.data.user.id),
      database,
      input: { email: "shared@example.com" },
      onDelivery: ({ token }) => {
        secondToken = token
      },
      rateLimitSecret: secret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session: secondSession.data.session,
      userId: secondCreated.data.user.id,
    })
    expect(secondStarted).toMatchObject({ data: { accepted: true }, success: true })
    if (!secondStarted.success) return
    expect(
      userEmailAddressAddVerify({
        context: realmTenantContextCreate(realm.id, secondCreated.data.user.id),
        database,
        input: { challengeId: secondStarted.data.challengeId, token: secondToken },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: secondSession.data.session,
        userId: secondCreated.data.user.id,
      }).success,
    ).toBe(true)
    expect(
      userEmailAddressAddVerify({
        context: realmTenantContextCreate(realm.id, user.id),
        database,
        input: { challengeId: firstStarted.success ? firstStarted.data.challengeId : "", token: firstToken },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: session.session,
        userId: user.id,
      }).success,
    ).toBe(false)
    expect(
      userEmailRepositoryCreate(database.db).userEmailGetByUserAddress(realm.id, user.id, "shared@example.com"),
    ).toEqual({ data: null, success: true })
    expect(
      userEmailAddressAddStart({
        context: realmTenantContextCreate(realm.id, user.id),
        database,
        input: { email: "shared@example.com" },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: session.session,
        userId: user.id,
      }),
    ).toMatchObject({ data: { accepted: true }, success: true })

    let expiringToken = ""
    const expiring = userEmailAddressAddStart({
      context: realmTenantContextCreate(realm.id, user.id),
      database,
      input: { email: "expiring@example.com" },
      onDelivery: ({ token }) => {
        expiringToken = token
      },
      rateLimitSecret: secret,
      realmId: realm.id,
      runtime: testkit.runtime,
      session: session.session,
      userId: user.id,
    })
    expect(expiring.success).toBe(true)
    if (!expiring.success) return
    testkit.advance(10 * 60 * 1_000)
    const refreshedSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: user.id,
    })
    expect(refreshedSession.success).toBe(true)
    if (!refreshedSession.success) return
    expect(
      userEmailAddressAddVerify({
        context: realmTenantContextCreate(realm.id, user.id),
        database,
        input: { challengeId: expiring.data.challengeId, token: expiringToken },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: refreshedSession.data.session,
        userId: user.id,
      }).success,
    ).toBe(false)
    expect(
      userEmailRepositoryCreate(database.db).userEmailGetByUserAddress(realm.id, user.id, "expiring@example.com"),
    ).toEqual({ data: null, success: true })
    const refreshedSecondSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: secondCreated.data.user.id,
    })
    expect(refreshedSecondSession.success).toBe(true)
    if (!refreshedSecondSession.success) return
    expect(
      userEmailAddressAddStart({
        context: realmTenantContextCreate(realm.id, secondCreated.data.user.id),
        database,
        input: { email: "expiring@example.com" },
        rateLimitSecret: secret,
        realmId: realm.id,
        runtime: testkit.runtime,
        session: refreshedSecondSession.data.session,
        userId: secondCreated.data.user.id,
      }).success,
    ).toBe(true)
  })
})

test("email address routes and client keep the authenticated subject", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm, session, user } = await fixture(database, testkit)
    const app = userServerAppCreate({
      database,
      onEmailAddressVerificationDelivery: () => undefined,
      publicOrigin: "https://user-email-address.example.com",
      systemSecret: secret,
    })
    const client = userApiClientCreate({
      baseUrl: "https://user-email-address.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: session.token,
    })
    const listed = await client.userMeEmailAddressList(realm.id)
    expect(listed).toMatchObject({
      data: { items: [{ email: "primary@example.com", isPrimary: true }] },
      success: true,
    })
    expect(user.id).toBeDefined()
  })
})
