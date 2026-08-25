import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCreate } from "../errors/resultErrorCreate.js"
import type { StorageExecutor } from "../storage/storageSchema.js"
import { rateLimitTable } from "./rateLimitTable.js"
import { rateLimitConsume } from "./rateLimitConsume.js"

type RateLimitConsumeManyDimension = {
  readonly keyHash: string
  readonly limit: number
  readonly scope: string
  readonly windowMs: number
}

type RateLimitConsumeManyOptions = {
  readonly dimensions: readonly RateLimitConsumeManyDimension[]
  readonly now: number
}

export function rateLimitConsumeMany(
  database: StorageExecutor,
  options: RateLimitConsumeManyOptions,
): Result<{ readonly allowed: boolean; readonly retryAt: number }> {
  const op = "rateLimitConsumeMany"
  if (options.dimensions.length === 0) return resultErrorCreate(op, "At least one rate-limit dimension is required.")
  for (const dimension of options.dimensions) {
    if (
      !Number.isSafeInteger(options.now) ||
      options.now < 0 ||
      !Number.isSafeInteger(dimension.windowMs) ||
      dimension.windowMs < 1
    )
      return resultErrorCreate(op, "The rate-limit window is invalid.")
    if (!Number.isSafeInteger(dimension.limit) || dimension.limit < 1)
      return resultErrorCreate(op, "The rate-limit limit is invalid.")
  }

  try {
    const checked = options.dimensions.map((dimension) => rateLimitDimensionCheck(database, dimension, options.now))
    const denied = checked.filter((dimension) => !dimension.allowed)
    if (denied.length > 0)
      return resultCreate({
        allowed: false,
        retryAt: Math.max(...denied.map((dimension) => dimension.retryAt)),
      })

    const consumed = options.dimensions.map((dimension) =>
      rateLimitConsume(database, { ...dimension, now: options.now }),
    )
    const successful = []
    for (const result of consumed) {
      if (!result.success) return result
      successful.push(result.data)
    }
    return resultCreate({
      allowed: true,
      retryAt: Math.max(...successful.map((result) => result.retryAt)),
    })
  } catch (_error) {
    return resultErrorCreate(op, "The rate limits could not be checked.")
  }
}

function rateLimitDimensionCheck(
  database: StorageExecutor,
  dimension: RateLimitConsumeManyDimension,
  now: number,
): { readonly allowed: boolean; readonly retryAt: number } {
  const row = database
    .select()
    .from(rateLimitTable)
    .where(and(eq(rateLimitTable.keyHash, dimension.keyHash), eq(rateLimitTable.scope, dimension.scope)))
    .get()
  if (row === undefined || row.expiresAt <= now) return { allowed: true, retryAt: now + dimension.windowMs }
  const count = row.count + 1
  return { allowed: count <= dimension.limit, retryAt: row.expiresAt }
}
