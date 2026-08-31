import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { mfaRecoveryCodesGenerate } from "../../src/features/mfa/actions/mfaRecoveryCodesGenerate.js"
import { mfaRecoveryCodeVerify } from "../../src/features/mfa/actions/mfaRecoveryCodeVerify.js"
import { mfaTotpEnrollmentConfirm } from "../../src/features/mfa/actions/mfaTotpEnrollmentConfirm.js"
import { mfaTotpEnrollmentStart } from "../../src/features/mfa/actions/mfaTotpEnrollmentStart.js"
import { mfaTotpCodeCreate } from "../../src/features/mfa/domain/mfaTotpCodeCreate.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationLoginPolicySet } from "../../src/features/organizations/actions/organizationLoginPolicySet.js"
import { passkeyRepositoryCreate } from "../../src/features/passkeys/persistence/passkeyRepositoryCreate.js"
import { passwordRepositoryCreate } from "../../src/features/passwords/persistence/passwordRepositoryCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionCsrfTokenCreate } from "../../src/features/sessions/domain/sessionCsrfTokenCreate.js"
import { userAuthenticationMethodsGet } from "../../src/features/users/actions/userAuthenticationMethodsGet.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userDelete } from "../../src/features/users/actions/userDelete.js"
import { userEmailVerificationSet } from "../../src/features/users/actions/userEmailVerificationSet.js"
import { userGet } from "../../src/features/users/actions/userGet.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userList } from "../../src/features/users/actions/userList.js"
import { userProfileUpdate } from "../../src/features/users/actions/userProfileUpdate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { userEventTypes } from "../../src/features/users/events/userEventTypes.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { userCurrentResponseSchema } from "../../src/features/users/public/userCurrentResponseSchema.js"
import { userResponseSchema } from "../../src/features/users/public/userResponseSchema.js"
import { userAccountSummaryResolve } from "../../src/features/users/server/userAccountSummaryResolve.js"
import { userServerAppCreate } from "../../src/features/users/server/userServerAppCreate.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-users-"))
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

async function createRealm(database: StorageDatabase, domain: string) {
  const created = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.realm
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
    const alpha = await createRealm(database, "users-alpha.example.com")
    const beta = await createRealm(database, "users-beta.example.com")
    const system = realmSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput(" Ada ", "Ada@Example.com"),
      realmId: alpha.id,
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
      realmId: beta.id,
    })
    expect(betaUser.success).toBe(true)
    const alphaUsers = userList({ context: system, database, realmId: alpha.id })
    expect(alphaUsers.success).toBe(true)
    if (!alphaUsers.success) return
    expect(alphaUsers.data.items).toHaveLength(1)
    expect(userGet({ context: system, database, realmId: beta.id, userId: created.data.user.id })).toEqual({
      code: "users.not-found",
      errorMessage: "The user was not found.",
      op: "userGet",
      success: false,
    })
    expect(userList({ context: realmTenantContextCreate(alpha.id, "actor"), database, realmId: beta.id })).toEqual({
      code: "users.tenant-mismatch",
      errorMessage: "The users are not available in this tenant context.",
      op: "userList",
      success: false,
    })

    const profileEventCount = database.db.select().from(storageEventTable).all().length
    const profile = userProfileUpdate({
      context: realmTenantContextCreate(alpha.id, "actor"),
      database,
      input: { displayName: "  Ada L.  " },
      realmId: alpha.id,
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
        realmId: alpha.id,
        userId: created.data.user.id,
      }).success,
    ).toBe(false)
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(profileEventCount + 1)

    const verified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "verified" },
      realmId: alpha.id,
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
        realmId: alpha.id,
        userId: created.data.user.id,
      }).success,
    ).toBe(false)
    const active = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(active.success).toBe(true)
    const locked = userLifecycleSet({
      context: system,
      database,
      input: { state: "locked" },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(locked.success).toBe(true)

    const deleted = await userDelete({
      context: system,
      database,
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(deleted.success).toBe(true)
    if (!deleted.success) return
    expect(deleted.data.user.state).toBe("deleted")
    const remainingUsers = userList({ context: system, database, realmId: alpha.id })
    expect(remainingUsers.success).toBe(true)
    if (!remainingUsers.success) return
    expect(remainingUsers.data.items).toHaveLength(0)
    expect(userGet({ context: system, database, realmId: alpha.id, userId: created.data.user.id }).success).toBe(false)
    const deletedEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateId === created.data.user.id)
    expect(deletedEvents.at(-1)?.eventType).toBe(userEventTypes.deleted)
    const deletedEventCount = database.db.select().from(storageEventTable).all().length
    expect(await userDelete({ context: system, database, realmId: alpha.id, userId: created.data.user.id })).toEqual({
      code: "users.already-deleted",
      errorMessage: "The user has already been deleted.",
      op: "userDelete",
      success: false,
    })
    expect(
      userProfileUpdate({
        context: system,
        database,
        input: { displayName: "After deletion" },
        realmId: alpha.id,
        userId: created.data.user.id,
      }),
    ).toEqual({
      code: "users.not-found",
      errorMessage: "The user was not found.",
      op: "userProfileUpdate",
      success: false,
    })
    expect(
      userEmailVerificationSet({
        context: system,
        database,
        input: { state: "verified" },
        realmId: alpha.id,
        userId: created.data.user.id,
      }),
    ).toEqual({
      code: "users.not-found",
      errorMessage: "The user was not found.",
      op: "userEmailVerificationSet",
      success: false,
    })
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "active" },
        realmId: alpha.id,
        userId: created.data.user.id,
      }),
    ).toEqual({
      code: "users.not-found",
      errorMessage: "The user was not found.",
      op: "userLifecycleSet",
      success: false,
    })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(deletedEventCount)
  })
})

test("user creation rejects normalized duplicate names and emails without changing state", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "duplicate-users.example.com")
    const system = realmSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("Ada", "ada@example.com"),
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const eventCount = database.db.select().from(storageEventTable).all().length
    expect(
      userCreate({
        context: system,
        database,
        input: createInput(" ADA ", "other@example.com"),
        realmId: realm.id,
      }),
    ).toEqual({
      code: "users.already-exists",
      errorMessage: "A user with that name or email already exists in this realm.",
      op: "userCreate",
      success: false,
    })
    expect(
      userCreate({
        context: system,
        database,
        input: createInput("other", " ADA@EXAMPLE.COM "),
        realmId: realm.id,
      }),
    ).toEqual({
      code: "users.already-exists",
      errorMessage: "A user with that name or email already exists in this realm.",
      op: "userCreate",
      success: false,
    })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)
    const listed = userList({ context: system, database, realmId: realm.id })
    expect(listed.success).toBe(true)
    if (listed.success) expect(listed.data.items).toHaveLength(1)
  })
})

test("user profile and email verification no-ops preserve the aggregate", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "user-no-ops.example.com")
    const system = realmSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("no-op-user", "no-op@example.com"),
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const before = userGet({ context: system, database, realmId: realm.id, userId: created.data.user.id })
    expect(before.success).toBe(true)
    if (!before.success) return
    const eventCount = database.db.select().from(storageEventTable).all().length
    const unchangedProfile = userProfileUpdate({
      context: system,
      database,
      input: { displayName: "  Ada Lovelace  " },
      realmId: realm.id,
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
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    const duplicateVerified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(duplicateVerified).toEqual({
      code: "users.conflict",
      errorMessage: "The user already has that verification state.",
      op: "userEmailVerificationSet",
      success: false,
    })

    testkit.advance(10)
    const unverified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "unverified" },
      realmId: realm.id,
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
        realmId: realm.id,
        userId: created.data.user.id,
      }),
    ).toEqual({
      code: "users.conflict",
      errorMessage: "The user already has that verification state.",
      op: "userEmailVerificationSet",
      success: false,
    })
    const events = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateId === created.data.user.id)
    expect(events.map((event) => event.aggregateVersion)).toEqual([1, 2, 3, 4, 5])
    expect(events.map((event) => event.eventType)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.registrationVerificationChanged,
      userEventTypes.emailVerificationChanged,
      userEventTypes.registrationVerificationChanged,
    ])
  })
})

test("system verification repairs migrated registration state without weakening tenant conflicts", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "migrated-verification.example.com")
    const created = userCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: createInput("migrated-user", "migrated@example.com"),
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const initialVerification = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(initialVerification.success).toBe(true)
    if (!initialVerification.success) return
    const emailVerifiedAt = initialVerification.data.user.emailVerifiedAt
    if (emailVerifiedAt === undefined) return

    const repository = userRepositoryCreate(database.db)
    const cleared = repository.userUpdate(realm.id, created.data.user.id, {
      registrationVerifiedAt: null,
      registrationVerificationMethod: null,
    })
    expect(cleared.success).toBe(true)

    const tenantAttempt = userEmailVerificationSet({
      context: realmTenantContextCreate(realm.id, "operator"),
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(tenantAttempt).toEqual({
      code: "users.conflict",
      errorMessage: "The user already has that verification state.",
      op: "userEmailVerificationSet",
      success: false,
    })

    testkit.advance(10)
    const repaired = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(repaired).toMatchObject({
      data: {
        user: {
          emailVerifiedAt,
          registrationVerificationMethod: "email",
          registrationVerifiedAt: testkit.runtime.now(),
          verificationState: "verified",
        },
      },
      success: true,
    })
    const events = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateId === created.data.user.id)
    expect(events.map((event) => event.eventType)).toEqual([
      userEventTypes.created,
      userEventTypes.emailVerificationChanged,
      userEventTypes.registrationVerificationChanged,
      userEventTypes.registrationVerificationChanged,
    ])

    const duplicateRepair = userEmailVerificationSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "verified" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(duplicateRepair).toMatchObject({ code: "users.conflict", success: false })
    expect(
      database.db
        .select()
        .from(storageEventTable)
        .all()
        .filter((event) => event.aggregateId === created.data.user.id),
    ).toHaveLength(events.length)
  })
})

test("user lifecycle rejects same-state changes and supports suspended users", async () => {
  await withDatabase(async (database) => {
    const realm = await createRealm(database, "lifecycle-users.example.com")
    const system = realmSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("lifecycle-user", "lifecycle@example.com"),
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const inactive = userLifecycleSet({
      context: system,
      database,
      input: { state: "inactive" },
      realmId: realm.id,
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
        realmId: realm.id,
        userId: created.data.user.id,
      }),
    ).toEqual({
      code: "users.lifecycle-forbidden",
      errorMessage: "The user lifecycle transition is not allowed.",
      op: "userLifecycleSet",
      success: false,
    })
    expect(database.db.select().from(storageEventTable).all()).toHaveLength(eventCount)

    const active = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(active.success).toBe(true)
    const suspended = userLifecycleSet({
      context: system,
      database,
      input: { state: "suspended" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(suspended.success).toBe(true)
    const reactivated = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: realm.id,
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
    const realm = await createRealm(database, "events-users.example.com")
    const system = realmSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("event-user", "secret@example.com"),
      realmId: realm.id,
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
      realmId: realm.id,
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
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(verified.success).toBe(true)
    const finalEvents = database.db
      .select()
      .from(storageEventTable)
      .all()
      .filter((event) => event.aggregateType === "user")
    expect(finalEvents.map((event) => event.aggregateVersion)).toEqual([1, 2, 3])
    expect(finalEvents.map((event) => event.realmId)).toEqual([realm.id, realm.id, realm.id])
  })
})

test("user routes and API client enforce public schemas and authorization", async () => {
  await withDatabase(async (database) => {
    const app = userServerAppCreate({ database, systemSecret: "system-secret" })
    const realm = await createRealm(database, "api-users.example.com")
    const client = userApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: "system-secret",
    })
    const created = await client.userCreate(realm.id, createInput("api-user", "api@example.com"))
    expect(created.success).toBe(true)
    if (!created.success) return
    const missing = await app.request(`http://server.test/system/realms/${realm.id}/users/missing-user`, {
      headers: { authorization: "Bearer system-secret" },
    })
    expect(missing.status).toBe(404)
    const missingBody = (await missing.json()) as { error: { code: string } }
    expect(missingBody.error.code).toBe("users.not-found")
    const listed = await client.userList(realm.id)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.items).toHaveLength(1)
    const profile = await client.userProfileUpdate(realm.id, created.data.user.id, { displayName: "API User" })
    expect(profile.success).toBe(true)

    const verified = await client.userEmailVerificationSet(realm.id, created.data.user.id, { state: "verified" })
    expect(verified.success).toBe(true)
    if (!verified.success) return
    const emailVerifiedAt = verified.data.user.emailVerifiedAt
    if (emailVerifiedAt === undefined) return
    const repository = userRepositoryCreate(database.db)
    const current = repository.userGet(realm.id, created.data.user.id)
    expect(current.success).toBe(true)
    if (!current.success || current.data === null) return
    const migrated = repository.userUpdate(realm.id, created.data.user.id, {
      registrationVerifiedAt: null,
      registrationVerificationMethod: null,
      version: current.data.version + 1,
    })
    expect(migrated.success).toBe(true)
    const repaired = await client.userEmailVerificationSet(realm.id, created.data.user.id, { state: "verified" })
    expect(repaired).toMatchObject({
      data: {
        user: { emailVerifiedAt, registrationVerificationMethod: "email", registrationVerifiedAt: expect.any(Number) },
      },
      success: true,
    })
    const unauthorized = await userApiClientCreate({
      baseUrl: "http://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
    }).userList(realm.id)
    expect(unauthorized.success).toBe(false)
    const malformed = await client.userCreate(realm.id, { email: "bad", profile: {}, userName: "" })
    expect(malformed.success).toBe(false)
  })
})

test("user account summaries are realm scoped and expose only login identifiers and labels", async () => {
  await withDatabase(async (database) => {
    const alpha = await createRealm(database, "label-alpha.example.com")
    const beta = await createRealm(database, "label-beta.example.com")
    const system = realmSystemContextCreate("system")
    const named = userCreate({
      context: system,
      database,
      input: createInput("named-user", "named@example.com"),
      realmId: alpha.id,
    })
    const fallback = userCreate({
      context: system,
      database,
      input: { email: "fallback@example.com", profile: {}, userName: "fallback-user" },
      realmId: alpha.id,
    })
    const namedByParts = userCreate({
      context: system,
      database,
      input: {
        email: "parts@example.com",
        profile: { firstName: "Grace", lastName: "Hopper" },
        userName: "parts-user",
      },
      realmId: alpha.id,
    })
    expect(named.success).toBe(true)
    expect(fallback.success).toBe(true)
    expect(namedByParts.success).toBe(true)
    if (!named.success || !fallback.success || !namedByParts.success) return

    expect(userAccountSummaryResolve({ database, realmId: alpha.id, userId: named.data.user.id })).toEqual({
      data: { label: "Ada Lovelace", loginIdentifier: "named-user" },
      success: true,
    })
    expect(userAccountSummaryResolve({ database, realmId: alpha.id, userId: namedByParts.data.user.id })).toEqual({
      data: { label: "Grace Hopper", loginIdentifier: "parts-user" },
      success: true,
    })
    expect(userAccountSummaryResolve({ database, realmId: alpha.id, userId: fallback.data.user.id })).toEqual({
      data: { label: "fallback-user", loginIdentifier: "fallback-user" },
      success: true,
    })
    expect(userAccountSummaryResolve({ database, realmId: beta.id, userId: named.data.user.id })).toEqual({
      data: undefined,
      success: true,
    })
  })
})

test("subject-bound user routes use the session actor and enforce realm, status, and browser security", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "me-alpha.example.com")
    const beta = await createRealm(database, "me-beta.example.com")
    const system = realmSystemContextCreate("system")
    const alphaCreated = userCreate({
      context: system,
      database,
      input: createInput("me-alpha", "me-alpha@example.com"),
      realmId: alpha.id,
    })
    const betaCreated = userCreate({
      context: system,
      database,
      input: createInput("me-beta", "me-beta@example.com"),
      realmId: beta.id,
    })
    expect(alphaCreated.success).toBe(true)
    expect(betaCreated.success).toBe(true)
    if (!alphaCreated.success || !betaCreated.success) return
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "active" },
        realmId: alpha.id,
        userId: alphaCreated.data.user.id,
      }).success,
    ).toBe(true)
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "active" },
        realmId: beta.id,
        userId: betaCreated.data.user.id,
      }).success,
    ).toBe(true)
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: alphaCreated.data.user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    const app = userServerAppCreate({
      database,
      publicOrigin: "https://me.example.com",
      systemSecret: "system-secret",
    })
    const client = userApiClientCreate({
      baseUrl: "https://server.test",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issued.data.token,
    })
    const current = await client.userMeGet(alpha.id)
    expect(current.success).toBe(true)
    if (!current.success || current.status !== "current") return
    expect(current.data.user.id).toBe(alphaCreated.data.user.id)
    expect(current.data.capabilities).toEqual({ realmRead: false })
    expect(JSON.stringify(current.data)).not.toMatch(/password|secret|token|hash/i)

    const administrationOrganization = organizationCreate({
      context: system,
      database,
      input: { name: "Alpha administration", ownerUserId: alphaCreated.data.user.id },
      realmId: alpha.id,
    })
    expect(administrationOrganization.success).toBe(true)
    const permitted = await client.userMeGet(alpha.id)
    expect(permitted).toMatchObject({
      data: { capabilities: { realmRead: true }, user: { id: alphaCreated.data.user.id } },
      status: "current",
      success: true,
    })

    const updated = await client.userMeProfileUpdate(alpha.id, { displayName: "Alpha Self-Service" })
    expect(updated).toMatchObject({ success: true, data: { user: { id: alphaCreated.data.user.id } } })
    const idorQuery = await app.request(
      `https://server.test/realms/${alpha.id}/me?userId=${encodeURIComponent(betaCreated.data.user.id)}`,
      { headers: { authorization: `Bearer ${issued.data.token}` } },
    )
    expect(idorQuery.status).toBe(200)
    expect((await idorQuery.json()).user.id).toBe(alphaCreated.data.user.id)
    const idorBody = await app.request(`https://server.test/realms/${alpha.id}/me`, {
      body: JSON.stringify({ displayName: "Should Not Apply", userId: betaCreated.data.user.id }),
      headers: { authorization: `Bearer ${issued.data.token}`, "content-type": "application/json" },
      method: "PATCH",
    })
    expect(idorBody.status).toBe(400)
    const crossRealm = await app.request(`https://server.test/realms/${beta.id}/me`, {
      headers: { authorization: `Bearer ${issued.data.token}` },
    })
    expect(crossRealm.status).toBe(401)

    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "inactive" },
        realmId: alpha.id,
        userId: alphaCreated.data.user.id,
      }).success,
    ).toBe(true)
    const inactive = await app.request(`https://server.test/realms/${alpha.id}/me`, {
      headers: { authorization: `Bearer ${issued.data.token}` },
    })
    expect(inactive.status).toBe(401)
    expect(
      userLifecycleSet({
        context: system,
        database,
        input: { state: "active" },
        realmId: alpha.id,
        userId: alphaCreated.data.user.id,
      }).success,
    ).toBe(true)

    const cookie = `session=${issued.data.token}`
    const missingOrigin = await app.request(`https://server.test/realms/${alpha.id}/me`, {
      body: JSON.stringify({ displayName: "No Origin" }),
      headers: { cookie, "content-type": "application/json" },
      method: "PATCH",
    })
    expect(missingOrigin.status).toBe(403)
    const csrfToken = sessionCsrfTokenCreate(testkit.runtime)
    const browserHeaders = {
      cookie: `${cookie}; csrf=${csrfToken}`,
      origin: "https://me.example.com",
      "x-csrf-token": csrfToken,
    }
    const missingCsrf = await app.request(`https://server.test/realms/${alpha.id}/me`, {
      body: JSON.stringify({ displayName: "No CSRF" }),
      headers: { cookie, "content-type": "application/json", origin: "https://me.example.com" },
      method: "PATCH",
    })
    expect(missingCsrf.status).toBe(403)
    const wrongOrigin = await app.request(`https://server.test/realms/${alpha.id}/me`, {
      body: JSON.stringify({ displayName: "Wrong Origin" }),
      headers: { ...browserHeaders, "content-type": "application/json", origin: "https://evil.example.com" },
      method: "PATCH",
    })
    expect(wrongOrigin.status).toBe(403)
    const validUpdate = await app.request(`https://server.test/realms/${alpha.id}/me`, {
      body: JSON.stringify({ displayName: "Browser Self-Service" }),
      headers: { ...browserHeaders, "content-type": "application/json" },
      method: "PATCH",
    })
    expect(validUpdate.status).toBe(200)
    expect((await validUpdate.json()).user.profile.displayName).toBe("Browser Self-Service")

    const deleted = await client.userMeDelete(alpha.id)
    expect(deleted).toMatchObject({
      success: true,
      data: { user: { id: alphaCreated.data.user.id, state: "deleted" } },
    })
    expect(JSON.stringify(deleted)).not.toMatch(/password|secret|token|hash/i)
  })
})

test("the current-user response omits legacy empty profile values", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = await createRealm(database, "legacy-profile.example.com")
    const system = realmSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("legacy-profile", "legacy-profile@example.com"),
      realmId: realm.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    database.sqlite.run(
      `UPDATE user_profiles SET display_name = 'Legacy user', first_name = '', gender = '', last_name = '', nick_name = '', preferred_language = '' WHERE user_id = '${created.data.user.id}'`,
    )
    const activated = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: realm.id,
      userId: created.data.user.id,
    })
    expect(activated.success).toBe(true)
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    const app = userServerAppCreate({ database, publicOrigin: "https://legacy-profile.example.com" })
    const response = await app.request(`https://legacy-profile.example.com/realms/${realm.id}/me`, {
      headers: { authorization: `Bearer ${issued.data.token}` },
    })
    expect(response.status).toBe(200)
    const parsed = v.safeParse(userCurrentResponseSchema, await response.json())
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.output.user.profile).toEqual({ displayName: "Legacy user" })
  })
})

test("subject-bound authentication methods summarize factor state without credential material", async () => {
  await withDatabase(async (database, testkit) => {
    const alpha = await createRealm(database, "authentication-methods-alpha.example.com")
    const beta = await createRealm(database, "authentication-methods-beta.example.com")
    const system = realmSystemContextCreate("system")
    const created = userCreate({
      context: system,
      database,
      input: createInput("authentication-methods", "authentication-methods@example.com"),
      realmId: alpha.id,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const activated = userLifecycleSet({
      context: system,
      database,
      input: { state: "active" },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(activated.success).toBe(true)

    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return

    const app = userServerAppCreate({ database, publicOrigin: "https://authentication-methods.example.com" })
    const client = userApiClientCreate({
      baseUrl: "https://authentication-methods.example.com",
      fetch: async (input, init) => app.request(input.toString(), init),
      token: issued.data.token,
    })
    const empty = await client.userMeAuthenticationMethodsGet(alpha.id)
    expect(empty).toMatchObject({
      data: {
        emailOtp: { available: false },
        passkeys: { credentials: [] },
        password: { available: false },
        recoveryCodes: { available: false, generatedAt: null, remaining: 0 },
        totp: { enrolled: false, enrollments: [] },
      },
      status: "current",
      success: true,
    })

    const started = mfaTotpEnrollmentStart({
      database,
      encryptionSecret: "summary-encryption-secret",
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(started.success).toBe(true)
    if (!started.success) return
    const code = mfaTotpCodeCreate(started.data.secret, Math.floor(testkit.runtime.now() / 30_000))
    expect(code.success).toBe(true)
    if (!code.success) return
    const confirmed = mfaTotpEnrollmentConfirm({
      database,
      encryptionSecret: "summary-encryption-secret",
      input: { code: code.data, enrollmentId: started.data.enrollment.id },
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(confirmed.success).toBe(true)
    const generated = mfaRecoveryCodesGenerate({
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(generated.success).toBe(true)
    if (!generated.success) return
    const consumed = mfaRecoveryCodeVerify({
      code: generated.data.codes[0]!,
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(consumed.success).toBe(true)

    const credentialMaterial = ["credential-material-one", "credential-material-two"]
    const passkeys = passkeyRepositoryCreate(database.db)
    for (const [index, material] of credentialMaterial.entries()) {
      const createdCredential = passkeys.passkeyCredentialCreate({
        aaguid: `aaguid-${index}`,
        backedUp: 0,
        counter: 0,
        createdAt: testkit.runtime.now(),
        credentialId: material,
        deviceType: "singleDevice",
        id: `credential-${index}`,
        lastUsedAt: null,
        publicKey: Buffer.from(`public-key-${material}`),
        realmId: alpha.id,
        revokedAt: null,
        rpId: "authentication-methods.example.com",
        transports: '["internal"]',
        userId: created.data.user.id,
        version: 1,
      })
      expect(createdCredential.success).toBe(true)
    }

    const password = passwordRepositoryCreate(database.db).passwordCredentialCreate({
      changedAt: testkit.runtime.now(),
      createdAt: testkit.runtime.now(),
      hash: "password-hash-material",
      passwordChangeRequired: 0,
      realmId: alpha.id,
      userId: created.data.user.id,
      version: 1,
    })
    expect(password.success).toBe(true)

    const verified = userEmailVerificationSet({
      context: system,
      database,
      input: { state: "verified" },
      realmId: alpha.id,
      userId: created.data.user.id,
    })
    expect(verified.success).toBe(true)

    const enrolled = await client.userMeAuthenticationMethodsGet(alpha.id)
    expect(enrolled.success).toBe(true)
    if (!enrolled.success || enrolled.status !== "current") return
    expect(enrolled.data.totp.enrolled).toBe(true)
    expect(enrolled.data.totp.enrollments).toHaveLength(1)
    expect(enrolled.data.totp.enrollments[0]?.id).toBe(started.data.enrollment.id)
    expect(enrolled.data.recoveryCodes).toMatchObject({ available: true, remaining: 9 })
    expect(enrolled.data.emailOtp.available).toBe(true)
    expect(enrolled.data.passkeys.credentials).toHaveLength(2)
    expect(enrolled.data.password.available).toBe(true)
    const body = JSON.stringify(enrolled.data)
    expect(body).not.toContain(started.data.secret)
    expect(body).not.toContain(generated.data.codes[1]!)
    expect(body).not.toContain("credential-material-one")
    expect(body).not.toContain("public-key-credential-material-one")
    expect(body).not.toContain("encryptedSecret")
    expect(body).not.toContain("codeHash")
    expect(body).not.toContain("publicKey")
    expect(body).not.toContain("password-hash-material")

    const crossRealm = await client.userMeAuthenticationMethodsGet(beta.id)
    expect(crossRealm.success).toBe(false)
    const mismatchedContext = userAuthenticationMethodsGet({
      context: realmTenantContextCreate(alpha.id, created.data.user.id),
      database,
      realmId: beta.id,
      userId: created.data.user.id,
    })
    expect(mismatchedContext).toMatchObject({ code: "users.tenant-mismatch", success: false })

    const permissiveRealmPolicy = organizationLoginPolicySet({
      context: system,
      database,
      input: { minimumStepUpAssurance: "none" },
      realmId: alpha.id,
    })
    expect(permissiveRealmPolicy.success).toBe(true)

    const weak = sessionIssue({
      assurance: "none",
      authenticationMethod: "password",
      database,
      realmId: alpha.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(weak.success).toBe(true)
    if (!weak.success) return
    const weakResponse = await app.request(
      `https://authentication-methods.example.com/realms/${alpha.id}/me/authentication-methods`,
      {
        headers: { authorization: `Bearer ${weak.data.token}` },
      },
    )
    expect(weakResponse.status).toBe(403)
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
