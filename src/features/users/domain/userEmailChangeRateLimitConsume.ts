import type { Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { rateLimitConsumeMany } from "../../../platform/rateLimit/rateLimitConsumeMany.js"
import { rateLimitKeyHashCreate } from "../../../platform/rateLimit/rateLimitKeyHashCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"

type UserEmailChangeRateLimitConsumeOptions = {
  readonly clientIp: string
  readonly identifier: string
  readonly now: number
  readonly operation: "resend" | "start" | "verify"
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly userId: string
}

export function userEmailChangeRateLimitConsume(
  database: StorageExecutor,
  options: UserEmailChangeRateLimitConsumeOptions,
): Result<{ readonly allowed: boolean; readonly retryAt: number }> {
  const op = "userEmailChangeRateLimitConsume"
  const secret =
    typeof options.rateLimitSecret === "string" ? options.rateLimitSecret : options.rateLimitSecret?.valueGet()
  if (secret === undefined || secret.length === 0)
    return resultErrorCreate(
      op,
      "Email-change rate limiting requires a system secret.",
      "platform.configuration-invalid",
    )
  const dimensions = [
    userEmailChangeRateLimitDimensionCreate(options, "identifier", options.identifier, secret),
    userEmailChangeRateLimitDimensionCreate(options, "user", options.userId, secret),
    userEmailChangeRateLimitDimensionCreate(options, "ip", options.clientIp, secret),
    ...(options.operation === "verify"
      ? [userEmailChangeRateLimitDimensionCreate(options, "account", options.userId, secret)]
      : []),
  ]
  return rateLimitConsumeMany(database, { dimensions, now: options.now })
}

function userEmailChangeRateLimitDimensionCreate(
  options: UserEmailChangeRateLimitConsumeOptions,
  kind: "account" | "identifier" | "ip" | "user",
  value: string,
  secret: string,
) {
  return {
    keyHash: rateLimitKeyHashCreate(secret, `${options.realmId}:email_change:${options.operation}:${kind}:${value}`),
    limit: 5,
    scope: `users.email_change.${options.operation}.${kind}`,
    windowMs: 60 * 1_000,
  }
}
