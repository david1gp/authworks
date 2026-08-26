import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { accountDemoUserFixture } from "../../src/features/account/ui/accountDemoUserFixture.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userDelete } from "../../src/features/users/actions/userDelete.js"
import { userGet } from "../../src/features/users/actions/userGet.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userProfilePictureCleanupDrain } from "../../src/features/users/actions/userProfilePictureCleanupDrain.js"
import { userProfilePictureCleanupEnqueue } from "../../src/features/users/actions/userProfilePictureCleanupEnqueue.js"
import { userProfilePictureCleanupLeaseDurationMs } from "../../src/features/users/actions/userProfilePictureCleanupLeaseDurationMs.js"
import { userProfilePictureImport } from "../../src/features/users/actions/userProfilePictureImport.js"
import { userProfilePictureObjectDelete } from "../../src/features/users/actions/userProfilePictureObjectDelete.js"
import { userProfilePictureRemove } from "../../src/features/users/actions/userProfilePictureRemove.js"
import { userProfilePictureUpload } from "../../src/features/users/actions/userProfilePictureUpload.js"
import { userProfileUpdate } from "../../src/features/users/actions/userProfileUpdate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userPictureHashCreate } from "../../src/features/users/domain/userPictureHashCreate.js"
import { userPictureObjectKeyFromPublicUrlCreate } from "../../src/features/users/domain/userPictureObjectKeyFromPublicUrlCreate.js"
import { userProfileNormalize } from "../../src/features/users/domain/userProfileNormalize.js"
import { userCreateRequestSchema } from "../../src/features/users/public/userCreateRequestSchema.js"
import { userProfileSchema } from "../../src/features/users/public/userProfileSchema.js"
import { userProfileUpdateRequestSchema } from "../../src/features/users/public/userProfileUpdateRequestSchema.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import { resultErrorCreate } from "../../src/platform/errors/resultErrorCreate.js"
import type { R2ObjectStorage } from "../../src/platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const validJpeg = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
    "base64",
  ),
)
const validPng = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oIGgccHxrvKFMAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTA4LTI2VDA3OjI4OjMxKzAwOjAw7lEr7gAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0wOC0yNlQwNzoyODozMSswMDowMJ8Mk1IAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMDgtMjZUMDc6Mjg6MzErMDA6MDDIGbKNAAAAAElFTkSuQmCC",
    "base64",
  ),
)

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
  expect(
    v.safeParse(userCreateRequestSchema, {
      email: "picture-create@example.com",
      profile: { picture: { url: "https://assets.example.test/avatar.png" } },
      userName: "picture-create",
    }).success,
  ).toBe(false)
  expect(v.safeParse(userProfileUpdateRequestSchema, { picture: null }).success).toBe(false)
  expect(
    v.safeParse(userProfileUpdateRequestSchema, {
      picture: { contentType: "image/png", url: "https://evil.example/avatar.png" },
    }).success,
  ).toBe(false)

  const normalized = userProfileNormalize({
    gender: "  woman  ",
    picture: { contentType: " image/png ", url: " https://assets.example.test/avatar.png " },
  })
  expect(normalized).toEqual({
    data: { gender: "woman", picture: { contentType: "image/png", url: "https://assets.example.test/avatar.png" } },
    success: true,
  })
})

test("profile picture object deletion requires the normalized username and never deletes a foreign key", async () => {
  const hash = "a".repeat(64)
  const generation = "b".repeat(32)
  const owned = userPictureObjectKeyFromPublicUrlCreate({
    publicOrigin: "https://assets.example.test",
    url: `https://assets.example.test/user-pictures/ada%20user_${generation}_${hash}.png`,
    userName: " Ada User ",
  })
  expect(owned).toEqual({ data: `user-pictures/ada user_${generation}_${hash}.png`, success: true })

  const foreign = userPictureObjectKeyFromPublicUrlCreate({
    publicOrigin: "https://assets.example.test",
    url: `https://assets.example.test/user-pictures/other-user_${generation}_${hash}.png`,
    userName: " Ada User ",
  })
  expect(foreign.success).toBe(false)

  const deleted: string[] = []
  const cleanup = await userProfilePictureObjectDelete({
    publicOrigin: "https://assets.example.test",
    storage: {
      delete: async ({ key }) => {
        deleted.push(key)
        return { data: undefined, success: true }
      },
      put: async () => ({ data: undefined, success: true }),
    },
    url: `https://assets.example.test/user-pictures/other-user_${generation}_${hash}.png`,
    userName: " Ada User ",
  })
  expect(cleanup.success).toBe(false)
  expect(deleted).toEqual([])
})

test("user profile updates stay scoped without accepting picture mutations", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "profile-picture-alpha.example.com")
    const beta = await createRealm(database, "profile-picture-beta.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        email: "picture@example.com",
        profile: { gender: "woman" },
        userName: "picture-user",
      },
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.user.profile).toEqual({ gender: "woman" })
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: null,
      picture_url: null,
    })

    const updated = userProfileUpdate({
      context: realmSystemContextCreate(),
      database,
      input: { gender: "non-binary" },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.user.profile.picture).toBeUndefined()
    const updateEvent = database.db.select().from(storageEventTable).all().at(-1)
    expect(updateEvent?.payload).toEqual({ fields: ["gender"] })

    expect(
      userProfileUpdate({
        context: realmTenantContextCreate(alpha.id, "tenant-actor"),
        database,
        input: { gender: "non-binary" },
        realmId: beta.id,
        userId: created.data.user.id,
      }),
    ).toMatchObject({ code: "users.tenant-mismatch", success: false })
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
      picture: { contentType: "image/jpeg", url: "https://evil.example/route.jpg" },
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
    expect(updated.status).toBe(400)
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: null,
      picture_url: null,
    })

    const unrelatedUpdate = await app.request(path, {
      body: JSON.stringify({ gender: "woman" }),
      headers: {
        cookie: `${cookie}; csrf=${csrf}`,
        "content-type": "application/json",
        origin: "https://profile-picture-route.example.com",
        "x-csrf-token": csrf,
      },
      method: "PATCH",
    })
    expect(unrelatedUpdate.status).toBe(200)
    expect((await unrelatedUpdate.json()).user.profile.gender).toBe("woman")

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
    expect((await client.userMeProfileUpdate(realm.id, { gender: "man" })).success).toBe(true)
    expect(requests.at(-1)?.body).toEqual({ gender: "man" })
    expect(new Headers(requests.at(-1)?.init?.headers).get("x-csrf-token")).toBe("client-csrf-token")
    expect((await client.userMeProfilePictureRemove(realm.id)).success).toBe(true)
    expect(requests.at(-1)?.init?.method).toBe("DELETE")
  })
})

test("system and administrator profile routes reject picture injection and preserve unrelated updates", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "profile-picture-route-boundaries.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "route-boundaries@example.com", profile: {}, userName: "route-boundaries" },
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
    const organization = organizationCreate({
      context: realmSystemContextCreate(),
      database,
      input: { name: "Route boundary administrators", ownerUserId: created.data.user.id },
      realmId: realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
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

    const app = userServerAppCreate({ database, systemSecret: "profile-picture-system-secret" })
    const routes = [
      {
        authorization: "Bearer profile-picture-system-secret",
        path: `/system/realms/${realm.id}/users/${created.data.user.id}/profile`,
      },
      {
        authorization: `Bearer ${session.data.token}`,
        path: `/realms/${realm.id}/users/${created.data.user.id}/profile`,
      },
    ]
    for (const route of routes) {
      const injected = await app.request(`https://profile-picture-route-boundaries.example.com${route.path}`, {
        body: JSON.stringify({
          displayName: "Should not persist",
          picture: { contentType: "text/html", url: "https://evil.example/avatar.html" },
        }),
        headers: { authorization: route.authorization, "content-type": "application/json" },
        method: "PATCH",
      })
      expect(injected.status).toBe(400)
    }
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: null,
      picture_url: null,
    })

    for (const [index, route] of routes.entries()) {
      const updated = await app.request(`https://profile-picture-route-boundaries.example.com${route.path}`, {
        body: JSON.stringify({ displayName: `Unrelated update ${index}` }),
        headers: { authorization: route.authorization, "content-type": "application/json" },
        method: "PATCH",
      })
      expect(updated.status).toBe(200)
      expect((await updated.json()).user.profile.displayName).toBe(`Unrelated update ${index}`)
    }
  })
})

test("user profile picture upload is subject-bound, hosted, persisted, and removable", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "profile-picture-upload.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "upload@example.com", profile: {}, userName: "Upload User" },
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

    const body = validPng
    const uploads: { body: Uint8Array; contentType: string; key: string }[] = []
    const deletes: string[] = []
    const app = userServerAppCreate({
      database,
      profilePicturePublicOrigin: "https://assets.example.test",
      profilePictureStorage: {
        delete: async ({ key }) => {
          deletes.push(key)
          return { data: undefined, success: true }
        },
        put: async (input) => {
          uploads.push(input)
          return { data: undefined, success: true }
        },
      },
      publicOrigin: "https://profile-picture-upload.example.com",
    })
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const cookie = `session=${session.data.token}; csrf=${csrf}`
    const headers = {
      cookie,
      origin: "https://profile-picture-upload.example.com",
      "x-csrf-token": csrf,
    }
    const upload = await app.request(
      `https://profile-picture-upload.example.com/realms/${realm.id}/me/profile-picture`,
      {
        body,
        headers: { ...headers, "content-type": "image/png" },
        method: "PUT",
      },
    )
    expect(upload.status).toBe(200)
    const uploadResponse = await upload.json()
    const hash = userPictureHashCreate(body)
    expect(hash.success).toBe(true)
    if (!hash.success) return
    const firstKey = uploads[0]?.key
    expect(firstKey).toBeString()
    if (firstKey === undefined) return
    expect(firstKey).toMatch(new RegExp(`^user-pictures/upload user_[0-9a-f]{32}_${hash.data}\\.png$`))
    expect(uploadResponse.user.profile.picture).toEqual({
      contentType: "image/png",
      url: `https://assets.example.test/${firstKey.replace(" ", "%20")}`,
    })
    expect(uploads).toHaveLength(1)
    expect(uploads[0]).toMatchObject({
      body,
      contentType: "image/png",
      key: firstKey,
    })
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()

    const sameBytes = await app.request(
      `https://profile-picture-upload.example.com/realms/${realm.id}/me/profile-picture`,
      { body, headers: { ...headers, "content-type": "image/png" }, method: "PUT" },
    )
    expect(sameBytes.status).toBe(200)
    const secondKey = uploads[1]?.key
    expect(secondKey).toBeString()
    if (secondKey === undefined) return
    expect(secondKey).toMatch(new RegExp(`^user-pictures/upload user_[0-9a-f]{32}_${hash.data}\\.png$`))
    expect(secondKey).not.toBe(firstKey)
    expect(deletes).toEqual([firstKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()

    const replacement = await app.request(
      `https://profile-picture-upload.example.com/realms/${realm.id}/me/profile-picture`,
      { body: validJpeg, headers: { ...headers, "content-type": "image/jpeg" }, method: "PUT" },
    )
    expect(replacement.status).toBe(200)
    const replacementKey = uploads[2]?.key
    expect(replacementKey).toBeString()
    if (replacementKey === undefined) return
    expect(deletes).toEqual([firstKey, secondKey])

    for (const contentLength of [undefined, "not-a-number"]) {
      let pulls = 0
      let cancelled = false
      const oversizedStream = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true
        },
        pull(controller) {
          pulls += 1
          controller.enqueue(pulls === 1 ? new Uint8Array(512 * 1024) : Uint8Array.of(1))
        },
      })
      const streamHeaders = new Headers({ ...headers, "content-type": "image/png" })
      if (contentLength !== undefined) streamHeaders.set("content-length", contentLength)
      const rejected = await app.request(
        `https://profile-picture-upload.example.com/realms/${realm.id}/me/profile-picture`,
        { body: oversizedStream, headers: streamHeaders, method: "PUT" },
      )
      expect(rejected.status).toBe(400)
      expect(cancelled).toBe(true)
      expect(pulls).toBe(2)
    }

    const replacementHash = userPictureHashCreate(validJpeg)
    expect(replacementHash.success).toBe(true)
    if (!replacementHash.success) return
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: "image/jpeg",
      picture_url: `https://assets.example.test/${replacementKey.replace(" ", "%20")}`,
    })
    expect(
      userProfilePictureCleanupEnqueue({
        database,
        objectKey: replacementKey,
      }).success,
    ).toBe(true)
    await userProfilePictureCleanupDrain({
      database,
      publicOrigin: "https://assets.example.test",
      storage: {
        delete: async ({ key }) => {
          deletes.push(key)
          return { data: undefined, success: true }
        },
        put: async () => ({ data: undefined, success: true }),
      },
    })
    expect(deletes).toEqual([firstKey, secondKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()

    const removed = await app.request(
      `https://profile-picture-upload.example.com/realms/${realm.id}/me/profile-picture`,
      { headers, method: "DELETE" },
    )
    expect(removed.status).toBe(200)
    expect((await removed.json()).user.profile.picture).toBeUndefined()
    expect(deletes).toEqual([firstKey, secondKey, replacementKey])
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: null,
      picture_url: null,
    })

    const reuploaded = await userProfilePictureUpload({
      body: validPng,
      contentType: "image/png",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage: {
        delete: async () => ({ data: undefined, success: true }),
        put: async () => ({ data: undefined, success: true }),
      },
      userId: created.data.user.id,
    })
    expect(reuploaded.success).toBe(true)
    const removalAttempts: string[] = []
    const removedWithFailure = await userProfilePictureRemove({
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage: {
        delete: async ({ key }) => {
          removalAttempts.push(key)
          return resultErrorCreate("testR2Delete", "R2 delete failed")
        },
        put: async () => ({ data: undefined, success: true }),
      },
      userId: created.data.user.id,
    })
    expect(removedWithFailure.success).toBe(true)
    expect(removalAttempts).toHaveLength(1)
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toEqual({
      object_key: removalAttempts[0],
    })
  })
})

test("user deletion soft-deletes the user and removes its currently referenced Authworks picture", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "profile-picture-user-delete.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "delete-picture@example.com", profile: {}, userName: " Delete User " },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const deletedKeys: string[] = []
    const storage: R2ObjectStorage = {
      delete: async ({ key }) => {
        deletedKeys.push(key)
        return { data: undefined, success: true }
      },
      put: async () => ({ data: undefined, success: true }),
    }
    const uploaded = await userProfilePictureUpload({
      body: validPng,
      contentType: "image/png",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage,
      userId: created.data.user.id,
    })
    expect(uploaded.success).toBe(true)
    const deleted = await userDelete({
      context: realmSystemContextCreate(),
      database,
      profilePicturePublicOrigin: "https://assets.example.test",
      profilePictureStorage: storage,
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(deleted).toMatchObject({ data: { user: { state: "deleted" } }, success: true })
    const hash = userPictureHashCreate(validPng)
    expect(hash.success).toBe(true)
    if (!hash.success) return
    expect(deletedKeys).toHaveLength(1)
    expect(deletedKeys[0]).toMatch(new RegExp(`^user-pictures/delete user_[0-9a-f]{32}_${hash.data}\\.png$`))
    expect(
      userGet({ context: realmSystemContextCreate(), database, realmId: realm.id, userId: created.data.user.id }),
    ).toMatchObject({ code: "users.not-found", success: false })
  })
})

test("user deletion keeps the soft-delete when picture cleanup fails", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "profile-picture-user-delete-failure.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "delete-picture-failure@example.com", profile: {}, userName: "delete-picture-failure" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const uploaded = await userProfilePictureUpload({
      body: validPng,
      contentType: "image/png",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage: {
        delete: async () => ({ data: undefined, success: true }),
        put: async () => ({ data: undefined, success: true }),
      },
      userId: created.data.user.id,
    })
    expect(uploaded.success).toBe(true)
    const attempted: string[] = []
    const deleted = await userDelete({
      context: realmSystemContextCreate(),
      database,
      profilePicturePublicOrigin: "https://assets.example.test",
      profilePictureStorage: {
        delete: async ({ key }) => {
          attempted.push(key)
          return resultErrorCreate("testR2Delete", "R2 delete failed")
        },
        put: async () => ({ data: undefined, success: true }),
      },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(deleted).toMatchObject({ data: { user: { state: "deleted" } }, success: true })
    expect(attempted).toHaveLength(1)
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toEqual({
      object_key: expect.stringContaining("user-pictures/delete-picture-failure_"),
    })
    expect(database.sqlite.query("SELECT state FROM users WHERE id = ?").get(created.data.user.id)).toEqual({
      state: "deleted",
    })
  })
})

test("user profile picture upload rejects invalid payloads and protects the subject", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "profile-picture-invalid-alpha.example.com")
    const beta = await createRealm(database, "profile-picture-invalid-beta.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "invalid@example.com", profile: {}, userName: "invalid-user" },
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const activated = userLifecycleSet({
      context: realmSystemContextCreate(),
      database,
      input: { state: "active" },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(activated.success).toBe(true)
    if (!activated.success) return
    const session = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(session.success).toBe(true)
    if (!session.success) return

    const app = userServerAppCreate({ database, publicOrigin: "https://profile-picture-invalid-alpha.example.com" })
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const cookie = `session=${session.data.token}; csrf=${csrf}`
    const path = `https://profile-picture-invalid-alpha.example.com/realms/${alpha.id}/me/profile-picture`
    const validHeaders = {
      cookie,
      origin: "https://profile-picture-invalid-alpha.example.com",
      "x-csrf-token": csrf,
    }
    const invalid = async (body: BodyInit, contentType: string) =>
      app.request(path, {
        body,
        headers: { ...validHeaders, "content-type": contentType },
        method: "PUT",
      })

    expect((await invalid(new Uint8Array(), "image/png")).status).toBe(400)
    expect((await invalid(new Uint8Array(512 * 1024 + 1), "image/png")).status).toBe(400)
    expect((await invalid(Uint8Array.from([1, 2, 3]), "image/png")).status).toBe(400)
    expect((await invalid(Uint8Array.from([1, 2, 3]), "image/bmp")).status).toBe(400)
    expect(
      (
        await app.request(path, {
          body: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          headers: { cookie, "content-type": "image/png" },
          method: "PUT",
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await app.request(path, {
          body: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          headers: { ...validHeaders, origin: "https://other.example.com", "content-type": "image/png" },
          method: "PUT",
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await app.request(`https://profile-picture-invalid-beta.example.com/realms/${beta.id}/me/profile-picture`, {
          body: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          headers: { ...validHeaders, host: "profile-picture-invalid-beta.example.com" },
          method: "PUT",
        })
      ).status,
    ).toBe(401)
    expect(
      (
        await app.request(path, {
          body: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          headers: { origin: "https://profile-picture-invalid-alpha.example.com", "content-type": "image/png" },
          method: "PUT",
        })
      ).status,
    ).toBe(401)
  })
})

test("R2 failure leaves an existing profile picture unchanged and the browser client sends only file bytes", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "profile-picture-failure.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        email: "failure@example.com",
        profile: {},
        userName: "failure-user",
      },
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
    const existingKey = `user-pictures/failure-user_${"0".repeat(32)}_${"0".repeat(64)}.jpg`
    database.sqlite
      .query("UPDATE user_profiles SET picture_url = ?, picture_content_type = ? WHERE user_id = ?")
      .run(`https://assets.example.test/${existingKey}`, "image/jpeg", created.data.user.id)
    const deleted: string[] = []
    const hash = userPictureHashCreate(validJpeg)
    expect(hash.success).toBe(true)
    if (!hash.success) return
    const app = userServerAppCreate({
      database,
      profilePicturePublicOrigin: "https://assets.example.test",
      profilePictureStorage: {
        delete: async ({ key }) => {
          deleted.push(key)
          return { data: undefined, success: true }
        },
        put: async () => resultErrorCreate("testR2Failure", "R2 is unavailable."),
      },
      publicOrigin: "https://profile-picture-failure.example.com",
    })
    const csrf = sessionCsrfTokenCreate(testkit.runtime)
    const failed = await app.request(
      `https://profile-picture-failure.example.com/realms/${realm.id}/me/profile-picture`,
      {
        body: validJpeg,
        headers: {
          "content-type": "image/jpeg",
          cookie: `session=${session.data.token}; csrf=${csrf}`,
          origin: "https://profile-picture-failure.example.com",
          "x-csrf-token": csrf,
        },
        method: "PUT",
      },
    )
    expect(failed.status).toBe(503)
    expect(database.sqlite.query("SELECT picture_url, picture_content_type FROM user_profiles").get()).toEqual({
      picture_content_type: "image/jpeg",
      picture_url: `https://assets.example.test/${existingKey}`,
    })
    expect(deleted).toEqual([])
    const candidateKey = (
      database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get() as {
        object_key: string
      }
    ).object_key
    expect(candidateKey).toMatch(new RegExp(`^user-pictures/failure-user_[0-9a-f]{32}_${hash.data}\\.jpg$`))
    await userProfilePictureCleanupDrain({
      database,
      publicOrigin: "https://assets.example.test",
      storage: {
        delete: async ({ key }) => {
          deleted.push(key)
          return { data: undefined, success: true }
        },
        put: async () => ({ data: undefined, success: true }),
      },
    })
    expect(deleted).toEqual([candidateKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
  })

  const requests: { body?: unknown; init?: RequestInit; url: string }[] = []
  const client = userApiClientCreate({
    baseUrl: "https://profile-picture-client.example.com",
    fetch: async (input, init) => {
      const url = input.toString()
      requests.push({ body: init?.body, init, url })
      if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "client-csrf-token" })
      return Response.json({ user: accountDemoUserFixture })
    },
  })
  const file = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" })
  expect((await client.userMeProfilePictureUpload("realm-id", file)).success).toBe(true)
  expect(requests.at(-1)?.init?.method).toBe("PUT")
  expect(new Headers(requests.at(-1)?.init?.headers).get("content-type")).toBe("image/png")
  expect(requests.at(-1)?.init?.body).toBe(file)
  expect((await client.userMeProfilePictureRemove("realm-id")).success).toBe(true)
  expect(requests.at(-1)?.init?.method).toBe("DELETE")
  expect(new Headers(requests.at(-1)?.init?.headers).get("x-csrf-token")).toBe("client-csrf-token")
})

test("cleanup intent write failure prevents a user picture PUT", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "profile-picture-intent-failure.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "intent-failure@example.com", profile: {}, userName: "intent-failure" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    database.sqlite.exec(
      "CREATE TRIGGER profile_picture_cleanup_intent_failure BEFORE INSERT ON user_profile_picture_cleanup BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    let puts = 0
    const result = await userProfilePictureUpload({
      body: validPng,
      contentType: "image/png",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage: {
        delete: async () => ({ data: undefined, success: true }),
        put: async () => {
          puts += 1
          return { data: undefined, success: true }
        },
      },
      userId: created.data.user.id,
    })
    expect(result).toMatchObject({ code: "users.write-failed", success: false })
    expect(puts).toBe(0)
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
  })
})

test("failed picture persistence leaves the candidate intent for retry cleanup", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "profile-picture-persistence-failure.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "persistence-failure@example.com", profile: {}, userName: "persistence-failure" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    database.sqlite.exec(
      "CREATE TRIGGER profile_picture_update_failure BEFORE UPDATE OF picture_url ON user_profiles BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    const deleted: string[] = []
    const hash = userPictureHashCreate(validPng)
    expect(hash.success).toBe(true)
    if (!hash.success) return

    const result = await userProfilePictureUpload({
      body: validPng,
      contentType: "image/png",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage: {
        delete: async ({ key }) => {
          deleted.push(key)
          return resultErrorCreate("testR2Delete", "R2 delete failed")
        },
        put: async () => ({ data: undefined, success: true }),
      },
      userId: created.data.user.id,
    })

    expect(result).toMatchObject({ code: "users.write-failed", success: false })
    expect(deleted).toEqual([])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toEqual({
      object_key: expect.stringMatching(
        new RegExp(`^user-pictures/persistence-failure_[0-9a-f]{32}_${hash.data}\\.png$`),
      ),
    })
    const candidateKey = (
      database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get() as {
        object_key: string
      }
    ).object_key
    const failedRetry: string[] = []
    const retried: string[] = []
    await userProfilePictureCleanupDrain({
      database,
      publicOrigin: "https://assets.example.test",
      storage: {
        delete: async ({ key }) => {
          failedRetry.push(key)
          return resultErrorCreate("testR2Delete", "R2 delete failed")
        },
        put: async () => ({ data: undefined, success: true }),
      },
    })
    expect(failedRetry).toEqual([candidateKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toEqual({
      object_key: candidateKey,
    })
    await userProfilePictureCleanupDrain({
      database,
      publicOrigin: "https://assets.example.test",
      storage: {
        delete: async ({ key }) => {
          retried.push(key)
          return { data: undefined, success: true }
        },
        put: async () => ({ data: undefined, success: true }),
      },
    })
    expect(retried).toEqual([candidateKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
    expect(
      userGet({ context: realmSystemContextCreate(), database, realmId: realm.id, userId: created.data.user.id }),
    ).toMatchObject({
      data: { user: { profile: {} } },
      success: true,
    })
  })
})

test("a late successful picture PUT requeues its unique key after stale lease cleanup", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "profile-picture-late-put.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "late-put@example.com", profile: {}, userName: "late-put" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    let putStarted!: () => void
    const putReady = new Promise<void>((resolve) => {
      putStarted = resolve
    })
    let releasePut: (() => void) | undefined
    let hostedKey: string | undefined
    const deleted: string[] = []
    const storage: R2ObjectStorage = {
      delete: async ({ key }) => {
        deleted.push(key)
        return { data: undefined, success: true }
      },
      put: async (input) => {
        hostedKey = input.key
        putStarted()
        await new Promise<void>((resolve) => {
          releasePut = resolve
        })
        return { data: undefined, success: true }
      },
    }
    const upload = userProfilePictureUpload({
      body: validPng,
      contentType: "image/png",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage,
      userId: created.data.user.id,
    })
    await putReady
    testkit.advance(userProfilePictureCleanupLeaseDurationMs)
    expect(
      await userProfilePictureCleanupDrain({
        database,
        publicOrigin: "https://assets.example.test",
        storage,
      }),
    ).toEqual({ data: undefined, success: true })
    expect(hostedKey).toBeString()
    if (hostedKey === undefined) return
    expect(deleted).toEqual([hostedKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()

    releasePut?.()
    expect(await upload).toMatchObject({ code: "users.write-failed", success: false })
    expect(database.sqlite.query("SELECT object_key, state FROM user_profile_picture_cleanup").get()).toEqual({
      object_key: hostedKey,
      state: "pending-delete",
    })
  })
})

test("a delayed stale picture DELETE cannot affect a new picture generation", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "profile-picture-stale-delete.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "stale-delete@example.com", profile: {}, userName: "stale-delete" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const uploaded: string[] = []
    const initialStorage: R2ObjectStorage = {
      delete: async () => ({ data: undefined, success: true }),
      put: async ({ key }) => {
        uploaded.push(key)
        return { data: undefined, success: true }
      },
    }
    expect(
      (
        await userProfilePictureUpload({
          body: validPng,
          contentType: "image/png",
          context: realmSystemContextCreate(),
          database,
          publicOrigin: "https://assets.example.test",
          realmId: realm.id,
          storage: initialStorage,
          userId: created.data.user.id,
        })
      ).success,
    ).toBe(true)
    const oldKey = uploaded[0]
    expect(oldKey).toBeString()
    if (oldKey === undefined) return
    expect(
      userProfileUpdate({
        context: realmSystemContextCreate(),
        database,
        input: {},
        picture: null,
        pictureCleanupPublicOrigin: "https://assets.example.test",
        realmId: realm.id,
        userId: created.data.user.id,
      }).success,
    ).toBe(true)
    expect(database.sqlite.query("SELECT object_key, state FROM user_profile_picture_cleanup").get()).toEqual({
      object_key: oldKey,
      state: "pending-delete",
    })

    let deleteStarted!: () => void
    const deleteReady = new Promise<void>((resolve) => {
      deleteStarted = resolve
    })
    let releaseDelete: (() => void) | undefined
    const deleted: string[] = []
    const storage: R2ObjectStorage = {
      delete: async ({ key }) => {
        deleted.push(key)
        if (key === oldKey) {
          deleteStarted()
          await new Promise<void>((resolve) => {
            releaseDelete = resolve
          })
        }
        return { data: undefined, success: true }
      },
      put: async ({ key }) => {
        uploaded.push(key)
        return { data: undefined, success: true }
      },
    }
    const staleCleanup = userProfilePictureCleanupDrain({
      database,
      publicOrigin: "https://assets.example.test",
      storage,
    })
    await deleteReady

    const replacement = await userProfilePictureUpload({
      body: validPng,
      contentType: "image/png",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage,
      userId: created.data.user.id,
    })
    expect(replacement.success).toBe(true)
    const newKey = uploaded[1]
    expect(newKey).toBeString()
    if (newKey === undefined) return
    expect(newKey).not.toBe(oldKey)
    expect(deleted).toEqual([oldKey])

    releaseDelete?.()
    expect(await staleCleanup).toEqual({ data: undefined, success: true })
    expect(deleted).toEqual([oldKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
  })
})

test("a lost provider picture race removes only the losing object", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "profile-picture-race.example.com")
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "race@example.com", profile: {}, userName: "race-user" },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    let fetchCount = 0
    let putCount = 0
    const putWaiters: (() => void)[] = []
    const uploaded: string[] = []
    const deleted: string[] = []
    const storage: R2ObjectStorage = {
      delete: async ({ key }: { readonly key: string }) => {
        deleted.push(key)
        return { data: undefined, success: true }
      },
      put: async (input: Parameters<R2ObjectStorage["put"]>[0]) => {
        uploaded.push(input.key)
        putCount += 1
        const wait = new Promise<void>((resolve) => putWaiters.push(resolve))
        if (putCount === 2) for (const resolve of putWaiters) resolve()
        await wait
        return { data: undefined, success: true }
      },
    }
    const fetcher = Object.assign(
      async () => {
        const body = fetchCount === 0 ? validPng : validJpeg
        fetchCount += 1
        return new Response(body, { headers: { "content-type": body === validPng ? "image/png" : "image/jpeg" } })
      },
      { preconnect: fetch.preconnect },
    )
    const importPicture = (sourceUrl: string) =>
      userProfilePictureImport({
        database,
        fetch: fetcher,
        publicOrigin: "https://assets.example.test",
        resolve: async () => ["8.8.8.8"],
        sourceUrl,
        storage,
        realmId: realm.id,
        userId: created.data.user.id,
      })

    const results = await Promise.all([
      importPicture("https://provider.example/race-one.png"),
      importPicture("https://provider.example/race-two.png"),
    ])
    expect(results.every((result) => result.success)).toBe(true)
    expect(uploaded).toHaveLength(2)
    expect(deleted).toHaveLength(0)
    const cleanupRows = database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").all() as {
      object_key: string
    }[]
    expect(cleanupRows).toHaveLength(1)
    const losingKey = cleanupRows[0]?.object_key
    expect(losingKey).toBeString()
    if (losingKey === undefined) return
    expect(uploaded).toContain(losingKey)
    const current = userGet({
      context: realmSystemContextCreate(),
      database,
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(current.success).toBe(true)
    if (!current.success) return
    expect(current.data.user.profile.picture?.url).not.toContain(losingKey)
    await userProfilePictureCleanupDrain({ database, publicOrigin: "https://assets.example.test", storage })
    expect(deleted).toEqual([losingKey])
  })
})

test("replacement cleanup failure does not roll back the persisted picture and foreign removal is safe", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "profile-picture-cleanup-failure.example.com")
    const oldKey = `user-pictures/cleanup-failure_${"0".repeat(32)}_${"0".repeat(64)}.png`
    const created = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        email: "cleanup-failure@example.com",
        profile: {},
        userName: "cleanup-failure",
      },
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    database.sqlite
      .query("UPDATE user_profiles SET picture_url = ?, picture_content_type = ? WHERE user_id = ?")
      .run(`https://assets.example.test/${oldKey}`, "image/png", created.data.user.id)
    const deleted: string[] = []
    const replacement = await userProfilePictureUpload({
      body: validJpeg,
      contentType: "image/jpeg",
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage: {
        delete: async ({ key }) => {
          deleted.push(key)
          return resultErrorCreate("testR2Delete", "R2 delete failed")
        },
        put: async () => ({ data: undefined, success: true }),
      },
      userId: created.data.user.id,
    })
    expect(replacement).toMatchObject({
      data: { user: { profile: { picture: { contentType: "image/jpeg" } } } },
      success: true,
    })
    expect(deleted).toEqual([oldKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toEqual({
      object_key: oldKey,
    })
    expect(userProfilePictureCleanupEnqueue({ database, objectKey: oldKey }).success).toBe(true)
    expect(userProfilePictureCleanupEnqueue({ database, objectKey: oldKey }).success).toBe(true)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM user_profile_picture_cleanup").get()).toEqual({
      count: 1,
    })
    expect(database.sqlite.query("PRAGMA foreign_key_list(user_profile_picture_cleanup)").all()).toEqual([])
    const retried: string[] = []
    await userProfilePictureCleanupDrain({
      database,
      publicOrigin: "https://assets.example.test",
      storage: {
        delete: async ({ key }) => {
          retried.push(key)
          return { data: undefined, success: true }
        },
        put: async () => ({ data: undefined, success: true }),
      },
    })
    expect(retried).toEqual([oldKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
    expect(
      userGet({ context: realmSystemContextCreate(), database, realmId: realm.id, userId: created.data.user.id }),
    ).toMatchObject({
      data: { user: { profile: { picture: { contentType: "image/jpeg" } } } },
      success: true,
    })

    const foreign = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: {
        email: "foreign-picture@example.com",
        profile: {},
        userName: "foreign-picture",
      },
      realmId: realm.id,
    })
    expect(foreign.success).toBe(true)
    if (!foreign.success) return
    const foreignKey = `user-pictures/another-user_${"1".repeat(32)}_${"1".repeat(64)}.png`
    database.sqlite
      .query("UPDATE user_profiles SET picture_url = ?, picture_content_type = ? WHERE user_id = ?")
      .run(`https://assets.example.test/${foreignKey}`, "image/png", foreign.data.user.id)
    const foreignDeleted: string[] = []
    const removed = await userProfilePictureRemove({
      context: realmSystemContextCreate(),
      database,
      publicOrigin: "https://assets.example.test",
      realmId: realm.id,
      storage: {
        delete: async ({ key }) => {
          foreignDeleted.push(key)
          return { data: undefined, success: true }
        },
        put: async () => ({ data: undefined, success: true }),
      },
      userId: foreign.data.user.id,
    })
    expect(removed).toMatchObject({ data: { user: { profile: {} } }, success: true })
    expect(foreignDeleted).toEqual([])
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
