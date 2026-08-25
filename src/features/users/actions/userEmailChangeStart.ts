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
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userEmailNormalize } from "../domain/userEmailNormalize.js"
import { userEmailChangeRateLimitConsume } from "../domain/userEmailChangeRateLimitConsume.js"
import { userEmailChangeRecentAuthenticationValidate } from "../domain/userEmailChangeRecentAuthenticationValidate.js"
import { userEmailChangeTokenCreate } from "../domain/userEmailChangeTokenCreate.js"
import { userEmailChangeTokenHashCreate } from "../domain/userEmailChangeTokenHashCreate.js"
import { userEmailChangeRequestedEventPayloadSchema } from "../events/userEmailChangeRequestedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailChangeDelivery } from "../public/userEmailChangeDeliverySchema.js"
import type { UserEmailChangeStartRequest } from "../public/userEmailChangeStartRequestSchema.js"
import { userEmailChangeStartRequestSchema } from "../public/userEmailChangeStartRequestSchema.js"
import type { UserEmailChangeStartResponse } from "../public/userEmailChangeStartResponseSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"

const userEmailChangeCooldownMs = 60 * 1_000
const userEmailChangeExpiryMs = 10 * 60 * 1_000
const userEmailChangeMaxAttempts = 5

type UserEmailChangeStartOptions = {
  readonly clientIp?: string
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: UserEmailChangeStartRequest
  readonly onDelivery?: (delivery: UserEmailChangeDelivery) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

type UserEmailChangeStartCommit = {
  readonly delivery?: UserEmailChangeDelivery
  readonly response: UserEmailChangeStartResponse
}

export function userEmailChangeStart(options: UserEmailChangeStartOptions): Result<UserEmailChangeStartResponse> {
  const op = "userEmailChangeStart"
  const context = userEmailChangeContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userEmailChangeStartRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The account email-change request is invalid.", "users.invalid")
  const email = userEmailNormalize(parsed.output.email)
  if (!email.success) return email
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email-change timestamp is invalid.", "users.invalid-timestamp")
  const recent = userEmailChangeRecentAuthenticationValidate(options.session, options.realmId, options.userId, now)
  if (!recent.success) return recent
  const token = userEmailChangeTokenCreate(runtime)
  const challengeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    userEmailChangeStartTransaction({
      challengeId,
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      email: email.data,
      now,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
      token: token.valueGet(),
      userId: options.userId,
    }),
  )
  if (!committed.success) return committed
  const commit = committed.data
  if ("rateLimited" in commit)
    return resultErrorCreate(op, "Too many email-change requests.", "users.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((commit.retryAt - now) / 1_000)),
    })
  userEmailChangeDeliveryInvoke(options.onDelivery, commit.delivery)
  return resultCreate(commit.response)
}

type UserEmailChangeStartTransactionOptions = {
  readonly challengeId: string
  readonly clientIp: string
  readonly context: RealmTenantContext
  readonly correlationId: string
  readonly database: Parameters<typeof userEmailChangeRepositoryCreate>[0]
  readonly email: string
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
  readonly userId: string
}

function userEmailChangeStartTransaction(
  options: UserEmailChangeStartTransactionOptions,
): Result<UserEmailChangeStartCommit | { readonly rateLimited: true; readonly retryAt: number }> {
  const limited = userEmailChangeRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.email,
    now: options.now,
    operation: "start",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })

  const users = userRepositoryCreate(options.database)
  const user = users.userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
    return resultErrorCreate(opName(), "The authenticated user is not available.", "users.not-found")
  if (user.data.email === options.email)
    return resultErrorCreate(opName(), "The account already uses this email address.", "users.conflict")
  const conflict = users.userGetByEmail(options.realmId, options.email)
  if (!conflict.success) return conflict
  if (conflict.data !== null && conflict.data.id !== options.userId)
    return resultErrorCreate(opName(), "The email address is already used by another account.", "users.conflict")

  const challenges = userEmailChangeRepositoryCreate(options.database)
  const latest = challenges.userEmailChangeChallengeLatestGet(options.realmId, options.userId, options.email)
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
  const previous = challenges.userEmailChangeChallengeExpirePrevious(options.realmId, options.userId, options.now)
  if (!previous.success) return previous
  const expiresAt = options.now + userEmailChangeExpiryMs
  const cooldownUntil = options.now + userEmailChangeCooldownMs
  const challenge = challenges.userEmailChangeChallengeCreate({
    attempts: 0,
    consumedAt: null,
    cooldownUntil,
    createdAt: options.now,
    expiresAt,
    id: options.challengeId,
    maxAttempts: userEmailChangeMaxAttempts,
    pendingEmail: options.email,
    realmId: options.realmId,
    tokenHash: userEmailChangeTokenHashCreate(options.token),
    userId: options.userId,
    version: 1,
  })
  if (!challenge.success) return challenge
  const payload = v.safeParse(userEmailChangeRequestedEventPayloadSchema, { expiresAt })
  if (!payload.success)
    return resultErrorCreate(opName(), "The email-change event payload is invalid.", "users.event-invalid")
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.challengeId,
      aggregateType: "user_email_change",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailChangeRequested,
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
      email: options.email,
      expiresAt,
      realmId: options.realmId,
      token: options.token,
      userId: options.userId,
      userName: user.data.userName,
    },
    response: { accepted: true, challengeId: options.challengeId, expiresAt, retryAt: cooldownUntil },
  })
}

function userEmailChangeContextValidate(context: RealmTenantContext, realmId: string, userId: string): Result<void> {
  const op = "userEmailChangeContextValidate"
  if (
    context === undefined ||
    context === null ||
    context.kind !== "tenant" ||
    context.realmId !== realmId ||
    context.actor.kind !== "user" ||
    context.actor.realmId !== realmId ||
    context.actor.actorId !== userId ||
    userId.length === 0
  )
    return resultErrorCreate(op, "An authenticated user is required for the account email change.", "users.forbidden")
  return resultCreate(undefined)
}

function userEmailChangeDeliveryInvoke(
  callback: ((delivery: UserEmailChangeDelivery) => void | Promise<void>) | undefined,
  delivery: UserEmailChangeDelivery | undefined,
): void {
  if (callback === undefined || delivery === undefined) return
  try {
    void Promise.resolve(callback(delivery)).catch(() => undefined)
  } catch (_error) {}
}

function opName(): "userEmailChangeStart" {
  return "userEmailChangeStart"
}
