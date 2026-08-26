import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { userProfilePictureCleanupDrain } from "../../src/features/users/actions/userProfilePictureCleanupDrain.js"
import { userProfilePictureCleanupEnqueue } from "../../src/features/users/actions/userProfilePictureCleanupEnqueue.js"
import { userProfilePictureCleanupReserve } from "../../src/features/users/actions/userProfilePictureCleanupReserve.js"
import { userProfilePictureCleanupUploadFailure } from "../../src/features/users/actions/userProfilePictureCleanupUploadFailure.js"
import { userProfilePictureCleanupRetryLifecycleCreate } from "../../src/features/users/server/userProfilePictureCleanupRetryLifecycleCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../src/platform/errors/resultErrorCreate.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

test("profile picture cleanup retries a transient delete failure and clears the queue", async () => {
  await withDatabase(async (database) => {
    const objectKey = `user-pictures/retry_${"a".repeat(32)}_${"a".repeat(64)}.png`
    expect(userProfilePictureCleanupEnqueue({ database, objectKey }).success).toBe(true)
    let timerHandler: (() => void) | undefined
    let attempts = 0
    const logs: string[] = []
    const lifecycle = userProfilePictureCleanupRetryLifecycleCreate({
      database,
      intervalMs: 1,
      log: (message) => logs.push(message),
      publicOrigin: "https://assets.example.test",
      setInterval: (handler) => {
        timerHandler = handler
        return 1
      },
      storage: {
        delete: async () => {
          attempts += 1
          return attempts === 1
            ? resultErrorCreate("testR2Delete", "R2 is unavailable.")
            : { data: undefined, success: true }
        },
        put: async () => ({ data: undefined, success: true }),
      },
    })

    expect(await lifecycle.start()).toEqual({ success: true, data: undefined })
    expect(attempts).toBe(1)
    expect(logs).toHaveLength(1)
    expect(
      database.sqlite
        .query("SELECT object_key, state, lease_token, lease_until FROM user_profile_picture_cleanup")
        .get(),
    ).toEqual({
      lease_token: null,
      lease_until: null,
      object_key: objectKey,
      state: "pending-delete",
    })
    timerHandler?.()
    await Promise.resolve()
    expect(attempts).toBe(2)
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
    lifecycle.stop()
  })
})

test("profile picture cleanup does not overlap drains and unreferences its timer", async () => {
  await withDatabase(async (database) => {
    const objectKey = `user-pictures/overlap_${"b".repeat(32)}_${"b".repeat(64)}.jpg`
    expect(userProfilePictureCleanupEnqueue({ database, objectKey }).success).toBe(true)
    let timerHandler: (() => void) | undefined
    let release: (() => void) | undefined
    let attempts = 0
    let unrefCalls = 0
    let cleared = 0
    const lifecycle = userProfilePictureCleanupRetryLifecycleCreate({
      clearInterval: () => {
        cleared += 1
      },
      database,
      publicOrigin: "https://assets.example.test",
      setInterval: (handler) => {
        timerHandler = handler
        return {
          unref: () => {
            unrefCalls += 1
          },
        }
      },
      storage: {
        delete: async () => {
          attempts += 1
          await new Promise<void>((resolve) => {
            release = resolve
          })
          return { data: undefined, success: true }
        },
        put: async () => ({ data: undefined, success: true }),
      },
    })

    const started = lifecycle.start()
    await Promise.resolve()
    timerHandler?.()
    timerHandler?.()
    expect(attempts).toBe(1)
    release?.()
    expect(await started).toEqual({ success: true, data: undefined })
    lifecycle.stop()
    lifecycle.stop()
    expect(unrefCalls).toBe(1)
    expect(cleared).toBe(1)
  })
})

test("independent cleanup drains claim a key only once", async () => {
  await withDatabase(async (database) => {
    const objectKey = `user-pictures/processes_${"2".repeat(32)}_${"2".repeat(64)}.png`
    expect(userProfilePictureCleanupEnqueue({ database, objectKey }).success).toBe(true)
    let release: (() => void) | undefined
    let attempts = 0
    const storage = {
      delete: async () => {
        attempts += 1
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return resultCreate(undefined)
      },
      put: async () => resultCreate(undefined),
    }

    const first = userProfilePictureCleanupDrain({ database, publicOrigin: "https://assets.example.test", storage })
    await Promise.resolve()
    const second = userProfilePictureCleanupDrain({ database, publicOrigin: "https://assets.example.test", storage })
    await Promise.resolve()
    expect(attempts).toBe(1)
    release?.()
    expect(await first).toEqual({ data: undefined, success: true })
    expect(await second).toEqual({ data: undefined, success: true })
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
  })
})

test("same-key upload reservations are exclusive and failed uploads return the key to pending-delete", async () => {
  await withDatabase(async (database) => {
    const objectKey = `user-pictures/same-key_${"c".repeat(32)}_${"c".repeat(64)}.png`
    const first = userProfilePictureCleanupReserve({ database, objectKey })
    const second = userProfilePictureCleanupReserve({ database, objectKey })
    expect(first.success).toBe(true)
    expect(second.success).toBe(false)
    if (!first.success) return

    expect(userProfilePictureCleanupUploadFailure({ database, leaseToken: first.data.leaseToken, objectKey })).toEqual({
      data: undefined,
      success: true,
    })
    expect(
      database.sqlite.query("SELECT state, lease_token, lease_until FROM user_profile_picture_cleanup").get(),
    ).toEqual({
      lease_token: null,
      lease_until: null,
      state: "pending-delete",
    })
  })
})

test("cleanup claims before R2 DELETE and rejects a racing same-key PUT", async () => {
  await withDatabase(async (database) => {
    const objectKey = `user-pictures/racing_${"d".repeat(32)}_${"d".repeat(64)}.png`
    expect(userProfilePictureCleanupEnqueue({ database, objectKey }).success).toBe(true)
    let racingUpload: ReturnType<typeof userProfilePictureCleanupReserve> | undefined
    let puts = 0
    const deleted: string[] = []
    await userProfilePictureCleanupDrain({
      database,
      publicOrigin: "https://assets.example.test",
      storage: {
        delete: async ({ key }) => {
          deleted.push(key)
          racingUpload = userProfilePictureCleanupReserve({ database, objectKey })
          return { data: undefined, success: true }
        },
        put: async () => {
          puts += 1
          return { data: undefined, success: true }
        },
      },
    })
    expect(racingUpload?.success).toBe(false)
    expect(puts).toBe(0)
    expect(deleted).toEqual([objectKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
  })
})

test("stale uploading and deleting leases recover through the protective cleanup claim", async () => {
  await withDatabase(async (database, testkit) => {
    const uploadingKey = `user-pictures/stale-upload_${"e".repeat(32)}_${"e".repeat(64)}.png`
    const deletingKey = `user-pictures/stale-delete_${"f".repeat(32)}_${"f".repeat(64)}.png`
    database.sqlite
      .query(
        "INSERT INTO user_profile_picture_cleanup (object_key, created_at, state, lease_until, lease_token) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      )
      .run(uploadingKey, 1, "uploading", 10, "upload-token", deletingKey, 2, "deleting", 10, "delete-token")
    testkit.setNow(10)
    const deleted: string[] = []
    const drained = await userProfilePictureCleanupDrain({
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
    expect(drained.success).toBe(true)
    expect(deleted).toEqual([uploadingKey, deletingKey])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").all()).toEqual([])
  })
})

test("stale lease recovery does not delete an object that is referenced by an active profile", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate(),
      database,
      input: { domain: "stale-reference.example.com", name: "Stale reference" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const user = userCreate({
      context: realmSystemContextCreate(),
      database,
      input: { email: "stale-reference@example.com", profile: {}, userName: "stale-reference" },
      realmId: realm.data.realm.id,
    })
    expect(user.success).toBe(true)
    if (!user.success) return
    const objectKey = `user-pictures/stale-reference_${"1".repeat(32)}_${"1".repeat(64)}.png`
    database.sqlite
      .query("UPDATE user_profiles SET picture_url = ?, picture_content_type = ? WHERE user_id = ?")
      .run(`https://assets.example.test/${objectKey}`, "image/png", user.data.user.id)
    database.sqlite
      .query(
        "INSERT INTO user_profile_picture_cleanup (object_key, created_at, state, lease_until, lease_token) VALUES (?, ?, ?, ?, ?)",
      )
      .run(objectKey, 1, "deleting", 1, "expired-token")

    const deleted: string[] = []
    const drained = await userProfilePictureCleanupDrain({
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
    expect(drained.success).toBe(true)
    expect(deleted).toEqual([])
    expect(database.sqlite.query("SELECT object_key FROM user_profile_picture_cleanup").get()).toBeNull()
  })
})

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-profile-picture-cleanup-retry-"))
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
