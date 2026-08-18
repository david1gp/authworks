import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { instanceCreate } from "../../src/features/instances/actions/instanceCreate.js"
import { instanceSystemContextCreate } from "../../src/features/instances/domain/instanceSystemContextCreate.js"
import { instanceTenantContextCreate } from "../../src/features/instances/domain/instanceTenantContextCreate.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userDelete } from "../../src/features/users/actions/userDelete.js"
import { userEmailVerificationSet } from "../../src/features/users/actions/userEmailVerificationSet.js"
import { userGet } from "../../src/features/users/actions/userGet.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userList } from "../../src/features/users/actions/userList.js"
import { userProfileUpdate } from "../../src/features/users/actions/userProfileUpdate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "zitadel-v2-users-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "zitadel.sqlite"), testkit.runtime)
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

async function createInstance(database: StorageDatabase, domain: string) {
  const created = instanceCreate({
    context: instanceSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.instance
}

function createInput(userName: string, email: string) {
  return {
    email,
    profile: { displayName: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace" },
    userName,
  }
}

test("users, profiles, verification, lifecycle, and deletion are tenant scoped", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createInstance(database, "users-alpha.example.com")
    const beta = await createInstance(database, "users-beta.example.com")
    const system = instanceSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput(" Ada ", "Ada@Example.com"),
      instanceId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.user.userName).toBe("ada")
    expect(created.data.user.email).toBe("ada@example.com")
    expect(created.data.user.state).toBe("initial")
    expect(created.data.user.emailVerified).toBe(false)
    expect(created.data.user.verificationState).toBe("unverified")
    expect(created.data.user.profile.displayName).toBe("Ada Lovelace")

    const betaUser = userCreate({
      context: system,
      database,
      input: createInput("Grace", "grace@example.com"),
      instanceId: beta.id,
    })
    expect(betaUser.success).toBe(true)
    const alphaUsers = userList({ context: system, database, instanceId: alpha.id })
    expect(alphaUsers.success).toBe(true)
    if (!alphaUsers.success) return
    expect(alphaUsers.data.users).toHaveLength(1)
    expect(userGet({ context: system, database, instanceId: beta.id, userId: created.data.user.id })).toEqual({
      errorMessage: "The user was not found.",
      op: "userGet",
      success: false,
    })
    expect(
      userList({ context: instanceTenantContextCreate(alpha.id, "actor"), database, instanceId: beta.id }),
    ).toEqual({ errorMessage: "The users are not available in this tenant context.", op: "userList", success: false })

    const profileEventCount = database.db.select().from(storageEventTable).all().length
    const profile = userProfileUpdate({
      context: instanceTenantContextCreate(alpha.id, "actor"),
      database,
      input: { displayName: "  Ada L.  " },
      instanceId: alpha.id,
      userId: created.data.user.id,
    })
    expect(profile.success).toBe(true)
    if (!profile.success) return
    expect(profile.data.user.profile.displayName).toBe("Ada L.")
    expect(
      userProfileUpdate({
        context: system,
        database,
        input: {},
        instanceId: alpha.id,
        userId: created.data.user.id,
      }).success,
    ).toBe(false)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(profileEventCount + 1)

    const verified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "verified" },
      instanceId: alpha.id,
      userId: created.data.user.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    expect(verified.data.user.emailVerified).toBe(true)
    expect(verified.data.user.verificationState).toBe("verified")
    expect(verified.data.user.emailVerifiedAt).toBe(testkit.runtime.now())

    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "locked" },
        instanceId: alpha.id,
        userId: created.data.user.id,
      }).success,
    ).toBe(false)
    const active = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      instanceId: alpha.id,
      userId: created.data.user.id,
    })
    expect(active.success).toBe(true)
    const locked = userLifecycleSet({
      context: system,
      database,
      input: { state: "locked" },
      instanceId: alpha.id,
      userId: created.data.user.id,
    })
    expect(locked.success).toBe(true)

    const deleted = userDelete({
      context: system,
      database,
      instanceId: alpha.id,
      userId: created.data.user.id,
    })
    expect(deleted.success).toBe(true)
    if (!deleted.success) return
    expect(deleted.data.user.state).toBe("deleted")
    const remainingUsers = userList({ context: system, database, instanceId: alpha.id })
    expect(remainingUsers.success).toBe(true)
    if (!remainingUsers.success) return
    expect(remainingUsers.data.users).toHaveLength(0)
    expect(userGet({ context: system, database, instanceId: alpha.id, userId: created.data.user.id }).success).toBe(
      false,
    )
    const deletedEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateId === created.data.user.id)
    expect(deletedEvents.at(-1)?.eventType).toBe(userEventTypes.deleted)
    const deletedEventCount = database.db.select().from(storageEventTable).all().length
    expect(userDelete({ context: system, database, instanceId: alpha.id, userId: created.data.user.id })).toEqual({
      errorMessage: "The user has already been deleted.",
      op: "userDelete",
      success: false,
    })
    expect(
      userProfileUpdate({
        context: system,
        database,
        input: { displayName: "After deletion" },
        instanceId: alpha.id,
        userId: created.data.user.id,
      }),
    ).toEqual({ errorMessage: "The user was not found.", op: "userProfileUpdate", success: false })
    expect(
      userEmailVerificationSet({
        context: system,
        database,
        input: { state: "verified" },
        instanceId: alpha.id,
        userId: created.data.user.id,
      }),
    ).toEqual({ errorMessage: "The user was not found.", op: "userEmailVerificationSet", success: false })
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "active" },
        instanceId: alpha.id,
        userId: created.data.user.id,
      }),
    ).toEqual({ errorMessage: "The user was not found.", op: "userLifecycleSet", success: false })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(deletedEventCount)
  })
})

test("user creation rejects normalized duplicate names and emails without changing state", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "duplicate-users.example.com")
    const system = instanceSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("Ada", "ada@example.com"),
      instanceId: instance.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const eventCount = database.db.select().from(storageEventTable).all().length
    expect(
      userCreate({
        context: system,
        database,
        input: createInput(" ADA ", "other@example.com"),
        instanceId: instance.id,
      }),
    ).toEqual({
      errorMessage: "A user with that name or email already exists in this instance.",
      op: "userCreate",
      success: false,
    })
    expect(
      userCreate({
        context: system,
        database,
        input: createInput("other", " ADA@EXAMPLE.COM "),
        instanceId: instance.id,
      }),
    ).toEqual({
      errorMessage: "A user with that name or email already exists in this instance.",
      op: "userCreate",
      success: false,
    })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)
    const listed = userList({ context: system, database, instanceId: instance.id })
    expect(listed.success).toBe(true)
    if (listed.success) expect(listed.data.users).toHaveLength(1)
  })
})

test("user profile and email verification no-ops preserve the aggregate", async () => {
  await withDatabase(async (database, testkit) => {
    const instance = await createInstance(database, "user-no-ops.example.com")
    const system = instanceSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("no-op-user", "no-op@example.com"),
      instanceId: instance.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const before = userGet({ context: system, database, instanceId: instance.id, userId: created.data.user.id })
    expect(before.success).toBe(true)
    if (!before.success) return
    const eventCount = database.db.select().from(storageEventTable).all().length
    const unchangedProfile = userProfileUpdate({
      context: system,
      database,
      input: { displayName: "  Ada Lovelace  " },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(unchangedProfile.success).toBe(true)
    if (!unchangedProfile.success) return
    expect(unchangedProfile.data.user.profile.displayName).toBe("Ada Lovelace")
    expect(unchangedProfile.data.user.updatedAt).toBe(before.data.user.updatedAt)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)

    testkit.advance(10)
    const verified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "verified" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    const duplicateVerified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "verified" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(duplicateVerified).toEqual({
      errorMessage: "The user already has that verification state.",
      op: "userEmailVerificationSet",
      success: false,
    })

    testkit.advance(10)
    const unverified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "unverified" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(unverified.success).toBe(true)
    if (!unverified.success) return
    expect(unverified.data.user.emailVerified).toBe(false)
    expect(unverified.data.user.verificationState).toBe("unverified")
    expect(unverified.data.user.emailVerifiedAt).toBeUndefined()
    expect(
      userEmailVerificationSet({
        context: system,
        database,
        input: { state: "unverified" },
        instanceId: instance.id,
        userId: created.data.user.id,
      }),
    ).toEqual({
      errorMessage: "The user already has that verification state.",
      op: "userEmailVerificationSet",
      success: false,
    })
    const events = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateId === created.data.user.id)
    expect(events.map((event) => event.aggregateVersion)).toEqual([1, 2, 3])
    expect(events.map((event) => event.eventType)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.emailVerificationChanged,
    ])
  })
})

test("user lifecycle rejects same-state changes and supports suspended users", async () => {
  await withDatabase(async (database) => {
    const instance = await createInstance(database, "lifecycle-users.example.com")
    const system = instanceSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("lifecycle-user", "lifecycle@example.com"),
      instanceId: instance.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const inactive = userLifecycleSet({
      context: system,
      database,
      input: { state: "inactive" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(inactive.success).toBe(true)
    if (!inactive.success) return
    const eventCount = database.db.select().from(storageEventTable).all().length
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "inactive" },
        instanceId: instance.id,
        userId: created.data.user.id,
      }),
    ).toEqual({ errorMessage: "The user lifecycle transition is not allowed.", op: "userLifecycleSet", success: false })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)

    const active = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(active.success).toBe(true)
    const suspended = userLifecycleSet({
      context: system,
      database,
      input: { state: "suspended" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(suspended.success).toBe(true)
    const reactivated = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(reactivated.success).toBe(true)
    const events = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateId === created.data.user.id)
    expect(events.map((event) => event.aggregateVersion)).toEqual([1, 2, 3, 4, 5])
    expect(events.map((event) => event.eventType)).toEqual([
      userEventTypes.created,
      userEventTypes.stateChanged,
      userEventTypes.stateChanged,
      userEventTypes.stateChanged,
      userEventTypes.stateChanged,
    ])
  })
})

test("user events are audit-safe, versioned, and atomically rolled back", async () => {
  await withDatabase(async (database, testkit) => {
    const instance = await createInstance(database, "events-users.example.com")
    const system = instanceSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("event-user", "secret@example.com"),
      instanceId: instance.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const events = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateType === "user")
    expect(events.map((event) => event.eventType)).toEqual([userEventTypes.created])
    expect(events[0]?.aggregateVersion).toBe(1)
    expect(events[0]?.id).toMatch(/^[0-9a-f-]+$/)
    expect(JSON.stringify(events)).not.toContain("secret@example.com")
    expect(JSON.stringify(events)).not.toContain("password")
    expect(JSON.stringify(events)).not.toContain("token")

    database.sqlite.run(
      "CREATE TRIGGER reject_user_events BEFORE INSERT ON events WHEN NEW.aggregate_type = 'user' BEGIN SELECT RAISE(ABORT, 'event rejected'); END",
    )
    const before = database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()
    const rejected = userCreate({
      context: system,
      database,
      input: createInput("rolled-back", "rollback@example.com"),
      instanceId: instance.id,
    })
    expect(rejected.success).toBe(false)
    expect(database.sqlite.query("SELECT COUNT(*) AS count FROM users").get()).toEqual(before)
    expect(
      database.db
        .select()
        .from(storageEventTable)
        .all()
        .filter((event) => event.aggregateType === "user"),
    ).toHaveLength(1)
    database.sqlite.run("DROP TRIGGER reject_user_events")

    testkit.advance(10)
    const verified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "verified" },
      instanceId: instance.id,
      userId: created.data.user.id,
    })
    expect(verified.success).toBe(true)
    const finalEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateType === "user")
    expect(finalEvents.map((event) => event.aggregateVersion)).toEqual([1, 2])
    expect(finalEvents.map((event) => event.instanceId)).toEqual([instance.id, instance.id])
  })
})

test("user routes and API client enforce public schemas and authorization", async () => {
  await withDatabase(async (database) => {
    const app = userServerAppCreate({ database, systemSecret: "system-secret" })
    const instance = await createInstance(database, "api-users.example.com")
    const client = userApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const created = await client.userCreate(instance.id, createInput("api-user", "api@example.com"))
    expect(created.success).toBe(true)
    if (!created.success) return
    const listed = await client.userList(instance.id)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.users).toHaveLength(1)
    const profile = await client.userProfileUpdate(instance.id, created.data.user.id, { displayName: "API User" })
    expect(profile.success).toBe(true)
    const unauthorized = await userApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).userList(instance.id)
    expect(unauthorized.success).toBe(false)
    const malformed = await client.userCreate(instance.id, { email: "bad", profile: {}, userName: "" })
    expect(malformed.success).toBe(false)
  })
})

test("user CLI exposes administration commands without opening SQLite", async () => {
  const helpProcess = Bun.spawn(["bun", "src/outputs/cli.ts", "users", "--help"], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const helpOutput = await new Response(helpProcess.stdout).text()
  expect(await helpProcess.exited).toBe(0)
  expect(helpOutput).toContain("User administration")
})
