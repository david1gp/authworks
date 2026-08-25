import type { Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { rateLimitConsume } from "../../../platform/rateLimit/rateLimitConsume.js"
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
  const identifier = userEmailChangeRateLimitKeyConsume(database, options, "identifier", options.identifier, secret)
  if (!identifier.success) return identifier
  const user = userEmailChangeRateLimitKeyConsume(database, options, "user", options.userId, secret)
  if (!user.success) return user
  const ip = userEmailChangeRateLimitKeyConsume(database, options, "ip", options.clientIp, secret)
  if (!ip.success) return ip
  if (!identifier.data.allowed || !user.data.allowed || !ip.data.allowed)
    return {
      data: {
        allowed: false,
        retryAt: Math.max(
          identifier.data.allowed ? options.now : identifier.data.retryAt,
          user.data.allowed ? options.now : user.data.retryAt,
          ip.data.allowed ? options.now : ip.data.retryAt,
        ),
      },
      success: true,
    }
  return {
    data: { allowed: true, retryAt: Math.max(identifier.data.retryAt, user.data.retryAt, ip.data.retryAt) },
    success: true,
  }
}

function userEmailChangeRateLimitKeyConsume(
  database: StorageExecutor,
  options: UserEmailChangeRateLimitConsumeOptions,
  kind: "identifier" | "ip" | "user",
  value: string,
  secret: string,
) {
  return rateLimitConsume(database, {
    keyHash: rateLimitKeyHashCreate(secret, `${options.realmId}:email_change:${options.operation}:${kind}:${value}`),
    limit: 5,
    now: options.now,
    scope: `users.email_change.${options.operation}.${kind}`,
    windowMs: 60 * 1_000,
  })
}
