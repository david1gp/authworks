import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { rateLimitConsume } from "../../../platform/rateLimit/rateLimitConsume.js"
import { rateLimitKeyHashCreate } from "../../../platform/rateLimit/rateLimitKeyHashCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { passwordRegistrationRateLimitSecretValidate } from "../domain/passwordRegistrationRateLimitSecretValidate.js"

type PasswordRegistrationRateLimitConsumeOptions = {
  readonly clientIp: string
  readonly delivery: boolean
  readonly identifier: string
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly request?: boolean
  readonly verify: boolean
}

export function passwordRegistrationRateLimitConsume(
  database: StorageExecutor,
  options: PasswordRegistrationRateLimitConsumeOptions,
) {
  const secret = passwordRegistrationRateLimitSecretValidate(options.rateLimitSecret)
  if (!secret.success) return secret
  const operationScope = options.verify ? "verify" : "registration"
  let retryAt = options.now
  if (options.request !== false) {
    const identifier = rateLimitConsume(database, {
      keyHash: rateLimitKeyHashCreate(
        secret.data,
        `${options.realmId}:${operationScope}:identifier:${options.identifier}`,
      ),
      limit: 5,
      now: options.now,
      scope: `password.registration.${operationScope}.identifier`,
      windowMs: 60 * 1_000,
    })
    if (!identifier.success) return identifier

    const ip = rateLimitConsume(database, {
      keyHash: rateLimitKeyHashCreate(secret.data, `${options.realmId}:${operationScope}:ip:${options.clientIp}`),
      limit: 5,
      now: options.now,
      scope: `password.registration.${operationScope}.ip`,
      windowMs: 60 * 1_000,
    })
    if (!ip.success) return ip
    if (!identifier.data.allowed || !ip.data.allowed) {
      const exhaustedRetryAt = Math.max(
        identifier.data.allowed ? options.now : identifier.data.retryAt,
        ip.data.allowed ? options.now : ip.data.retryAt,
      )
      return resultCreate({ allowed: false, retryAt: exhaustedRetryAt })
    }
    retryAt = Math.max(retryAt, identifier.data.retryAt, ip.data.retryAt)
  }
  if (!options.delivery) return resultCreate({ allowed: true, retryAt })

  const delivery = rateLimitConsume(database, {
    keyHash: rateLimitKeyHashCreate(secret.data, `${options.realmId}:registration:delivery:${options.identifier}`),
    limit: 1,
    now: options.now,
    scope: "password.registration.delivery",
    windowMs: 60 * 1_000,
  })
  if (!delivery.success) return delivery
  if (!delivery.data.allowed) return resultCreate({ allowed: false, retryAt: delivery.data.retryAt })
  return resultCreate({ allowed: true, retryAt: Math.max(retryAt, delivery.data.retryAt) })
}
