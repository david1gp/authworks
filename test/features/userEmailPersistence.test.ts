import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { userCreate } from "../../src/features/users/actions/userCreate.js"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { userEmailRepositoryCreate } from "../../src/features/users/persistence/userEmailRepositoryCreate.js"
import { userEmailTable } from "../../src/features/users/persistence/userEmailTable.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(operation: (database: StorageDatabase) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-user-email-persistence-"))
  const opened = storageDatabaseOpen(join(directory, "authworks.sqlite"), platformTestkitCreate().runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    return await operation(opened.data)
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

function userCreateForTest(database: StorageDatabase, realmId: string, userName: string, email: string) {
  const created = userCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { email, profile: { displayName: userName }, userName },
    realmId,
  })
  expect(created.success).toBe(true)
  if (!created.success) throw new Error(created.errorMessage)
  return created.data.user
}

test("user creation persists one primary email while retaining the singular projection", async () => {
  await withDatabase(async (database) => {
    const realm = await realmCreateForTest(database, "user-email-primary.example.com")
    const user = userCreateForTest(database, realm.id, "primary-user", " Primary@Example.com ")
    const emails = userEmailRepositoryCreate(database.db).userEmailList(realm.id, user.id)

    expect(emails).toMatchObject({
      data: [
        {
          email: "primary@example.com",
          isPrimary: true,
          realmId: realm.id,
          userId: user.id,
          verifiedAt: null,
        },
      ],
      success: true,
    })
    expect(database.db.select().from(userEmailTable).all()).toHaveLength(1)
    expect(database.sqlite.query("SELECT email, email_verified_at FROM users WHERE id = ?").get(user.id)).toEqual({
      email: "primary@example.com",
      email_verified_at: null,
    })
  })
})

test("email repository enforces normalized realm uniqueness and primary invariants", async () => {
  await withDatabase(async (database) => {
    const realm = await realmCreateForTest(database, "user-email-invariants.example.com")
    const otherRealm = await realmCreateForTest(database, "user-email-other-realm.example.com")
    const user = userCreateForTest(database, realm.id, "email-user", "primary@example.com")
    const otherUser = userCreateForTest(database, realm.id, "other-user", "other@example.com")
    const otherRealmUser = userCreateForTest(database, otherRealm.id, "other-realm-user", "other-realm@example.com")
    const repository = userEmailRepositoryCreate(database.db)

    const created = repository.userEmailCreate({
      createdAt: 2,
      email: " Secondary@Example.com ",
      id: "secondary-email",
      isPrimary: false,
      realmId: realm.id,
      updatedAt: 2,
      userId: user.id,
      verifiedAt: null,
      version: 1,
    })
    expect(created).toMatchObject({ data: { email: "secondary@example.com", isPrimary: false }, success: true })
    if (!created.success) return

    expect(
      repository.userEmailCreate({
        createdAt: 2,
        email: "SECONDARY@example.com",
        id: "duplicate-secondary",
        isPrimary: false,
        realmId: realm.id,
        updatedAt: 2,
        userId: otherUser.id,
        verifiedAt: null,
        version: 1,
      }),
    ).toMatchObject({ code: "users.conflict", success: false })
    expect(
      repository.userEmailCreate({
        createdAt: 2,
        email: " SECONDARY@example.com ",
        id: "other-realm-secondary",
        isPrimary: false,
        realmId: otherRealm.id,
        updatedAt: 2,
        userId: otherRealmUser.id,
        verifiedAt: null,
        version: 1,
      }).success,
    ).toBe(true)

    expect(
      repository.userEmailPrimarySet({
        emailId: created.data.id,
        expectedVersion: created.data.version,
        realmId: realm.id,
        updatedAt: 3,
        userId: user.id,
        version: created.data.version + 1,
      }),
    ).toMatchObject({ code: "users.invalid-transition", success: false })

    const verified = repository.userEmailVerificationSet({
      emailId: created.data.id,
      expectedVersion: created.data.version,
      realmId: realm.id,
      updatedAt: 3,
      userId: user.id,
      verifiedAt: 3,
      version: created.data.version + 1,
    })
    expect(verified.success).toBe(true)
    if (!verified.success || verified.data === null) return

    const promoted = repository.userEmailPrimarySet({
      emailId: verified.data.id,
      expectedVersion: verified.data.version,
      realmId: realm.id,
      updatedAt: 4,
      userId: user.id,
      version: verified.data.version + 1,
    })
    expect(promoted).toMatchObject({ data: { email: "secondary@example.com", isPrimary: true }, success: true })
    expect(database.sqlite.query("SELECT email, email_verified_at FROM users WHERE id = ?").get(user.id)).toEqual({
      email: "secondary@example.com",
      email_verified_at: 3,
    })

    const emails = repository.userEmailList(realm.id, user.id)
    expect(emails.success).toBe(true)
    if (!emails.success) return
    expect(emails.data.filter((email) => email.isPrimary)).toHaveLength(1)
    expect(
      repository.userEmailDelete(realm.id, user.id, emails.data.find((email) => !email.isPrimary)?.id ?? ""),
    ).toMatchObject({
      data: { email: "primary@example.com" },
      success: true,
    })
    expect(repository.userEmailDelete(realm.id, user.id, verified.data.id)).toMatchObject({
      code: "users.conflict",
      success: false,
    })
  })
})
