import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { rateLimitConsume } from "../../../platform/rateLimit/rateLimitConsume.js"
import { rateLimitKeyHashCreate } from "../../../platform/rateLimit/rateLimitKeyHashCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"

type PasswordLoginRateLimitConsumeOptions = {
  readonly clientIp: string
  readonly identifier: string
  readonly now: number
  readonly operation: "login" | "recovery_complete" | "recovery_request"
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
}

export function passwordLoginRateLimitConsume(
  database: StorageExecutor,
  options: PasswordLoginRateLimitConsumeOptions,
) {
  const op = "passwordLoginRateLimitConsume"
  const secret =
    typeof options.rateLimitSecret === "string" ? options.rateLimitSecret : options.rateLimitSecret?.valueGet()
  if (secret === undefined || secret.length === 0)
    return resultErrorCreate(op, "Password rate limiting requires a system secret.", "platform.configuration-invalid")
  const identifier = rateLimitConsume(database, {
    keyHash: rateLimitKeyHashCreate(secret, `${options.realmId}:${options.operation}:identifier:${options.identifier}`),
    // Login attempts are consumed before verification, so legitimate repeated sign-ins count too;
    // the lockout policy remains the hard stop for failed attempts against one account.
    limit: options.operation === "login" ? 20 : 5,
    now: options.now,
    scope: `password.${options.operation}.identifier`,
    windowMs: 60 * 1_000,
  })
  if (!identifier.success) return identifier
  const ip = rateLimitConsume(database, {
    keyHash: rateLimitKeyHashCreate(secret, `${options.realmId}:${options.operation}:ip:${options.clientIp}`),
    // Login shares one egress IP across many legitimate users (NAT/VPN), so the per-IP bucket only
    // throttles credential stuffing; per-identifier limits and lockout policy stop account attacks.
    limit: options.operation === "login" ? 60 : 5,
    now: options.now,
    scope: `password.${options.operation}.ip`,
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
