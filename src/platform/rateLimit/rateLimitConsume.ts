import { sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import type { StorageExecutor } from "../storage/storageSchema.js"
import { rateLimitTable } from "./rateLimitTable.js"

type RateLimitConsumeOptions = {
  readonly keyHash: string
  readonly limit: number
  readonly now: number
  readonly scope: string
  readonly windowMs: number
}

const rateLimitCleanupBatchSize = 32

export function rateLimitConsume(
  database: StorageExecutor,
  options: RateLimitConsumeOptions,
): Result<{ readonly allowed: boolean; readonly count: number; readonly retryAt: number }> {
  const op = "rateLimitConsume"
  if (
    !Number.isSafeInteger(options.now) ||
    options.now < 0 ||
    !Number.isSafeInteger(options.windowMs) ||
    options.windowMs < 1
  )
    return resultErrorCreate(op, "The rate-limit window is invalid.")
  if (!Number.isSafeInteger(options.limit) || options.limit < 1)
    return resultErrorCreate(op, "The rate-limit limit is invalid.")
  try {
    const sameWindow = sql`${rateLimitTable.expiresAt} > ${options.now}`
    const row = database
      .insert(rateLimitTable)
      .values({
        count: 1,
        expiresAt: options.now + options.windowMs,
        keyHash: options.keyHash,
        scope: options.scope,
        updatedAt: options.now,
        version: 1,
        windowStartedAt: options.now,
      })
      .onConflictDoUpdate({
        set: {
          count: sql`CASE WHEN ${sameWindow} THEN ${rateLimitTable.count} + 1 ELSE 1 END`,
          expiresAt: sql`CASE WHEN ${sameWindow} THEN ${rateLimitTable.expiresAt} ELSE ${options.now + options.windowMs} END`,
          updatedAt: options.now,
          version: sql`${rateLimitTable.version} + 1`,
          windowStartedAt: sql`CASE WHEN ${sameWindow} THEN ${rateLimitTable.windowStartedAt} ELSE ${options.now} END`,
        },
        target: [rateLimitTable.scope, rateLimitTable.keyHash],
      })
      .returning()
      .get()
    if (row === undefined) return resultErrorCreate(op, "The rate limit could not be updated.")
    rateLimitExpiredRowsCleanup(database, options.now)
    const retryAt = row.expiresAt
    return resultCreate({ allowed: row.count <= options.limit, count: row.count, retryAt })
  } catch (_error) {
    return resultErrorCreate(op, "The rate limit could not be updated.")
  }
}

function rateLimitExpiredRowsCleanup(database: StorageExecutor, now: number): void {
  try {
    database
      .delete(rateLimitTable)
      .where(
        sql`rowid IN (
          SELECT rowid
          FROM rate_limits
          WHERE ${rateLimitTable.expiresAt} <= ${now}
          ORDER BY ${rateLimitTable.expiresAt}, ${rateLimitTable.scope}, ${rateLimitTable.keyHash}
          LIMIT ${rateLimitCleanupBatchSize}
        )`,
      )
      .run()
  } catch (_error) {
    return
  }
}
