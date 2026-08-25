import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { accountDemoUserFixture } from "../../src/features/account/ui/accountDemoUserFixture.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userProfileUpdate } from "../../src/features/users/actions/userProfileUpdate.js"
import { userProfileNormalize } from "../../src/features/users/domain/userProfileNormalize.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userProfileUpdateRequestSchema } from "../../src/features/users/public/userProfileUpdateRequestSchema.js"
import { userProfileSchema } from "../../src/features/users/public/userProfileSchema.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("user picture contracts validate HTTPS assets and normalize nested values", () => {
  expect(
    v.safeParse(userProfileSchema, {
      gender: "woman",
      picture: { contentType: "image/png", url: "https://assets.example.test/avatar.png" },
    }).success,
  ).toBe(true)
  expect(v.safeParse(userProfileSchema, { picture: { url: "http://assets.example.test/avatar.png" } }).success).toBe(
    false,
  )
  expect(v.safeParse(userProfileUpdateRequestSchema, { picture: null }).success).toBe(true)

  const normalized = userProfileNormalize({
    gender: "  woman  ",
    picture: { contentType: " image/png ", url: " https://assets.example.test/avatar.png " },
  })
  expect(normalized).toEqual({
    data: { gender: "woman", picture: { contentType: "image/png", url: "https://assets.example.test/avatar.png" } },
    success: true,
  })
})

test("user picture persistence, removal, changed-field events, and tenants stay scoped", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "profile-picture-alpha.example.com")
    const beta = await createRealm(database, "profile-picture-beta.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        email: "picture@example.com",
        profile: {
          gender: "woman",
          picture: { contentType: "image/png", url: "https://assets.example.test/first.png" },
        },
        userName: "picture-user",
      },
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.user.profile).toEqual({
      gender: "woman",
      picture: { contentType: "image/png", url: "https://assets.example.test/first.png" },
    })
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: "image/png",
      picture_url: "https://assets.example.test/first.png",
    })

    const updated = userProfileUpdate({
      context: realmSystemContextCreate(),
      database,
      input: { gender: "non-binary", picture: { url: "https://assets.example.test/second.webp" } },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.user.profile.picture).toEqual({ url: "https://assets.example.test/second.webp" })
    const updateEvent = database.db.select().from(storageEventTable).all().at(-1)
    expect(updateEvent?.payload).toEqual({ fields: ["gender", "picture"] })

    expect(
      userProfileUpdate({
        context: realmTenantContextCreate(alpha.id, "tenant-actor"),
        database,
        input: { picture: null },
        realmId: beta.id,
        userId: created.data.user.id,
      }),
    ).toMatchObject({ code: "users.tenant-mismatch", success: false })

    const removed = userProfileUpdate({
      context: realmSystemContextCreate(),
      database,
      input: { picture: null },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(removed).toMatchObject({ data: { user: { profile: { gender: "non-binary" } } }, success: true })
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: null,
      picture_url: null,
    })
  })
})

test("user profile route and browser client keep picture updates behind tenant CSRF", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "profile-picture-route.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "route@example.com", profile: {}, userName: "route-user" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const activated = userLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { state: "active" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(activated.success).toBe(true)
    if (!activated.success) return
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(session.success).toBe(true)
    if (!session.success) return

    const app = userServerAppCreate({ database, publicOrigin: "https://profile-picture-route.example.com" })
    const path = `https://profile-picture-route.example.com/realms/${realm.id}/me`
    const body = JSON.stringify({
      gender: "woman",
      picture: { contentType: "image/jpeg", url: "https://assets.example.test/route.jpg" },
    })
    const cookie = `session=${session.data.token}`
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const missingCsrf = await app.request(path, {
      body,
      headers: { cookie, "content-type": "application/json", origin: "https://profile-picture-route.example.com" },
      method: "PATCH",
    })
    expect(missingCsrf.status).toBe(403)
    const updated = await app.request(path, {
      body,
      headers: {
        cookie: `${cookie}; csrf=${csrf}`,
        "content-type": "application/json",
        origin: "https://profile-picture-route.example.com",
        "x-csrf-token": csrf,
      },
      method: "PATCH",
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).user.profile.picture).toEqual({
      contentType: "image/jpeg",
      url: "https://assets.example.test/route.jpg",
    })

    const requests: { body?: unknown; init?: RequestInit; url: string }[] = []
    const client = userApiClientCreate({
      baseUrl: "https://profile-picture-route.example.com",
      fetch: async (input, init) => {
        const url = input.toString()
        requests.push({ body: init?.body === undefined ? undefined : JSON.parse(String(init.body)), init, url })
        if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "client-csrf-token" })
        return Response.json({ user: accountDemoUserFixture })
      },
    })
    expect((await client.userMeProfileUpdate(realm.id, { gender: "man", picture: null })).success).toBe(true)
    expect(requests.at(-1)?.body).toEqual({ gender: "man", picture: null })
    expect(new Headers(requests.at(-1)?.init?.headers).get("x-csrf-token")).toBe("client-csrf-token")
  })
})

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-users-profile-picture-"))
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
    context: realmSystemContextCreate(),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
}
