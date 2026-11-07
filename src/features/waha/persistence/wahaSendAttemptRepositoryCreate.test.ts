import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { wahaSendAttemptRepositoryCreate } from "./wahaSendAttemptRepositoryCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-send-attempt-"))
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

function tableNamesGet(database: StorageDatabase): string[] {
  const rows = database.sqlite
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'waha_send%'")
    .all() as Array<{ name: string }>
  return rows.map((row) => row.name)
}

function indexNamesGet(database: StorageDatabase): string[] {
  const rows = database.sqlite
    .query("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'waha_send_attempts'")
    .all() as Array<{ name: string }>
  return rows.map((row) => row.name)
}

test("a fresh database creates the send-attempt table and records one attempt with a phone hash", async () => {
  await withDatabase(async (database, testkit) => {
    expect(tableNamesGet(database)).toEqual(["waha_send_attempts"])
    expect(indexNamesGet(database).sort()).toEqual(
      [
        "sqlite_autoindex_waha_send_attempts_1",
        "waha_send_attempts_created_idx",
        "waha_send_attempts_purpose_idx",
        "waha_send_attempts_sender_idx",
        "waha_send_attempts_status_idx",
      ].sort(),
    )
    const repository = wahaSendAttemptRepositoryCreate(database.db)
    const recorded = repository.wahaSendAttemptRecord({
      createdAt: testkit.runtime.now(),
      endpointId: "primary",
      id: "attempt-1",
      purpose: "sign_in",
      realmId: "realm-1",
      recipientPhoneHash: "hash-abc",
      sessionName: "default",
      status: "sent",
    })
    expect(recorded.success).toBe(true)
    if (!recorded.success) return
    expect(recorded.data).toMatchObject({
      endpointId: "primary",
      id: "attempt-1",
      purpose: "sign_in",
      recipientPhoneHash: "hash-abc",
      sessionName: "default",
      status: "sent",
    })
  })
})

test("sent counts exclude rows before the window and blocked rows with a null session", async () => {
  await withDatabase(async (database, testkit) => {
    const repository = wahaSendAttemptRepositoryCreate(database.db)
    const now = testkit.runtime.now()
    const hour = 3_600_000
    for (const input of [
      { createdAt: now - 30 * 60_000, id: "attempt-in-window", status: "sent" as const },
      { createdAt: now - 2 * hour, id: "attempt-too-old", status: "sent" as const },
      { createdAt: now - 10 * 60_000, id: "attempt-failed", status: "failed" as const },
    ]) {
      const recorded = repository.wahaSendAttemptRecord({
        createdAt: input.createdAt,
        endpointId: "primary",
        id: input.id,
        purpose: "sign_in",
        realmId: "realm-1",
        recipientPhoneHash: "hash-abc",
        sessionName: "default",
        status: input.status,
      })
      expect(recorded.success).toBe(true)
    }
    const blocked = repository.wahaSendAttemptRecord({
      createdAt: now - 5 * 60_000,
      endpointId: "primary",
      id: "attempt-blocked",
      purpose: "sign_in",
      realmId: "realm-1",
      recipientPhoneHash: "hash-abc",
      sessionName: null,
      status: "blocked",
    })
    expect(blocked.success).toBe(true)
    if (!blocked.success) return
    expect(blocked.data.sessionName).toBeNull()

    const counted = repository.wahaSendAttemptSentCount("primary", "default", now - hour)
    expect(counted).toMatchObject({ success: true, data: 1 })

    const nullSession = repository.wahaSendAttemptSentCount("primary", null, now - hour)
    expect(nullSession).toMatchObject({ success: true, data: 0 })
  })
})

test("recent attempts list newest first with a bounded limit", async () => {
  await withDatabase(async (database, testkit) => {
    const repository = wahaSendAttemptRepositoryCreate(database.db)
    const now = testkit.runtime.now()
    for (const [index, id] of ["attempt-oldest", "attempt-middle", "attempt-newest"].entries()) {
      const recorded = repository.wahaSendAttemptRecord({
        createdAt: now + index * 1_000,
        endpointId: "primary",
        id,
        purpose: "sign_in",
        realmId: null,
        recipientPhoneHash: "hash-abc",
        sessionName: "default",
        status: "sent",
      })
      expect(recorded.success).toBe(true)
    }
    const listed = repository.wahaSendAttemptListRecent(2, 0)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.map((row) => row.id)).toEqual(["attempt-newest", "attempt-middle"])
  })
})

test("recent attempts exclude rows created before the since filter", async () => {
  await withDatabase(async (database, testkit) => {
    const repository = wahaSendAttemptRepositoryCreate(database.db)
    const now = testkit.runtime.now()
    for (const [id, createdAt] of [
      ["attempt-old", now - 2 * 3_600_000],
      ["attempt-new", now - 60_000],
    ] as const) {
      const recorded = repository.wahaSendAttemptRecord({
        createdAt,
        endpointId: "primary",
        id,
        purpose: "sign_in",
        realmId: null,
        recipientPhoneHash: "hash-abc",
        sessionName: "default",
        status: "sent",
      })
      expect(recorded.success).toBe(true)
    }
    const listed = repository.wahaSendAttemptListRecent(10, now - 3_600_000)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data.map((row) => row.id)).toEqual(["attempt-new"])
  })
})

test("a send attempt records the plaintext phone and code alongside the hash", async () => {
  await withDatabase(async (database, testkit) => {
    const repository = wahaSendAttemptRepositoryCreate(database.db)
    const recorded = repository.wahaSendAttemptRecord({
      code: "123456",
      createdAt: testkit.runtime.now(),
      endpointId: "primary",
      id: "attempt-phone-code",
      purpose: "sign_in",
      realmId: "realm-1",
      recipientPhone: "+14155552671",
      recipientPhoneHash: "hash-abc",
      sessionName: "default",
      status: "sent",
    })
    expect(recorded.success).toBe(true)
    if (!recorded.success) return
    expect(recorded.data).toMatchObject({
      code: "123456",
      recipientPhone: "+14155552671",
      recipientPhoneHash: "hash-abc",
    })
    const listed = repository.wahaSendAttemptListRecent(10, 0)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data).toHaveLength(1)
    expect(listed.data[0]).toMatchObject({
      code: "123456",
      recipientPhone: "+14155552671",
      recipientPhoneHash: "hash-abc",
    })
  })
})

test("an existing database without the phone and code columns migrates and keeps old rows", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-waha-send-attempt-migration-"))
  const databasePath = join(directory, "authworks.sqlite")
  const legacy = new Database(databasePath)
  try {
    legacy.exec(
      "CREATE TABLE waha_send_attempts (id TEXT PRIMARY KEY NOT NULL, endpoint_id TEXT NOT NULL, session_name TEXT, purpose TEXT NOT NULL, realm_id TEXT, recipient_phone_hash TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'blocked')), created_at INTEGER NOT NULL CHECK (created_at >= 0))",
    )
    legacy.exec(
      "INSERT INTO waha_send_attempts (id, endpoint_id, session_name, purpose, realm_id, recipient_phone_hash, status, created_at) VALUES ('attempt-legacy', 'primary', 'default', 'sign_in', 'realm-1', 'hash-abc', 'sent', 1_700_000_000_000)",
    )
  } finally {
    legacy.close()
  }
  const testkit = platformTestkitCreate()
  const opened = storageDatabaseOpen(databasePath, testkit.runtime)
  expect(opened.success).toBe(true)
  if (!opened.success) {
    await rm(directory, { force: true, recursive: true })
    throw new Error(opened.errorMessage)
  }
  try {
    const columns = opened.data.sqlite
      .query("SELECT name FROM pragma_table_info('waha_send_attempts')")
      .all() as Array<{ name: string }>
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining(["recipient_phone", "code"]))
    const repository = wahaSendAttemptRepositoryCreate(opened.data.db)
    const listed = repository.wahaSendAttemptListRecent(10, 0)
    expect(listed.success).toBe(true)
    if (!listed.success) return
    expect(listed.data).toHaveLength(1)
    expect(listed.data[0]).toMatchObject({
      code: null,
      endpointId: "primary",
      id: "attempt-legacy",
      recipientPhone: null,
      recipientPhoneHash: "hash-abc",
      status: "sent",
    })
    const recorded = repository.wahaSendAttemptRecord({
      code: "123456",
      createdAt: testkit.runtime.now(),
      endpointId: "primary",
      id: "attempt-after-migration",
      purpose: "sign_in",
      realmId: null,
      recipientPhone: "+14155552671",
      recipientPhoneHash: "hash-def",
      sessionName: "default",
      status: "sent",
    })
    expect(recorded.success).toBe(true)
  } finally {
    opened.data.close()
    await rm(directory, { force: true, recursive: true })
  }
})

test("attempts count grouped by status and by purpose inside the window", async () => {
  await withDatabase(async (database, testkit) => {
    const repository = wahaSendAttemptRepositoryCreate(database.db)
    const now = testkit.runtime.now()
    const rows = [
      { createdAt: now - 30 * 60_000, id: "attempt-sent-a", purpose: "sign_in", status: "sent" as const },
      { createdAt: now - 20 * 60_000, id: "attempt-sent-b", purpose: "registration", status: "sent" as const },
      { createdAt: now - 10 * 60_000, id: "attempt-failed", purpose: "sign_in", status: "failed" as const },
      { createdAt: now - 2 * 3_600_000, id: "attempt-old-blocked", purpose: "sign_in", status: "blocked" as const },
    ]
    for (const row of rows) {
      const recorded = repository.wahaSendAttemptRecord({
        createdAt: row.createdAt,
        endpointId: "primary",
        id: row.id,
        purpose: row.purpose,
        realmId: null,
        recipientPhoneHash: "hash-abc",
        sessionName: row.status === "blocked" ? null : "default",
        status: row.status,
      })
      expect(recorded.success).toBe(true)
    }
    const byStatus = repository.wahaSendAttemptCountByStatus(now - 3_600_000)
    expect(byStatus.success).toBe(true)
    if (!byStatus.success) return
    expect(byStatus.data.sort((a, b) => a.status.localeCompare(b.status))).toEqual([
      { count: 1, status: "failed" },
      { count: 2, status: "sent" },
    ])

    const byPurpose = repository.wahaSendAttemptCountByPurpose(now - 3_600_000)
    expect(byPurpose.success).toBe(true)
    if (!byPurpose.success) return
    expect(byPurpose.data.sort((a, b) => a.purpose.localeCompare(b.purpose))).toEqual([
      { count: 1, purpose: "registration" },
      { count: 2, purpose: "sign_in" },
    ])
  })
})

test("sent counts group all senders by endpoint and session without one query per sender", async () => {
  await withDatabase(async (database, testkit) => {
    const repository = wahaSendAttemptRepositoryCreate(database.db)
    const now = testkit.runtime.now()
    const rows = [
      { createdAt: now - 1_000, endpointId: "primary", id: "attempt-a1", sessionName: "one", status: "sent" as const },
      { createdAt: now - 2_000, endpointId: "primary", id: "attempt-a2", sessionName: "one", status: "sent" as const },
      { createdAt: now - 3_000, endpointId: "primary", id: "attempt-b1", sessionName: "two", status: "sent" as const },
      { createdAt: now - 4_000, endpointId: "backup", id: "attempt-c1", sessionName: "one", status: "sent" as const },
      { createdAt: now - 5_000, endpointId: "backup", id: "attempt-c2", sessionName: "one", status: "failed" as const },
      {
        createdAt: now - 2 * 3_600_000,
        endpointId: "primary",
        id: "attempt-old",
        sessionName: "one",
        status: "sent" as const,
      },
    ]
    for (const row of rows) {
      const recorded = repository.wahaSendAttemptRecord({
        createdAt: row.createdAt,
        endpointId: row.endpointId,
        id: row.id,
        purpose: "sign_in",
        realmId: null,
        recipientPhoneHash: "hash-abc",
        sessionName: row.sessionName,
        status: row.status,
      })
      expect(recorded.success).toBe(true)
    }
    const counted = repository.wahaSendAttemptSentCountBySender(now - 3_600_000)
    expect(counted.success).toBe(true)
    if (!counted.success) return
    expect(
      counted.data.sort((a, b) => `${a.endpointId}/${a.sessionName}`.localeCompare(`${b.endpointId}/${b.sessionName}`)),
    ).toEqual([
      { endpointId: "backup", sentCount: 1, sessionName: "one" },
      { endpointId: "primary", sentCount: 2, sessionName: "one" },
      { endpointId: "primary", sentCount: 1, sessionName: "two" },
    ])
  })
})
