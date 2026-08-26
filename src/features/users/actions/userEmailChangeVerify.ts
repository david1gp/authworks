import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { userEmailChangeRateLimitConsume } from "../domain/userEmailChangeRateLimitConsume.js"
import { userEmailChangeRecentAuthenticationValidate } from "../domain/userEmailChangeRecentAuthenticationValidate.js"
import { userEmailChangeTokenHashCreate } from "../domain/userEmailChangeTokenHashCreate.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEmailChangedEventPayloadSchema } from "../events/userEmailChangedEventPayloadSchema.js"
import { userEmailChangeFailedEventPayloadSchema } from "../events/userEmailChangeFailedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailChangeNotification } from "../public/userEmailChangeNotificationSchema.js"
import type { UserEmailChangeVerifyRequest } from "../public/userEmailChangeVerifyRequestSchema.js"
import { userEmailChangeVerifyRequestSchema } from "../public/userEmailChangeVerifyRequestSchema.js"
import type { UserEmailChangeVerifyResponse } from "../public/userEmailChangeVerifyResponseSchema.js"

type UserEmailChangeVerifyOptions = {
  readonly clientIp?: string
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: UserEmailChangeVerifyRequest
  readonly onNotification?: (notification: UserEmailChangeNotification) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

type UserEmailChangeVerifyCommit =
  | { readonly failure: true }
  | { readonly notification: UserEmailChangeNotification; readonly response: UserEmailChangeVerifyResponse }
  | { readonly rateLimited: true; readonly retryAt: number }

export function userEmailChangeVerify(options: UserEmailChangeVerifyOptions): Result<UserEmailChangeVerifyResponse> {
  const op = "userEmailChangeVerify"
  const context = userEmailChangeContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userEmailChangeVerifyRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The account email-change token is invalid.", "users.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email-change timestamp is invalid.", "users.invalid-timestamp")
  const recent = userEmailChangeRecentAuthenticationValidate(options.session, options.realmId, options.userId, now)
  if (!recent.success) return recent
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    userEmailChangeVerifyTransaction({
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
    return resultErrorCreate(op, "Too many email-change requests.", "users.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if ("failure" in committed.data)
    return resultErrorCreate(op, "The account email-change token is invalid.", "users.invalid")
  userEmailChangeNotificationInvoke(options.onNotification, committed.data.notification)
  return resultCreate(committed.data.response)
}

type UserEmailChangeVerifyTransactionOptions = {
  readonly clientIp: string
  readonly context: RealmTenantContext
  readonly correlationId: string
  readonly database: StorageTransaction
  readonly input: UserEmailChangeVerifyRequest
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

function userEmailChangeVerifyTransaction(
  options: UserEmailChangeVerifyTransactionOptions,
): Result<UserEmailChangeVerifyCommit> {
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
  const repository = userEmailChangeRepositoryCreate(options.database)
  const challenge = repository.userEmailChangeChallengeGet(options.realmId, options.userId, options.input.challengeId)
  if (!challenge.success) return challenge
  if (challenge.data === null || challenge.data.consumedAt !== null) return resultCreate({ failure: true })
  const current = challenge.data
  if (current.expiresAt <= options.now) {
    const consumed = repository.userEmailChangeChallengeConsume(
      options.realmId,
      current.id,
      current.version,
      options.now,
    )
    if (!consumed.success) return consumed
    if (consumed.data === null) return resultCreate({ failure: true })
    const event = userEmailChangeFailedEventAppend(options, consumed.data.version, "expired")
    if (!event.success) return event
    return resultCreate({ failure: true })
  }
  if (current.tokenHash !== userEmailChangeTokenHashCreate(options.input.token)) {
    const attempts = current.attempts + 1
    const updated = repository.userEmailChangeChallengeAttemptRecord({
      attempts,
      consumedAt: attempts >= current.maxAttempts ? options.now : null,
      expectedVersion: current.version,
      id: current.id,
      realmId: options.realmId,
      version: current.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultCreate({ failure: true })
    const event = userEmailChangeFailedEventAppend(options, updated.data.version, "invalid_token")
    if (!event.success) return event
    return resultCreate({ failure: true })
  }
  const users = userRepositoryCreate(options.database)
  const user = users.userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
    return resultErrorCreate("userEmailChangeVerify", "The authenticated user is not available.", "users.not-found")
  if (user.data.email === current.pendingEmail)
    return resultErrorCreate("userEmailChangeVerify", "The account already uses this email address.", "users.conflict")
  const conflict = users.userGetByEmail(options.realmId, current.pendingEmail)
  if (!conflict.success) return conflict
  if (conflict.data !== null && conflict.data.id !== options.userId)
    return resultErrorCreate(
      "userEmailChangeVerify",
      "The email address is already used by another account.",
      "users.conflict",
    )
  const consumed = repository.userEmailChangeChallengeConsume(options.realmId, current.id, current.version, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const updated = users.userEmailChange({
    email: current.pendingEmail,
    emailVerifiedAt: options.now,
    expectedVersion: user.data.version,
    realmId: options.realmId,
    updatedAt: options.now,
    userId: options.userId,
    version: user.data.version + 1,
  })
  if (!updated.success) return updated
  if (updated.data === null)
    return resultErrorCreate(
      "userEmailChangeVerify",
      "The account was changed concurrently. Request a new email change.",
      "users.conflict",
    )
  const payload = v.safeParse(userEmailChangedEventPayloadSchema, { verified: true })
  if (!payload.success)
    return resultErrorCreate(
      "userEmailChangeVerify",
      "The email-change event payload is invalid.",
      "users.event-invalid",
    )
  const challengeEvent = eventSecurityEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: current.id,
      aggregateType: "user_email_change",
      aggregateVersion: consumed.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailChangeVerified,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.now,
      payload: payload.output,
      userSubjectId: options.userId,
    },
    options.runtime,
  )
  if (!challengeEvent.success) return challengeEvent
  const userEvent = eventSecurityEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "user",
      aggregateVersion: updated.data.version,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailChanged,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.now,
      payload: payload.output,
      userSubjectId: options.userId,
    },
    options.runtime,
  )
  if (!userEvent.success) return userEvent
  return resultCreate({
    notification: {
      email: user.data.email,
      newEmail: current.pendingEmail,
      realmId: options.realmId,
      userId: options.userId,
    },
    response: { user: userPublicViewCreate(updated.data) },
  })
}

function userEmailChangeFailedEventAppend(
  options: UserEmailChangeVerifyTransactionOptions,
  aggregateVersion: number,
  reason: "expired" | "invalid_token",
) {
  const payload = v.safeParse(userEmailChangeFailedEventPayloadSchema, { reason })
  if (!payload.success)
    return resultErrorCreate(
      "userEmailChangeVerify",
      "The email-change event payload is invalid.",
      "users.event-invalid",
    )
  return eventSecurityEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.input.challengeId,
      aggregateType: "user_email_change",
      aggregateVersion,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailChangeFailed,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.now,
      payload: payload.output,
      userSubjectId: options.userId,
    },
    options.runtime,
  )
}

function userEmailChangeContextValidate(context: RealmTenantContext, realmId: string, userId: string): Result<void> {
  if (
    context === undefined ||
    context === null ||
    context.kind !== "tenant" ||
    context.realmId !== realmId ||
    context.actor.kind !== "user" ||
    context.actor.realmId !== realmId ||
    context.actor.actorId !== userId
  )
    return resultErrorCreate(
      "userEmailChangeVerify",
      "An authenticated user is required for the account email change.",
      "users.forbidden",
    )
  return resultCreate(undefined)
}

function userEmailChangeNotificationInvoke(
  callback: ((notification: UserEmailChangeNotification) => void | Promise<void>) | undefined,
  notification: UserEmailChangeNotification,
): void {
  try {
    if (callback !== undefined) void Promise.resolve(callback(notification)).catch(() => undefined)
  } catch (_error) {}
}
