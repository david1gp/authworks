import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { realmAdministratorGrant } from "../../src/features/realms/actions/realmAdministratorGrant.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userEmailChangeChallengeTable } from "../../src/features/users/persistence/userEmailChangeChallengeTable.js"
import { userEmailRepositoryCreate } from "../../src/features/users/persistence/userEmailRepositoryCreate.js"
import type { UserEmailAddressVerificationDelivery } from "../../src/features/users/public/userEmailAddressVerificationDeliverySchema.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-verification-resend-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) throw new Error(opened.errorMessage)
  try {
    return await operation(opened.data)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
}

function activeUnverifiedUser(database: StorageDatabase, realmId: string, userName: string) {
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
  return created.data.user
}

function adminSession(database: StorageDatabase, realmId: string, adminId: string) {
  const issued = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    realmId,
    userId: adminId,
  })
  expect(issued.success).toBe(true)
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data.token
}

async function realmWithAdmin(database: StorageDatabase, domain: string) {
  const system = realmSystemContextCreate("system")
  const realm = realmCreate({ context: system, database, input: { domain, name: domain } })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const realmId = realm.data.realm.id
  const admin = activeUnverifiedUser(database, realmId, `resend-admin-${domain.split(".")[0]}`)
  expect(realmAdministratorGrant({ context: system, database, realmId, userId: admin.id }).success).toBe(true)
  return { admin, realmId }
}

test("admin resend creates a challenge, appends the event, and delivers without leaking the code", async () => {
  await withDatabase(async (database) => {
    const { admin, realmId } = await realmWithAdmin(database, "verification-resend.example.com")
    const target = activeUnverifiedUser(database, realmId, "resend-target")
    const deliveries: UserEmailAddressVerificationDelivery[] = []
    const app = userServerAppCreate({
      database,
      onEmailAddressVerificationDelivery: (delivery) => {
        deliveries.push(delivery)
      },
      publicOrigin: "https://verification-resend.example.com",
      systemSecret: "system-secret",
    })
    const token = adminSession(database, realmId, admin.id)
    const response = await app.request(
      `https://verification-resend.example.com/realms/${realmId}/users/${target.id}/emails/${target.id}/verification-resend`,
      { headers: { authorization: `Bearer ${token}` }, method: "POST" },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toEqual({
      accepted: true,
      challengeId: expect.any(String),
      expiresAt: expect.any(Number),
      retryAt: expect.any(Number),
    })
    expect(JSON.stringify(body)).not.toContain("token")

    const challenges = database.db
      .select()
      .from(userEmailChangeChallengeTable)
      .where(eq(userEmailChangeChallengeTable.userId, target.id))
      .all()
    expect(challenges).toHaveLength(1)
    expect(challenges[0]).toMatchObject({ purpose: "email_address", realmId })
    const events = database.db
      .select()
      .from(storageEventTable)
      .where(eq(storageEventTable.aggregateType, "user_email_address_verification"))
      .all()
    expect(events).toHaveLength(1)
    expect(events[0]?.eventType).toBe(userEventTypes.emailAddressVerificationRequested)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({ email: target.email, realmId, userId: target.id })
    expect(typeof deliveries[0]?.token).toBe("string")
  })
})

test("admin resend refuses an already-verified email row", async () => {
  await withDatabase(async (database) => {
    const { admin, realmId } = await realmWithAdmin(database, "verification-resend-verified.example.com")
    const target = activeUnverifiedUser(database, realmId, "resend-verified-target")
    const verified = userEmailRepositoryCreate(database.db).userEmailVerificationSet({
      emailId: target.id,
      expectedVersion: 1,
      realmId,
      updatedAt: database.runtime.now(),
      userId: target.id,
      verifiedAt: database.runtime.now(),
      version: 2,
    })
    expect(verified.success).toBe(true)
    const app = userServerAppCreate({
      database,
      publicOrigin: "https://verification-resend-verified.example.com",
      systemSecret: "system-secret",
    })
    const token = adminSession(database, realmId, admin.id)
    const response = await app.request(
      `https://verification-resend-verified.example.com/realms/${realmId}/users/${target.id}/emails/${target.id}/verification-resend`,
      { headers: { authorization: `Bearer ${token}` }, method: "POST" },
    )
    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("users.conflict")
  })
})

test("admin resend enforces user.manage and cross-user isolation", async () => {
  await withDatabase(async (database) => {
    const { admin, realmId } = await realmWithAdmin(database, "verification-resend-auth.example.com")
    const target = activeUnverifiedUser(database, realmId, "resend-auth-target")
    const other = activeUnverifiedUser(database, realmId, "resend-auth-other")
    const member = activeUnverifiedUser(database, realmId, "resend-auth-member")
    const app = userServerAppCreate({
      database,
      publicOrigin: "https://verification-resend-auth.example.com",
      systemSecret: "system-secret",
    })
    const memberResponse = await app.request(
      `https://verification-resend-auth.example.com/realms/${realmId}/users/${target.id}/emails/${target.id}/verification-resend`,
      { headers: { authorization: `Bearer ${adminSession(database, realmId, member.id)}` }, method: "POST" },
    )
    expect(memberResponse.status).toBe(403)

    const foreignEmail = await app.request(
      `https://verification-resend-auth.example.com/realms/${realmId}/users/${target.id}/emails/${other.id}/verification-resend`,
      { headers: { authorization: `Bearer ${adminSession(database, realmId, admin.id)}` }, method: "POST" },
    )
    expect(foreignEmail.status).toBe(404)
    expect(((await foreignEmail.json()) as { error: { code: string } }).error.code).toBe("users.not-found")
  })
})

test("admin resend rejects cross-realm subjects", async () => {
  await withDatabase(async (database) => {
    const { admin, realmId } = await realmWithAdmin(database, "verification-resend-tenant.example.com")
    const system = realmSystemContextCreate("system")
    const other = realmCreate({
      context: system,
      database,
      input: { domain: "verification-resend-tenant-other.example.com", name: "other" },
    })
    expect(other.success).toBe(true)
    if (!other.success) return
    const foreign = activeUnverifiedUser(database, other.data.realm.id, "resend-tenant-foreign")
    const app = userServerAppCreate({
      database,
      publicOrigin: "https://verification-resend-tenant.example.com",
      systemSecret: "system-secret",
    })
    const response = await app.request(
      `https://verification-resend-tenant.example.com/realms/${other.data.realm.id}/users/${foreign.id}/emails/${foreign.id}/verification-resend`,
      { headers: { authorization: `Bearer ${adminSession(database, realmId, admin.id)}` }, method: "POST" },
    )
    expect(response.status).not.toBe(200)
  })
})

test("admin email list and resend clients address the tenant email routes", async () => {
  const requests: { init?: RequestInit; url: string }[] = []
  const api = userApiClientCreate({
    baseUrl: "https://verification-resend.example.com",
    fetch: async (input, init) => {
      const url = String(input)
      requests.push({ init, url })
      if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-fixture" })
      if (url.includes("/emails/") && url.endsWith("/verification-resend"))
        return Response.json({ accepted: true, challengeId: "challenge-1", expiresAt: 7, retryAt: 8 })
      if (url.endsWith("/emails"))
        return Response.json({
          items: [
            {
              createdAt: 1,
              email: "target@example.com",
              id: "email-1",
              isPrimary: true,
              updatedAt: 2,
              verified: false,
              verifiedAt: null,
              version: 1,
            },
          ],
        })
      return Response.json({}, { status: 404 })
    },
  })
  const listed = await api.userTenantEmailAddressList("realm-1", "user-2")
  expect(listed.success).toBe(true)
  const sent = await api.userTenantEmailVerificationResend("realm-1", "user-2", "email-1")
  expect(sent).toEqual({
    data: { accepted: true, challengeId: "challenge-1", expiresAt: 7, retryAt: 8 },
    success: true,
  })
  expect(requests.map(({ url }) => url)).toEqual([
    "https://verification-resend.example.com/realms/realm-1/users/user-2/emails",
    "https://verification-resend.example.com/realms/realm-1/sessions/csrf",
    "https://verification-resend.example.com/realms/realm-1/users/user-2/emails/email-1/verification-resend",
  ])
  expect(new Headers(requests[2]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
  expect(requests[2]?.init?.credentials).toBe("include")
})
