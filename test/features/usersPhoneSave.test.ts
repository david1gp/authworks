import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userPhoneNumberSave } from "../../src/features/users/actions/userPhoneNumberSave.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-users-phone-save-"))
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

async function createActiveUser(database: StorageDatabase, email: string, phoneNumber?: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate(),
    database,
    input: { domain: `${email.replace("@", "-")}.example.com`, name: email },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const created = userCreate({
    context: realmSystemContextCreate(),
    database,
    input: {
      email,
      ...(phoneNumber === undefined ? {} : { phoneNumber }),
      profile: {},
      userName: email.split("@")[0] ?? "user",
    },
    realmId: realm.data.realm.id,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  const activated = userLifecycleSet({
    context: realmSystemContextCreate(),
    database,
    input: { state: "active" },
    realmId: realm.data.realm.id,
    userId: created.data.user.id,
  })
  expect(activated.success).toBe(true)
  return { realm: realm.data.realm, userId: created.data.user.id }
}

test("phone-number save stores an unverified number without losing the active account", async () => {
  await withDatabase(async (database) => {
    const fixture = await createActiveUser(database, "phone-save@example.com")
    const saved = userPhoneNumberSave({
      context: realmTenantContextCreate(fixture.realm.id, fixture.userId),
      database,
      input: { phoneNumber: "+14155552671" },
      realmId: fixture.realm.id,
      userId: fixture.userId,
    })
    expect(saved.success).toBe(true)
    if (!saved.success) return
    expect(saved.data.user).toMatchObject({ phoneNumber: "+14155552671" })
    expect(saved.data.user).not.toHaveProperty("phoneNumberVerifiedAt")

    const row = database.sqlite
      .query("SELECT phone_number, phone_number_verified_at FROM users WHERE id = ?")
      .get(fixture.userId) as { phone_number: string; phone_number_verified_at: null }
    expect(row).toEqual({ phone_number: "+14155552671", phone_number_verified_at: null })

    const event = database.sqlite
      .query("SELECT event_type, payload FROM events WHERE aggregate_id = ? ORDER BY aggregate_version DESC")
      .get(fixture.userId) as { event_type: string; payload: string }
    expect(event.event_type).toBe(userEventTypes.phoneNumberChanged)
    expect(JSON.parse(event.payload)).toEqual({ verified: false })
    expect(event.payload).not.toContain("+14155552671")
  })
})

test("phone-number save is idempotent for the same unverified number and rejects verified conflicts", async () => {
  await withDatabase(async (database) => {
    const first = await createActiveUser(database, "phone-save-first@example.com")

    const saved = userPhoneNumberSave({
      context: realmTenantContextCreate(first.realm.id, first.userId),
      database,
      input: { phoneNumber: "+14155552671" },
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(saved.success).toBe(true)

    const idempotent = userPhoneNumberSave({
      context: realmTenantContextCreate(first.realm.id, first.userId),
      database,
      input: { phoneNumber: "+14155552671" },
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(idempotent).toMatchObject({ success: true, data: { user: { phoneNumber: "+14155552671" } } })

    const verified = userRepositoryCreate(database.db).userUpdate(first.realm.id, first.userId, {
      phoneNumberVerifiedAt: database.runtime.now(),
      version: 3,
    })
    expect(verified.success).toBe(true)

    const conflict = userPhoneNumberSave({
      context: realmTenantContextCreate(first.realm.id, first.userId),
      database,
      input: { phoneNumber: "+14155552671" },
      realmId: first.realm.id,
      userId: first.userId,
    })
    expect(conflict).toMatchObject({ code: "users.conflict", success: false })
  })
})

test("phone-number save validates the caller, the realm scope, and the E.164 input", async () => {
  await withDatabase(async (database) => {
    const fixture = await createActiveUser(database, "phone-save-validation@example.com")
    const context = realmTenantContextCreate(fixture.realm.id, fixture.userId)

    expect(
      userPhoneNumberSave({
        context: realmTenantContextCreate(fixture.realm.id, "another-user"),
        database,
        input: { phoneNumber: "+14155552671" },
        realmId: fixture.realm.id,
        userId: fixture.userId,
      }),
    ).toMatchObject({ code: "users.forbidden", success: false })

    expect(
      userPhoneNumberSave({
        context,
        database,
        input: { phoneNumber: "4155552671" },
        realmId: fixture.realm.id,
        userId: fixture.userId,
      }),
    ).toMatchObject({ success: false })

    expect(
      userPhoneNumberSave({
        context,
        database,
        input: { phoneNumber: "+14155552671" },
        realmId: fixture.realm.id,
        userId: "missing-user",
      }),
    ).toMatchObject({ code: "users.forbidden", success: false })
  })
})

test("phone-number save rejects a number verified by another user in the same realm", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "phone-save-conflict.example.com", name: "Phone save conflict" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const realmId = realm.data.realm.id
    const first = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        email: "conflict-first@example.com",
        phoneNumber: "+14155552671",
        profile: {},
        userName: "conflict-first",
      },
      realmId,
    })
    const second = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "conflict-second@example.com", profile: {}, userName: "conflict-second" },
      realmId,
    })
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) return
    for (const userId of [first.data.user.id, second.data.user.id]) {
      const activated = userLifecycleSet({
        context: realmSystemContextCreate(),
        database,
        input: { state: "active" },
        realmId,
        userId,
      })
      expect(activated.success).toBe(true)
    }
    const verified = userRepositoryCreate(database.db).userUpdate(realmId, first.data.user.id, {
      phoneNumberVerifiedAt: database.runtime.now(),
      version: 2,
    })
    expect(verified.success).toBe(true)

    const conflict = userPhoneNumberSave({
      context: realmTenantContextCreate(realmId, second.data.user.id),
      database,
      input: { phoneNumber: "+14155552671" },
      realmId,
      userId: second.data.user.id,
    })
    expect(conflict).toMatchObject({ code: "users.conflict", success: false })
    expect(userRepositoryCreate(database.db).userGet(realmId, second.data.user.id)).toMatchObject({
      success: true,
      data: { phoneNumber: null },
    })
  })
})

test("phone-number self-service route stores the unverified number for the authenticated user", async () => {
  await withDatabase(async (database, testkit) => {
    const fixture = await createActiveUser(database, "phone-save-route@example.com")
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: fixture.realm.id,
      runtime: testkit.runtime,
      userId: fixture.userId,
    })
    expect(session.success).toBe(true)
    if (!session.success) return
    const app = userServerAppCreate({ database, publicOrigin: "https://phone-save-route.example.com" })
    const path = `/realms/${fixture.realm.id}/me/phone-number`
    const url = `https://phone-save-route.example.com${path}`

    const unauthenticated = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "+14155552671" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
    expect(unauthenticated.status).toBe(401)

    const cookie = `session=${session.data.token}`
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const browserHeaders = {
      cookie: `${cookie}; csrf=${csrf}`,
      origin: "https://phone-save-route.example.com",
      "x-csrf-token": csrf,
    }
    const invalid = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "4155552671" }),
      headers: { ...browserHeaders, "content-type": "application/json" },
      method: "POST",
    })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({ error: { code: "users.invalid" } })

    const saved = await app.request(url, {
      body: JSON.stringify({ phoneNumber: "+14155552671" }),
      headers: { ...browserHeaders, "content-type": "application/json" },
      method: "POST",
    })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ user: { id: fixture.userId, phoneNumber: "+14155552671" } })
  })
})

test("phone-number browser client sends the typed mutation and maps HTTP errors", async () => {
  const requests: Array<{ body?: unknown; init?: RequestInit; url: string }> = []
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString()
    requests.push({ body: init?.body === undefined ? undefined : JSON.parse(String(init.body)), init, url })
    if (url.endsWith("/sessions/csrf"))
      return Response.json({ csrfToken: "csrf-token-for-browser-client-123456789012345678901" })
    return Response.json({
      user: {
        createdAt: 1_700_000_000_000,
        email: "phone-save-client@example.com",
        emailVerified: false,
        id: "01900000-0000-7000-8000-0000000000b1",
        phoneNumber: "+14155552671",
        profile: {},
        realmId: "01900000-0000-7000-8000-000000000001",
        state: "active",
        updatedAt: 1_700_000_000_000,
        userName: "phone-save-client",
        verificationState: "unverified",
      },
    })
  }
  const client = userApiClientCreate({ baseUrl: "https://phone-save-client.example.com", fetch })
  const saved = await client.userMePhoneNumberSet("realm/client", { phoneNumber: "+14155552671" })
  expect(saved).toMatchObject({ success: true, data: { user: { phoneNumber: "+14155552671" } } })
  const mutations = requests.filter((request) => !request.url.endsWith("/sessions/csrf"))
  expect(mutations.map((request) => request.url)).toEqual([
    "https://phone-save-client.example.com/realms/realm%2Fclient/me/phone-number",
  ])
  expect(mutations.map((request) => request.body)).toEqual([{ phoneNumber: "+14155552671" }])

  const mapped = await userApiClientCreate({
    baseUrl: "https://phone-save-client.example.com",
    fetch: async (input) =>
      input.toString().endsWith("/sessions/csrf")
        ? Response.json({ csrfToken: "csrf-token-for-browser-client-123456789012345678901" })
        : Response.json(
            {
              error: {
                code: "users.conflict",
                message: "The user phone number is already verified by another user.",
                requestId: "phone-save-client-error",
                retryable: false,
                status: 409,
              },
            },
            { status: 409 },
          ),
  }).userMePhoneNumberSet("realm", { phoneNumber: "+14155552671" })
  expect(mapped).toMatchObject({ code: "users.conflict", statusCode: 409, success: false })
})
