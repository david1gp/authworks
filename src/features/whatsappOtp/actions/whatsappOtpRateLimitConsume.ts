import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { rateLimitConsume } from "../../../platform/rateLimit/rateLimitConsume.js"
import { rateLimitKeyHashCreate } from "../../../platform/rateLimit/rateLimitKeyHashCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"

type WhatsappOtpRateLimitConsumeOptions = {
  readonly clientIp: string
  readonly identifier: string
  readonly now: number
  readonly operation:
    | "resend"
    | "start"
    | "verify"
    | "phone_change_resend"
    | "phone_change_start"
    | "phone_change_verify"
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
}

export function whatsappOtpRateLimitConsume(
  database: StorageExecutor,
  options: WhatsappOtpRateLimitConsumeOptions,
): Result<{ readonly allowed: boolean; readonly retryAt: number }> {
  const op = "whatsappOtpRateLimitConsume"
  const secret =
    typeof options.rateLimitSecret === "string" ? options.rateLimitSecret : options.rateLimitSecret?.valueGet()
  if (secret === undefined || secret.length === 0)
    return resultErrorCreate(
      op,
      "WhatsApp OTP rate limiting requires a system secret.",
      "platform.configuration-invalid",
    )
  const identifier = rateLimitConsume(database, {
    keyHash: rateLimitKeyHashCreate(secret, `${options.realmId}:${options.operation}:identifier:${options.identifier}`),
    limit: 5,
    now: options.now,
    scope: `whatsapp-otp.${options.operation}.identifier`,
    windowMs: 60 * 1_000,
  })
  if (!identifier.success) return identifier
  const ip = rateLimitConsume(database, {
    keyHash: rateLimitKeyHashCreate(secret, `${options.realmId}:${options.operation}:ip:${options.clientIp}`),
    limit: 5,
    now: options.now,
    scope: `whatsapp-otp.${options.operation}.ip`,
    windowMs: 60 * 1_000,
  })
  if (!ip.success) return ip
  if (!identifier.data.allowed || !ip.data.allowed)
    return resultCreate({
      allowed: false,
      retryAt: Math.max(
        identifier.data.allowed ? options.now : identifier.data.retryAt,
        ip.data.allowed ? options.now : ip.data.retryAt,
      ),
    })
  return resultCreate({ allowed: true, retryAt: Math.max(identifier.data.retryAt, ip.data.retryAt) })
}
