import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { userEmailAddressContextValidate } from "../domain/userEmailAddressContextValidate.js"
import { userEmailAddressPublicViewCreate } from "../domain/userEmailAddressPublicViewCreate.js"
import { userEmailChangeRateLimitConsume } from "../domain/userEmailChangeRateLimitConsume.js"
import { userEmailChangeRecentAuthenticationValidate } from "../domain/userEmailChangeRecentAuthenticationValidate.js"
import { userEmailChangeTokenHashCreate } from "../domain/userEmailChangeTokenHashCreate.js"
import { userEmailAddressVerificationFailedEventPayloadSchema } from "../events/userEmailAddressVerificationFailedEventPayloadSchema.js"
import { userEmailAddressVerifiedEventPayloadSchema } from "../events/userEmailAddressVerifiedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import type { UserEmailAddressAddVerifyRequest } from "../public/userEmailAddressAddVerifyRequestSchema.js"
import { userEmailAddressAddVerifyRequestSchema } from "../public/userEmailAddressAddVerifyRequestSchema.js"
import type { UserEmailAddressAddVerifyResponse } from "../public/userEmailAddressAddVerifyResponseSchema.js"

type UserEmailAddressAddVerifyOptions = {
  readonly clientIp?: string
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: UserEmailAddressAddVerifyRequest
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

type UserEmailAddressAddVerifyCommit =
  | { readonly failure: true }
  | { readonly rateLimited: true; readonly retryAt: number }
  | { readonly response: UserEmailAddressAddVerifyResponse }

export function userEmailAddressAddVerify(
  options: UserEmailAddressAddVerifyOptions,
): Result<UserEmailAddressAddVerifyResponse> {
  const op = "userEmailAddressAddVerify"
  const context = userEmailAddressContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userEmailAddressAddVerifyRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The email verification token is invalid.", "users.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email verification timestamp is invalid.", "users.invalid-timestamp")
  const recent = userEmailChangeRecentAuthenticationValidate(options.session, options.realmId, options.userId, now)
  if (!recent.success) return recent
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    userEmailAddressAddVerifyTransaction({
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      input: parsed.output,
      now,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
      userId: options.userId,
    }),
  )
  if (!committed.success) return committed
  if ("rateLimited" in committed.data)
    return resultErrorCreate(op, "Too many email verification requests.", "users.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if ("failure" in committed.data)
    return resultErrorCreate(op, "The email verification token is invalid.", "users.invalid")
  return resultCreate(committed.data.response)
}

type UserEmailAddressAddVerifyTransactionOptions = {
  readonly clientIp: string
  readonly context: RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly input: UserEmailAddressAddVerifyRequest
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

function userEmailAddressAddVerifyTransaction(
  options: UserEmailAddressAddVerifyTransactionOptions,
): Result<UserEmailAddressAddVerifyCommit> {
  const limited = userEmailChangeRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.input.challengeId,
    now: options.now,
    operation: "verify",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })
  const challenges = userEmailChangeRepositoryCreate(options.database)
  const challenge = challenges.userEmailChangeChallengeGet(
    options.realmId,
    options.userId,
    options.input.challengeId,
    "email_address",
  )
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    challenge.data.consumedAt !== null ||
    challenge.data.attempts >= challenge.data.maxAttempts
  )
    return resultCreate({ failure: true })
  const current = challenge.data
  if (current.expiresAt <= options.now)
    return userEmailAddressVerificationExpiredRecord(options, current.version, current.pendingEmail)
  if (current.tokenHash !== userEmailChangeTokenHashCreate(options.input.token)) {
    const attempts = current.attempts + 1
    const updated = challenges.userEmailChangeChallengeAttemptRecord({
      attempts,
      consumedAt: attempts >= current.maxAttempts ? options.now : null,
      expectedVersion: current.version,
      id: current.id,
      realmId: options.realmId,
      version: current.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultCreate({ failure: true })
    if (attempts >= current.maxAttempts) {
      const pending = userEmailAddressPendingDelete(options, current.pendingEmail)
      if (!pending.success) return pending
    }
    const event = userEmailAddressVerificationFailedEventAppend(options, updated.data.version, "invalid_token")
    if (!event.success) return event
    return resultCreate({ failure: true })
  }

  const emails = userEmailRepositoryCreate(options.database)
  const email = emails.userEmailGetByUserAddress(options.realmId, options.userId, current.pendingEmail)
  if (!email.success) return email
  const verifiedAddress = emails.userEmailGetByVerifiedAddress(options.realmId, current.pendingEmail)
  if (!verifiedAddress.success) return verifiedAddress
  if (verifiedAddress.data !== null)
    return userEmailAddressVerificationInvalidRecord(options, current.version, current.pendingEmail)
  if (
    email.data === null ||
    email.data.userId !== options.userId ||
    email.data.verifiedAt !== null ||
    email.data.isPrimary
  )
    return userEmailAddressVerificationInvalidRecord(options, current.version, current.pendingEmail)
  const verified = emails.userEmailVerificationSet({
    emailId: email.data.id,
    expectedVersion: email.data.version,
    realmId: options.realmId,
    updatedAt: options.now,
    userId: options.userId,
    verifiedAt: options.now,
    version: email.data.version + 1,
  })
  if (!verified.success) return verified
  if (verified.data === null)
    return resultErrorCreate("userEmailAddressAddVerify", "The email address changed concurrently.", "users.conflict")
  const consumed = challenges.userEmailChangeChallengeConsume(options.realmId, current.id, current.version, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultErrorCreate(
      "userEmailAddressAddVerify",
      "The email verification changed concurrently.",
      "users.conflict",
    )
  const payload = v.safeParse(userEmailAddressVerifiedEventPayloadSchema, { verified: true })
  if (!payload.success)
    return resultErrorCreate(
      "userEmailAddressAddVerify",
      "The email verification event payload is invalid.",
      "users.event-invalid",
    )
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: verified.data.id,
      aggregateType: "user_email_address",
      aggregateVersion: verified.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailAddressVerified,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({ response: { email: userEmailAddressPublicViewCreate(verified.data) } })
}

function userEmailAddressVerificationExpiredRecord(
  options: UserEmailAddressAddVerifyTransactionOptions,
  expectedVersion: number,
  pendingEmail: string,
): Result<UserEmailAddressAddVerifyCommit> {
  const pending = userEmailAddressPendingDelete(options, pendingEmail)
  if (!pending.success) return pending
  const challenges = userEmailChangeRepositoryCreate(options.database)
  const consumed = challenges.userEmailChangeChallengeConsume(
    options.realmId,
    options.input.challengeId,
    expectedVersion,
    options.now,
  )
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const event = userEmailAddressVerificationFailedEventAppend(options, consumed.data.version, "expired")
  if (!event.success) return event
  return resultCreate({ failure: true })
}

function userEmailAddressVerificationInvalidRecord(
  options: UserEmailAddressAddVerifyTransactionOptions,
  expectedVersion: number,
  pendingEmail: string,
): Result<UserEmailAddressAddVerifyCommit> {
  const pending = userEmailAddressPendingDelete(options, pendingEmail)
  if (!pending.success) return pending
  const challenges = userEmailChangeRepositoryCreate(options.database)
  const consumed = challenges.userEmailChangeChallengeConsume(
    options.realmId,
    options.input.challengeId,
    expectedVersion,
    options.now,
  )
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const event = userEmailAddressVerificationFailedEventAppend(options, consumed.data.version, "invalid_token")
  if (!event.success) return event
  return resultCreate({ failure: true })
}

function userEmailAddressPendingDelete(
  options: UserEmailAddressAddVerifyTransactionOptions,
  pendingEmail: string,
): Result<void> {
  const emails = userEmailRepositoryCreate(options.database)
  const email = emails.userEmailGetByUserAddress(options.realmId, options.userId, pendingEmail)
  if (!email.success) return email
  if (email.data === null || email.data.verifiedAt !== null) return resultCreate(undefined)
  const deleted = emails.userEmailDelete(options.realmId, options.userId, email.data.id, email.data.version)
  if (!deleted.success) return deleted
  return resultCreate(undefined)
}

function userEmailAddressVerificationFailedEventAppend(
  options: UserEmailAddressAddVerifyTransactionOptions,
  aggregateVersion: number,
  reason: "expired" | "invalid_token",
) {
  const payload = v.safeParse(userEmailAddressVerificationFailedEventPayloadSchema, { reason })
  if (!payload.success)
    return resultErrorCreate(
      "userEmailAddressAddVerify",
      "The email verification event payload is invalid.",
      "users.event-invalid",
    )
  return storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.input.challengeId,
      aggregateType: "user_email_address_verification",
      aggregateVersion,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailAddressVerificationFailed,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
}
