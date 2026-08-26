import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { userEmailTable } from "../../src/features/users/persistence/userEmailTable.js"
import { userRepositoryCreate } from "../../src/features/users/persistence/userRepositoryCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../src/platform/errors/resultErrorCreate.js"
import { storageCurrentStateSet } from "../../src/platform/storage/storageCurrentStateSet.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseReset } from "../../src/platform/storage/storageDatabaseReset.js"
import { storageEventAppend } from "../../src/platform/storage/storageEventAppend.js"
import { storageEventTable } from "../../src/platform/storage/storageEventTable.js"
import { storageTransactionRun } from "../../src/platform/storage/storageTransactionRun.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withStorage<T>(operation: (path: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-storage-"))
  const path = join(directory, "authworks.sqlite")
  try {
    return await operation(path)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

function eventInput() {
  return {
    aggregateId: "user-1",
    aggregateType: "user",
    aggregateVersion: 1,
    commandIndex: 0,
    correlationId: "correlation-1",
    eventType: "user.created",
    realmId: "realm-1",
    metadata: { source: "test" },
    payload: { displayName: "Ada" },
  }
}

test("storage opens a file-backed WAL database and verifies durability pragmas", async () => {
  await withStorage(async (path) => {
    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    expect(opened.data.sqlite.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" })
    expect(opened.data.sqlite.query("PRAGMA synchronous").get()).toEqual({ synchronous: 2 })
    expect(opened.data.sqlite.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 })
    expect(opened.data.sqlite.query("PRAGMA temp_store").get()).toEqual({ temp_store: 2 })
    expect(opened.data.sqlite.query("PRAGMA busy_timeout").get()).toEqual({ timeout: 5000 })
    opened.data.close()
  })
})

test("storage upgrades legacy user columns before user reads and is idempotent", async () => {
  await withStorage(async (path) => {
    const legacy = new Database(path)
    legacy.run("CREATE TABLE realms (id TEXT PRIMARY KEY NOT NULL)")
    legacy.run(
      "CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_name TEXT NOT NULL, email TEXT NOT NULL, state TEXT NOT NULL, email_verified_at INTEGER, deleted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, version INTEGER NOT NULL, UNIQUE (realm_id, user_name), UNIQUE (realm_id, email), FOREIGN KEY (realm_id) REFERENCES realms(id))",
    )
    legacy.run(
      "CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, first_name TEXT, last_name TEXT, nick_name TEXT, display_name TEXT, preferred_language TEXT, gender TEXT, updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))",
    )
    legacy.run("INSERT INTO realms (id) VALUES ('realm-1')")
    legacy.run(
      "INSERT INTO users (id, realm_id, user_name, email, state, created_at, updated_at, version) VALUES ('user-1', 'realm-1', 'legacy-user', 'legacy@example.com', 'active', 1, 1, 1)",
    )
    legacy.run(
      "INSERT INTO user_profiles (user_id, realm_id, display_name, updated_at) VALUES ('user-1', 'realm-1', 'Legacy user', 1)",
    )
    legacy.close()

    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const columns = opened.data.sqlite.query("PRAGMA table_info(users)").all() as Array<{ name: string }>
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "phone_number",
        "phone_number_verified_at",
        "registration_verified_at",
        "registration_verification_method",
      ]),
    )

    const user = userRepositoryCreate(opened.data.db).userGet("realm-1", "user-1")
    expect(user).toMatchObject({
      data: {
        email: "legacy@example.com",
        id: "user-1",
        phoneNumber: null,
        profile: { displayName: "Legacy user" },
      },
      success: true,
    })
    expect(opened.data.db.select().from(userEmailTable).all()).toMatchObject([
      {
        email: "legacy@example.com",
        isPrimary: true,
        realmId: "realm-1",
        userId: "user-1",
        verifiedAt: null,
      },
    ])
    opened.data.close()

    const reopened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(reopened.success).toBe(true)
    if (!reopened.success) return
    expect(userRepositoryCreate(reopened.data.db).userGet("realm-1", "user-1").success).toBe(true)
    expect(reopened.data.db.select().from(userEmailTable).all()).toHaveLength(1)
    reopened.data.close()
  })
})

test("storage upgrades legacy MFA challenges with organization context", async () => {
  await withStorage(async (path) => {
    const legacy = new Database(path)
    legacy.run(
      "CREATE TABLE mfa_challenges (id TEXT PRIMARY KEY NOT NULL, realm_id TEXT NOT NULL, user_id TEXT NOT NULL, session_id TEXT, purpose TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, primary_authentication_method TEXT NOT NULL, device_fingerprint TEXT, device_description TEXT, ip_address TEXT, user_agent TEXT, required_assurance TEXT NOT NULL, attempts INTEGER NOT NULL, max_attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER, created_at INTEGER NOT NULL, version INTEGER NOT NULL)",
    )
    legacy.close()

    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const columns = opened.data.sqlite.query("PRAGMA table_info(mfa_challenges)").all() as Array<{ name: string }>
    expect(columns.map((column) => column.name)).toContain("organization_id")
    opened.data.close()
  })
})

test("event append rejects invalid envelope values and rolls back preceding state", async () => {
  await withStorage(async (path) => {
    const testkit = platformTestkitCreate()
    const opened = storageDatabaseOpen(path, testkit.runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const invalidInputs = [
      { realmId: "" },
      { aggregateType: "" },
      { aggregateId: "" },
      { eventType: "" },
      { correlationId: "" },
      { commandIndex: -1 },
      { commandIndex: 0.5 },
      { aggregateVersion: 0 },
      { aggregateVersion: 1.5 },
      { occurredAt: -1 },
      { occurredAt: 1.5 },
      { occurredAt: Number.MAX_SAFE_INTEGER + 1 },
    ]
    for (const invalidInput of invalidInputs) {
      expect(storageEventAppend(opened.data.db, { ...eventInput(), ...invalidInput }, testkit.runtime).success).toBe(
        false,
      )
    }
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 })

    const rolledBack = storageTransactionRun(opened.data, (transaction) => {
      const state = storageCurrentStateSet(transaction, {
        key: "invalid-event-rollback",
        updatedAt: 1_700_000_000_000,
        value: { shouldExist: false },
        version: 1,
      })
      if (!state.success) return state
      const event = storageEventAppend(transaction, { ...eventInput(), occurredAt: -1 }, testkit.runtime)
      if (!event.success) return event
      return resultCreate(undefined)
    })

    expect(rolledBack.success).toBe(false)
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM current_state").get()).toEqual({ count: 0 })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 })
    opened.data.close()
  })
})

test("event append enforces lowercase UUIDv7 IDs and JSON-safe data", async () => {
  await withStorage(async (path) => {
    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const validId = "018f0e3f-8b00-7000-8000-000000000001"
    for (const id of [validId.toUpperCase(), "018f0e3f-8b00-4000-8000-000000000001", "not-an-id"]) {
      expect(storageEventAppend(opened.data.db, { ...eventInput(), id }, opened.data.runtime).success).toBe(false)
    }
    expect(
      storageEventAppend(
        opened.data.db,
        { ...eventInput(), eventId: `${validId.slice(0, -1)}2`, id: validId },
        opened.data.runtime,
      ).success,
    ).toBe(false)

    const accepted = storageEventAppend(
      opened.data.db,
      { ...eventInput(), eventId: validId, id: validId },
      opened.data.runtime,
    )
    expect(accepted.success).toBe(true)
    if (!accepted.success) return
    expect(accepted.data.id).toBe(validId)

    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(storageEventAppend(opened.data.db, { ...eventInput(), payload: cyclic }, opened.data.runtime).success).toBe(
      false,
    )
    expect(
      storageEventAppend(opened.data.db, { ...eventInput(), metadata: undefined }, opened.data.runtime).success,
    ).toBe(false)
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 1 })
    opened.data.close()
  })
})

test("state and event append commit together and survive reopening the real file", async () => {
  await withStorage(async (path) => {
    const testkit = platformTestkitCreate({ now: 1_700_000_000_000 })
    const opened = storageDatabaseOpen(path, testkit.runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const committed = storageTransactionRun(opened.data, (transaction) => {
      const state = storageCurrentStateSet(transaction, {
        key: "user-1",
        updatedAt: testkit.runtime.now(),
        value: { displayName: "Ada" },
        version: 1,
      })
      if (!state.success) return state
      const event = storageEventAppend(transaction, eventInput(), testkit.runtime)
      if (!event.success) return event
      return resultCreate({ event: event.data, state: state.data })
    })
    expect(committed.success).toBe(true)
    opened.data.close()

    const reopened = storageDatabaseOpen(path, testkit.runtime)
    expect(reopened.success).toBe(true)
    if (!reopened.success) return
    expect(reopened.data.db.select().from(storageEventTable).all()).toHaveLength(1)
    expect(reopened.data.sqlite.query("SELECT key, version FROM current_state").all()).toEqual([
      { key: "user-1", version: 1 },
    ])
    reopened.data.close()
  })
})

test("a returned failure rolls back current state and its event", async () => {
  await withStorage(async (path) => {
    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const rolledBack = storageTransactionRun(opened.data, (transaction) => {
      const state = storageCurrentStateSet(transaction, {
        key: "user-rollback",
        updatedAt: 1_700_000_000_000,
        value: { shouldExist: false },
        version: 1,
      })
      if (!state.success) return state
      const event = storageEventAppend(transaction, eventInput(), opened.data.runtime)
      if (!event.success) return event
      return resultErrorCreate("test", "simulate command failure")
    })

    expect(rolledBack).toEqual({ errorMessage: "simulate command failure", op: "test", success: false })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM current_state").get()).toEqual({ count: 0 })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 })
    opened.data.close()
  })
})

test("a thrown failure rolls back the file transaction and leaves the connection usable", async () => {
  await withStorage(async (path) => {
    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const crashed = storageTransactionRun(opened.data, (transaction) => {
      const state = storageCurrentStateSet(transaction, {
        key: "user-crash",
        updatedAt: 1_700_000_000_000,
        value: { shouldExist: false },
        version: 1,
      })
      if (!state.success) return state
      const event = storageEventAppend(transaction, eventInput(), opened.data.runtime)
      if (!event.success) return event
      throw new Error("simulated crash")
    })

    expect(crashed).toEqual({
      errorMessage: "The SQLite transaction failed.",
      op: "storageTransactionRun",
      success: false,
    })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM current_state").get()).toEqual({ count: 0 })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 })
    opened.data.close()
  })
})

test("event rows are append-only and reset reconstructs an empty current schema", async () => {
  await withStorage(async (path) => {
    const opened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(opened.success).toBe(true)
    if (!opened.success) return

    const appended = storageEventAppend(opened.data.db, eventInput(), opened.data.runtime)
    expect(appended.success).toBe(true)
    if (!appended.success) return

    expect(() => opened.data.db.update(storageEventTable).set({ eventType: "tampered" }).run()).toThrow(
      "events are append-only",
    )
    expect(() => opened.data.db.delete(storageEventTable).run()).toThrow("events are append-only")

    const reset = storageDatabaseReset(opened.data)
    expect(reset).toEqual({ data: undefined, success: true })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM current_state").get()).toEqual({ count: 0 })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM user_emails").get()).toEqual({ count: 0 })
    expect(opened.data.sqlite.query("SELECT COUNT(*) AS count FROM user_profile_picture_cleanup").get()).toEqual({
      count: 0,
    })
    expect(opened.data.sqlite.query("PRAGMA foreign_key_list(user_profile_picture_cleanup)").all()).toEqual([])
    opened.data.close()

    const reopened = storageDatabaseOpen(path, platformTestkitCreate().runtime)
    expect(reopened.success).toBe(true)
    if (!reopened.success) return
    expect(reopened.data.sqlite.query("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 })
    expect(reopened.data.sqlite.query("SELECT COUNT(*) AS count FROM current_state").get()).toEqual({ count: 0 })
    expect(reopened.data.sqlite.query("SELECT COUNT(*) AS count FROM user_profile_picture_cleanup").get()).toEqual({
      count: 0,
    })
    expect(
      reopened.data.sqlite
        .query(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name IN ('users_user_name_verified_email_collision_insert', 'users_user_name_verified_email_collision_update', 'user_emails_verified_user_name_collision_insert', 'user_emails_verified_user_name_collision_update')",
        )
        .get(),
    ).toEqual({ count: 4 })
    expect(storageEventAppend(reopened.data.db, eventInput(), reopened.data.runtime).success).toBe(true)
    reopened.data.close()
  })
})
