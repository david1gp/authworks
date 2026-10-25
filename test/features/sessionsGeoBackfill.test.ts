import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../src/features/realms/domain/realmTenantContextCreate.js"
import { passwordEmailVerify } from "../../src/features/passwords/actions/passwordEmailVerify.js"
import { passwordRegister } from "../../src/features/passwords/actions/passwordRegister.js"
import { sessionIssue } from "../../src/features/sessions/actions/sessionIssue.js"
import { sessionGeoBackfill } from "../../src/features/sessions/actions/sessionGeoBackfill.js"
import type { SessionGeoLookupPort } from "../../src/features/sessions/domain/sessionGeoLookupPort.js"
import type { StorageDatabase } from "../../src/platform/storage/storageDatabaseOpen.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

async function withDatabase<T>(
  operation: (database: StorageDatabase, testkit: ReturnType<typeof platformTestkitCreate>) => Promise<T>,
) {
  const directory = await mkdtemp(join(tmpdir(), "authworks-sessions-geo-"))
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

async function createVerifiedUser(database: StorageDatabase, domain: string) {
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database,
    input: { domain, name: domain },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) throw new Error(realm.errorMessage)
  const context = realmTenantContextCreate(realm.data.realm.id, "anonymous")
  let token = ""
  let userId = ""
  const registered = passwordRegister({
    context,
    database,
    input: {
      email: `geo@${domain}`,
      password: "Correct Horse 12",
      profile: { displayName: "Geo User" },
      userName: "geo-user",
    },
    realmId: realm.data.realm.id,
    onVerificationToken: (delivery) => {
      token = delivery.token
      userId = delivery.userId
    },
  })
  expect(registered.success).toBe(true)
  expect(passwordEmailVerify({ context, database, input: { token }, realmId: realm.data.realm.id }).success).toBe(true)
  return { realm: realm.data.realm, userId }
}

function issueSessionWithIp(
  database: StorageDatabase,
  realmId: string,
  userId: string,
  ipAddress: string | undefined,
  userAgent: string,
) {
  const issued = sessionIssue({
    assurance: "authenticated",
    authenticationMethod: "password",
    database,
    ...(ipAddress === undefined ? { deviceMetadata: { userAgent } } : { deviceMetadata: { ipAddress, userAgent } }),
    realmId,
    userId,
  })
  if (!issued.success) throw new Error(issued.errorMessage)
  return issued.data.session
}

function sessionGeoGet(database: StorageDatabase, sessionId: string) {
  const row = database.sqlite
    .query("SELECT country_code AS countryCode, region FROM sessions WHERE id = ?")
    .get(sessionId) as { countryCode: string | null; region: string | null } | null
  return row
}

function lookupCreate(calls: string[]): SessionGeoLookupPort {
  return {
    lookup: async (ip: string) => {
      calls.push(ip)
      return { countryCode: "DE", region: "Bavaria" }
    },
  }
}

test("session geo backfill fills country and region without touching the request path", async () => {
  await withDatabase(async (database) => {
    const { realm, userId } = await createVerifiedUser(database, "geo-backfill.example.com")
    const agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    const first = issueSessionWithIp(database, realm.id, userId, "8.8.8.8", agent)
    const second = issueSessionWithIp(database, realm.id, userId, "8.8.8.8", agent)
    const calls: string[] = []
    const backfilled = await sessionGeoBackfill({ database, lookup: lookupCreate(calls) })
    expect(backfilled.success).toBe(true)
    if (!backfilled.success) return
    expect(backfilled.data).toEqual({ backfilled: 2, cached: 0, failed: 0, skipped: 0 })
    expect(calls).toEqual(["8.8.8.8"])
    expect(sessionGeoGet(database, first.id)).toEqual({ countryCode: "DE", region: "Bavaria" })
    expect(sessionGeoGet(database, second.id)).toEqual({ countryCode: "DE", region: "Bavaria" })

    const repeated = await sessionGeoBackfill({ database, lookup: lookupCreate(calls) })
    expect(repeated.success).toBe(true)
    if (!repeated.success) return
    expect(repeated.data).toEqual({ backfilled: 0, cached: 0, failed: 0, skipped: 0 })
    expect(calls).toEqual(["8.8.8.8"])
  })
})

test("session geo backfill reuses one lookup for shared addresses across sessions", async () => {
  await withDatabase(async (database) => {
    const { realm, userId } = await createVerifiedUser(database, "geo-shared.example.com")
    const agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    issueSessionWithIp(database, realm.id, userId, "1.1.1.1", agent)
    issueSessionWithIp(database, realm.id, userId, "1.1.1.1", agent)
    issueSessionWithIp(database, realm.id, userId, "8.8.4.4", agent)
    const calls: string[] = []
    const backfilled = await sessionGeoBackfill({ database, lookup: lookupCreate(calls) })
    expect(backfilled.success).toBe(true)
    if (!backfilled.success) return
    expect(backfilled.data).toEqual({ backfilled: 3, cached: 0, failed: 0, skipped: 0 })
    expect(calls).toEqual(["1.1.1.1", "8.8.4.4"])
  })
})

test("session geo backfill skips private addresses and sessions without an address", async () => {
  await withDatabase(async (database) => {
    const { realm, userId } = await createVerifiedUser(database, "geo-private.example.com")
    const agent = "Mozilla/5.0 (X11; Linux x86_64)"
    const loopback = issueSessionWithIp(database, realm.id, userId, "127.0.0.1", agent)
    const lan = issueSessionWithIp(database, realm.id, userId, "192.168.1.10", agent)
    const linkLocal = issueSessionWithIp(database, realm.id, userId, "::1", agent)
    const missing = issueSessionWithIp(database, realm.id, userId, undefined, agent)
    const calls: string[] = []
    const backfilled = await sessionGeoBackfill({ database, lookup: lookupCreate(calls) })
    expect(backfilled.success).toBe(true)
    if (!backfilled.success) return
    expect(backfilled.data).toEqual({ backfilled: 0, cached: 0, failed: 0, skipped: 3 })
    expect(calls).toEqual([])
    expect(sessionGeoGet(database, loopback.id)).toEqual({ countryCode: null, region: null })
    expect(sessionGeoGet(database, lan.id)).toEqual({ countryCode: null, region: null })
    expect(sessionGeoGet(database, linkLocal.id)).toEqual({ countryCode: null, region: null })
    expect(sessionGeoGet(database, missing.id)).toEqual({ countryCode: null, region: null })
  })
})

test("session geo backfill refreshes stale cache entries and tolerates lookup failures", async () => {
  await withDatabase(async (database, testkit) => {
    const { realm, userId } = await createVerifiedUser(database, "geo-stale.example.com")
    const agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    const stale = issueSessionWithIp(database, realm.id, userId, "9.9.9.9", agent)
    const failing = issueSessionWithIp(database, realm.id, userId, "149.112.112.112", agent)
    const now = testkit.runtime.now()
    database.sqlite
      .query("INSERT INTO session_geo_cache (ip, country_code, region, updated_at) VALUES (?, ?, ?, ?)")
      .run("9.9.9.9", "US", "California", now - 8 * 24 * 60 * 60 * 1_000)
    const calls: string[] = []
    const lookup: SessionGeoLookupPort = {
      lookup: async (ip: string) => {
        calls.push(ip)
        if (ip === "149.112.112.112") return null
        return { countryCode: "DE", region: "Bavaria" }
      },
    }
    const backfilled = await sessionGeoBackfill({ database, lookup, now })
    expect(backfilled.success).toBe(true)
    if (!backfilled.success) return
    expect(backfilled.data).toEqual({ backfilled: 1, cached: 0, failed: 1, skipped: 0 })
    expect(calls).toEqual(["9.9.9.9", "149.112.112.112"])
    expect(sessionGeoGet(database, stale.id)).toEqual({ countryCode: "DE", region: "Bavaria" })
    expect(sessionGeoGet(database, failing.id)).toEqual({ countryCode: null, region: null })
  })
})
