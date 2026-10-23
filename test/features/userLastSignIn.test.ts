import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as v from "valibot"
import { impersonationStart } from "../../src/features/impersonation/actions/impersonationStart.js"
import { organizationCreate } from "../../src/features/organizations/actions/organizationCreate.js"
import { organizationMembershipCreate } from "../../src/features/organizations/actions/organizationMembershipCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { userGet } from "../../src/features/users/actions/userGet.js"
import { userLifecycleSet } from "../../src/features/users/actions/userLifecycleSet.js"
import { userList } from "../../src/features/users/actions/userList.js"
import { userListResponseSchema } from "../../src/features/users/public/userListResponseSchema.js"
import { userResponseSchema } from "../../src/features/users/public/userResponseSchema.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-last-sign-in-"))
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

function createUser(
  database: StorageDatabase,
  realmId: string,
  userName: string,
  email: string,
  profile?: { displayName?: string; firstName?: string; lastName?: string },
) {
  return userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: {
      email,
      profile: {
        displayName: profile?.displayName ?? userName,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
      },
      userName,
    },
    realmId,
  })
}

test("password sign-in records last sign-in while bootstrap-admin sessions leave users untouched", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "last-sign-in.example.com", name: "LastSignIn" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const created = createUser(database, realm.data.realm.id, "signer", "signer@example.com")
    expect(created.success).toBe(true)
    if (!created.success) return
    expect(created.data.user.lastSignInAt).toBeUndefined()

    testkit.advance(1_000)
    const issued = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(issued.success).toBe(true)
    if (!issued.success) return
    const signedIn = userGet({
      context: realmSystemContextCreate("system"),
      database,
      realmId: realm.data.realm.id,
      userId: created.data.user.id,
    })
    expect(signedIn.success).toBe(true)
    if (!signedIn.success) return
    expect(signedIn.data.user.lastSignInAt).toBe(issued.data.session.createdAt)
    expect(v.safeParse(userResponseSchema, signedIn.data).success).toBe(true)

    testkit.advance(1_000)
    const bootstrapSession = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "bootstrap_admin",
      database,
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      subjectId: "bootstrap-admin",
      subjectType: "bootstrap_admin",
    })
    expect(bootstrapSession.success).toBe(true)
    const afterBootstrap = userGet({
      context: realmSystemContextCreate("system"),
      database,
      realmId: realm.data.realm.id,
      userId: created.data.user.id,
    })
    expect(afterBootstrap.success).toBe(true)
    if (!afterBootstrap.success) return
    expect(afterBootstrap.data.user.lastSignInAt).toBe(issued.data.session.createdAt)
  })
})

test("impersonation sessions do not record a sign-in for the target user", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "last-sign-in-impersonation.example.com", name: "LastSignInImpersonation" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const admin = createUser(database, realm.data.realm.id, "impersonation-admin", "impersonation-admin@example.com")
    const target = createUser(database, realm.data.realm.id, "impersonation-target", "impersonation-target@example.com")
    expect(admin.success && target.success).toBe(true)
    if (!admin.success || !target.success) return
    const activatedAdmin = userLifecycleSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "active" },
      realmId: realm.data.realm.id,
      userId: admin.data.user.id,
    })
    const activatedTarget = userLifecycleSet({
      context: realmSystemContextCreate("system"),
      database,
      input: { state: "active" },
      realmId: realm.data.realm.id,
      userId: target.data.user.id,
    })
    expect(activatedAdmin.success && activatedTarget.success).toBe(true)
    const organization = organizationCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { name: "impersonation-org" },
      realmId: realm.data.realm.id,
    })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const adminMembership = organizationMembershipCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { roles: ["admin"], userId: admin.data.user.id },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    const targetMembership = organizationMembershipCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { roles: ["member"], userId: target.data.user.id },
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
    })
    expect(adminMembership.success && targetMembership.success).toBe(true)

    testkit.advance(1_000)
    const started = impersonationStart({
      actor: {
        actorId: admin.data.user.id,
        assurance: "multi_factor",
        authenticationMethod: "trusted",
        kind: "user",
        realmId: realm.data.realm.id,
      },
      database,
      durationMs: 60_000,
      organizationId: organization.data.organization.id,
      realmId: realm.data.realm.id,
      reason: "Support case 123",
      runtime: testkit.runtime,
      targetUserId: target.data.user.id,
    })
    expect(started.success).toBe(true)
    const targetAfter = userGet({
      context: realmSystemContextCreate("system"),
      database,
      realmId: realm.data.realm.id,
      userId: target.data.user.id,
    })
    expect(targetAfter.success).toBe(true)
    if (!targetAfter.success) return
    expect(targetAfter.data.user.lastSignInAt).toBeUndefined()
  })
})

test("the storage backfill sets last sign-in from non-impersonation sessions only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-last-sign-in-backfill-"))
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    const database = opened.data
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "last-sign-in-backfill.example.com", name: "LastSignInBackfill" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const created = createUser(database, realm.data.realm.id, "backfilled", "backfilled@example.com")
    expect(created.success).toBe(true)
    if (!created.success) return
    const legacy = createUser(database, realm.data.realm.id, "legacy", "legacy@example.com")
    expect(legacy.success).toBe(true)
    if (!legacy.success) return

    const first = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "password",
      database,
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(first.success).toBe(true)
    if (!first.success) return
    testkit.advance(5_000)
    const second = sessionIssue({
      assurance: "authenticated",
      authenticationMethod: "totp",
      database,
      realmId: realm.data.realm.id,
      runtime: testkit.runtime,
      userId: created.data.user.id,
    })
    expect(second.success).toBe(true)
    if (!second.success) return

    // Simulate rows written before last_sign_in_at existed: blank both rows. Reopening the
    // database replays storageSchemaCreate, whose idempotent UPDATE backfills them.
    database.sqlite.query("UPDATE users SET last_sign_in_at = NULL").run()
    const sqlitePath = join(directory, "authworks.sqlite")
    database.close()
    const reopened = storageDatabaseOpen(sqlitePath, platformTestkitCreate().runtime)
    expect(reopened.success).toBe(true)
    if (!reopened.success) return
    try {
      const backfilled = userGet({
        context: realmSystemContextCreate("system"),
        database: reopened.data,
        realmId: realm.data.realm.id,
        userId: created.data.user.id,
      })
      expect(backfilled.success).toBe(true)
      if (!backfilled.success) return
      expect(backfilled.data.user.lastSignInAt).toBe(second.data.session.createdAt)
      const untouched = userGet({
        context: realmSystemContextCreate("system"),
        database: reopened.data,
        realmId: realm.data.realm.id,
        userId: legacy.data.user.id,
      })
      expect(untouched.success).toBe(true)
      if (!untouched.success) return
      expect(untouched.data.user.lastSignInAt).toBeUndefined()
    } finally {
      reopened.data.close()
    }
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test("user list search matches names and emails case-insensitively", async () => {
  await withDatabase(async (database) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "last-sign-in-search.example.com", name: "LastSignInSearch" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const system = realmSystemContextCreate("system")
    expect(
      createUser(database, realm.data.realm.id, "ada-search", "ada.search@example.com", {
        displayName: "Ada Lovelace",
        firstName: "Ada",
        lastName: "Lovelace",
      }).success,
    ).toBe(true)
    expect(createUser(database, realm.data.realm.id, "grace-search", "grace@example.com").success).toBe(true)

    const byDisplayName = userList({
      context: system,
      database,
      query: { search: "  LOVELACE " },
      realmId: realm.data.realm.id,
    })
    expect(byDisplayName.success).toBe(true)
    if (!byDisplayName.success) return
    expect(byDisplayName.data.items.map((user) => user.userName)).toEqual(["ada-search"])

    const byEmail = userList({ context: system, database, query: { search: "GRACE@" }, realmId: realm.data.realm.id })
    expect(byEmail.success).toBe(true)
    if (!byEmail.success) return
    expect(byEmail.data.items.map((user) => user.userName)).toEqual(["grace-search"])

    const missing = userList({
      context: system,
      database,
      query: { search: "no-such-user" },
      realmId: realm.data.realm.id,
    })
    expect(missing).toEqual({ data: { items: [] }, success: true })
  })
})

test("user list sorts last sign-in descending with nulls last and paginates across pages", async () => {
  await withDatabase(async (database, testkit) => {
    const realm = realmCreate({
      context: realmSystemContextCreate("system"),
      database,
      input: { domain: "last-sign-in-sort.example.com", name: "LastSignInSort" },
    })
    expect(realm.success).toBe(true)
    if (!realm.success) return
    const system = realmSystemContextCreate("system")
    const first = createUser(database, realm.data.realm.id, "sort-first", "sort-first@example.com")
    const second = createUser(database, realm.data.realm.id, "sort-second", "sort-second@example.com")
    const never = createUser(database, realm.data.realm.id, "sort-never", "sort-never@example.com")
    expect(first.success && second.success && never.success).toBe(true)
    if (!first.success || !second.success || !never.success) return

    testkit.advance(1_000)
    expect(
      sessionIssue({
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        realmId: realm.data.realm.id,
        runtime: testkit.runtime,
        userId: first.data.user.id,
      }).success,
    ).toBe(true)
    testkit.advance(1_000)
    expect(
      sessionIssue({
        assurance: "authenticated",
        authenticationMethod: "password",
        database,
        realmId: realm.data.realm.id,
        runtime: testkit.runtime,
        userId: second.data.user.id,
      }).success,
    ).toBe(true)

    const sorted = userList({
      context: system,
      database,
      query: { sortBy: "lastSignInAt", sortDirection: "desc" },
      realmId: realm.data.realm.id,
    })
    expect(sorted.success).toBe(true)
    if (!sorted.success) return
    expect(sorted.data.items.map((user) => user.userName)).toEqual(["sort-second", "sort-first", "sort-never"])
    expect(v.safeParse(userListResponseSchema, sorted.data).success).toBe(true)

    const firstPage = userList({
      context: system,
      database,
      query: { pageSize: 2, sortBy: "lastSignInAt", sortDirection: "desc" },
      realmId: realm.data.realm.id,
    })
    expect(firstPage.success).toBe(true)
    if (!firstPage.success) return
    if (firstPage.data.nextPageToken === undefined) return expect(firstPage.data.nextPageToken).toBeDefined()
    expect(firstPage.data.items.map((user) => user.userName)).toEqual(["sort-second", "sort-first"])
    const secondPage = userList({
      context: system,
      database,
      query: {
        pageSize: 2,
        pageToken: firstPage.data.nextPageToken,
        sortBy: "lastSignInAt",
        sortDirection: "desc",
      },
      realmId: realm.data.realm.id,
    })
    expect(secondPage.success).toBe(true)
    if (!secondPage.success) return
    expect(secondPage.data.items.map((user) => user.userName)).toEqual(["sort-never"])
    expect(secondPage.data.nextPageToken).toBeUndefined()

    const ascending = userList({
      context: system,
      database,
      query: { sortBy: "lastSignInAt", sortDirection: "asc" },
      realmId: realm.data.realm.id,
    })
    expect(ascending.success).toBe(true)
    if (!ascending.success) return
    expect(ascending.data.items.map((user) => user.userName)).toEqual(["sort-first", "sort-second", "sort-never"])
  })
})
