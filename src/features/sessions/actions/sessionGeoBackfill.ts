import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { SessionGeoLocation, SessionGeoLookupPort } from "../domain/sessionGeoLookupPort.js"
import { sessionPrivateIpIs } from "../domain/sessionPrivateIpIs.js"
import { sessionGeoCacheRepositoryCreate } from "../persistence/sessionGeoCacheRepositoryCreate.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"

const sessionGeoCacheTtlMs = 7 * 24 * 60 * 60 * 1_000
const sessionGeoBackfillDefaultLimit = 25

type SessionGeoBackfillOptions = {
  readonly database: StorageDatabase
  readonly limit?: number
  readonly lookup: SessionGeoLookupPort
  readonly now?: number
}

export type SessionGeoBackfillReport = {
  readonly backfilled: number
  readonly cached: number
  readonly failed: number
  readonly skipped: number
}

/**
 * Fills country and region for sessions with an IP address. Network lookups run outside
 * transactions and state writes land in one transaction, so request handling never waits.
 */
export async function sessionGeoBackfill(
  options: SessionGeoBackfillOptions,
): Promise<Result<SessionGeoBackfillReport>> {
  const op = "sessionGeoBackfill"
  try {
    const now = options.now ?? options.database.runtime.now()
    const limit = options.limit ?? sessionGeoBackfillDefaultLimit
    if (!Number.isSafeInteger(now) || now < 0)
      return resultErrorCreate(op, "The session geo timestamp is invalid.", "sessions.invalid")
    if (!Number.isSafeInteger(limit) || limit < 1)
      return resultErrorCreate(op, "The session geo backfill limit is invalid.", "sessions.invalid")
    const repository = sessionRepositoryCreate(options.database.db)
    const cache = sessionGeoCacheRepositoryCreate(options.database.db)
    const pending = repository.sessionGeoPendingList(limit)
    if (!pending.success) return pending
    const report: { backfilled: number; cached: number; failed: number; skipped: number } = {
      backfilled: 0,
      cached: 0,
      failed: 0,
      skipped: 0,
    }
    const sessionUpdates: { countryCode: string | null; realmId: string; region: string | null; sessionId: string }[] =
      []
    const cacheWrites: ({ countryCode: string | null; ip: string; region: string | null } & {
      readonly updatedAt: number
    })[] = []
    const seen = new Map<string, SessionGeoLocation | null>()
    for (const session of pending.data) {
      if (session.ipAddress === null || sessionPrivateIpIs(session.ipAddress)) {
        report.skipped += 1
        continue
      }
      const located = await sessionGeoLocationResolve(cache, options.lookup, seen, session.ipAddress, now)
      if (located === null) {
        report.failed += 1
        continue
      }
      if (located.fromCache) report.cached += 1
      if (located.fresh) cacheWrites.push({ ...located.location, ip: session.ipAddress, updatedAt: now })
      if (located.location.countryCode !== null || located.location.region !== null)
        sessionUpdates.push({ ...located.location, realmId: session.realmId, sessionId: session.id })
      report.backfilled += 1
    }
    if (cacheWrites.length > 0 || sessionUpdates.length > 0) {
      const stored = storageTransactionRun(options.database, (transaction) => {
        const cacheRepository = sessionGeoCacheRepositoryCreate(transaction)
        const sessionRepository = sessionRepositoryCreate(transaction)
        for (const write of cacheWrites) {
          const cached = cacheRepository.sessionGeoCacheUpsert(write)
          if (!cached.success) return cached
        }
        for (const update of sessionUpdates) {
          const updated = sessionRepository.sessionGeoUpdate(update.realmId, update.sessionId, update)
          if (!updated.success) return updated
        }
        return resultCreate(undefined)
      })
      if (!stored.success) return stored
    }
    return resultCreate(report)
  } catch (_error) {
    return resultErrorCreate(op, "The session geo backfill failed.", "sessions.write-failed")
  }
}

async function sessionGeoLocationResolve(
  cache: ReturnType<typeof sessionGeoCacheRepositoryCreate>,
  lookup: SessionGeoLookupPort,
  seen: Map<string, SessionGeoLocation | null>,
  ip: string,
  now: number,
): Promise<{ fresh: boolean; fromCache: boolean; location: SessionGeoLocation } | null> {
  const pending = seen.get(ip)
  if (pending !== undefined) {
    if (pending === null) return null
    return { fresh: false, fromCache: false, location: pending }
  }
  const cached = cache.sessionGeoCacheGet(ip)
  if (!cached.success) throw new Error(cached.errorMessage)
  if (cached.data !== null && now - cached.data.updatedAt < sessionGeoCacheTtlMs) {
    const location = { countryCode: cached.data.countryCode, region: cached.data.region }
    seen.set(ip, location)
    return { fresh: false, fromCache: true, location }
  }
  const located = await lookup.lookup(ip)
  seen.set(ip, located)
  if (located === null) return null
  return { fresh: true, fromCache: false, location: located }
}
