import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import { userEmailChangeRateLimitConsume } from "../domain/userEmailChangeRateLimitConsume.js"
import { userEmailChangeTokenCreate } from "../domain/userEmailChangeTokenCreate.js"
import { userEmailChangeTokenHashCreate } from "../domain/userEmailChangeTokenHashCreate.js"
import { userEmailAddressVerificationRequestedEventPayloadSchema } from "../events/userEmailAddressVerificationRequestedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailAddressVerificationDelivery } from "../public/userEmailAddressVerificationDeliverySchema.js"
import type { UserEmailVerificationResendResponse } from "../public/userEmailVerificationResendResponseSchema.js"

const userEmailVerificationResendCooldownMs = 60 * 1_000
const userEmailVerificationResendExpiryMs = 10 * 60 * 1_000
const userEmailVerificationResendMaxAttempts = 5

type UserEmailVerificationResendOptions = {
  readonly clientIp?: string
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly emailId: string
  readonly onDelivery?: (delivery: UserEmailAddressVerificationDelivery) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

type UserEmailVerificationResendCommit = {
  readonly delivery?: UserEmailAddressVerificationDelivery
  readonly response: UserEmailVerificationResendResponse
}

/**
 * Administrator-triggered verification challenge for an existing email row. It reuses the
 * same challenge table, token, rate-limit, event, and delivery machinery as the self-service
 * add-email flow, but the route authorizes `user.manage` instead of the subject, so an
 * administrator can resend without ever seeing the code: only the challenge id travels back.
 */
export function userEmailVerificationResend(
  options: UserEmailVerificationResendOptions,
): Result<UserEmailVerificationResendResponse> {
  const op = "userEmailVerificationResend"
  if (options.context === undefined || options.context === null || options.context.kind !== "tenant")
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  if (options.userId.length === 0 || options.emailId.length === 0)
    return resultErrorCreate(op, "The email verification request is invalid.", "users.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email verification timestamp is invalid.", "users.invalid-timestamp")
  const token = userEmailChangeTokenCreate(runtime)
  const challengeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    userEmailVerificationResendTransaction({
      challengeId,
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      emailId: options.emailId,
      now,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
      token: token.valueGet(),
      userId: options.userId,
    }),
  )
  if (!committed.success) return committed
  if ("rateLimited" in committed.data)
    return resultErrorCreate(op, "Too many email verification requests.", "users.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  userEmailVerificationResendDeliveryInvoke(options.onDelivery, committed.data.delivery)
  return resultCreate(committed.data.response)
}

type UserEmailVerificationResendTransactionOptions = {
  readonly challengeId: string
  readonly clientIp: string
  readonly context: RealmTenantContext
  readonly correlationId: string
  readonly database: Parameters<typeof userEmailChangeRepositoryCreate>[0]
  readonly emailId: string
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
  readonly userId: string
}

function userEmailVerificationResendTransaction(
  options: UserEmailVerificationResendTransactionOptions,
): Result<UserEmailVerificationResendCommit | { readonly rateLimited: true; readonly retryAt: number }> {
  const limited = userEmailChangeRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.emailId,
    now: options.now,
    operation: "resend",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })

  const user = userRepositoryCreate(options.database).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted" || user.data.deletedAt !== null)
    return resultErrorCreate("userEmailVerificationResend", "The user was not found.", "users.not-found")
  const email = userEmailRepositoryCreate(options.database).userEmailGet(
    options.realmId,
    options.userId,
    options.emailId,
  )
  if (!email.success) return email
  if (email.data === null || email.data.userId !== options.userId)
    return resultErrorCreate("userEmailVerificationResend", "The email address was not found.", "users.not-found")
  if (email.data.verifiedAt !== null)
    return resultErrorCreate("userEmailVerificationResend", "The email address is already verified.", "users.conflict")
  const challenges = userEmailChangeRepositoryCreate(options.database)
  const latest = challenges.userEmailChangeChallengeLatestGet(
    options.realmId,
    options.userId,
    email.data.email,
    "email_address",
  )
  if (!latest.success) return latest
  if (latest.data !== null && latest.data.consumedAt === null && latest.data.cooldownUntil > options.now)
    return resultCreate({
      response: {
        accepted: true,
        challengeId: latest.data.id,
        expiresAt: latest.data.expiresAt,
        retryAt: latest.data.cooldownUntil,
      },
    })

  const previous = challenges.userEmailChangeChallengeExpireForEmail(
    options.realmId,
    options.userId,
    email.data.email,
    options.now,
    "email_address",
  )
  if (!previous.success) return previous
  const expiresAt = options.now + userEmailVerificationResendExpiryMs
  const cooldownUntil = options.now + userEmailVerificationResendCooldownMs
  const challenge = challenges.userEmailChangeChallengeCreate({
    attempts: 0,
    consumedAt: null,
    cooldownUntil,
    createdAt: options.now,
    expiresAt,
    id: options.challengeId,
    maxAttempts: userEmailVerificationResendMaxAttempts,
    pendingEmail: email.data.email,
    purpose: "email_address",
    realmId: options.realmId,
    tokenHash: userEmailChangeTokenHashCreate(options.token),
    userId: options.userId,
    version: 1,
  })
  if (!challenge.success) return challenge
  const payload = v.safeParse(userEmailAddressVerificationRequestedEventPayloadSchema, { expiresAt })
  if (!payload.success)
    return resultErrorCreate(
      "userEmailVerificationResend",
      "The email verification event payload is invalid.",
      "users.event-invalid",
    )
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.challengeId,
      aggregateType: "user_email_address_verification",
      aggregateVersion: challenge.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailAddressVerificationRequested,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({
    delivery: {
      challengeId: options.challengeId,
      email: email.data.email,
      expiresAt,
      realmId: options.realmId,
      token: options.token,
      userId: options.userId,
      userName: user.data.userName,
    },
    response: { accepted: true, challengeId: options.challengeId, expiresAt, retryAt: cooldownUntil },
  })
}

function userEmailVerificationResendDeliveryInvoke(
  callback: ((delivery: UserEmailAddressVerificationDelivery) => void | Promise<void>) | undefined,
  delivery: UserEmailAddressVerificationDelivery | undefined,
): void {
  if (callback === undefined || delivery === undefined) return
  try {
    void Promise.resolve(callback(delivery)).catch(() => undefined)
  } catch (_error) {
    // Delivery callbacks must never fail the resend itself.
  }
}
