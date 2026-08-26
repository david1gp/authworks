import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmTenantContext } from "../../realms/server/index.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { userEmailChangeRateLimitConsume } from "../domain/userEmailChangeRateLimitConsume.js"
import { userEmailChangeRecentAuthenticationValidate } from "../domain/userEmailChangeRecentAuthenticationValidate.js"
import { userEmailChangeTokenCreate } from "../domain/userEmailChangeTokenCreate.js"
import { userEmailChangeTokenHashCreate } from "../domain/userEmailChangeTokenHashCreate.js"
import { userEmailNormalize } from "../domain/userEmailNormalize.js"
import { userEmailChangeRequestedEventPayloadSchema } from "../events/userEmailChangeRequestedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailChangeDelivery } from "../public/userEmailChangeDeliverySchema.js"
import type { UserEmailChangeNotification } from "../public/userEmailChangeNotificationSchema.js"
import type { UserEmailChangeResendRequest } from "../public/userEmailChangeResendRequestSchema.js"
import { userEmailChangeResendRequestSchema } from "../public/userEmailChangeResendRequestSchema.js"
import type { UserEmailChangeResendResponse } from "../public/userEmailChangeResendResponseSchema.js"

const userEmailChangeCooldownMs = 60 * 1_000
const userEmailChangeExpiryMs = 10 * 60 * 1_000
const userEmailChangeMaxAttempts = 5

type UserEmailChangeResendOptions = {
  readonly clientIp?: string
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: UserEmailChangeResendRequest
  readonly onDelivery?: (delivery: UserEmailChangeDelivery) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

type UserEmailChangeResendCommit =
  | { readonly delivery?: UserEmailChangeDelivery; readonly response: UserEmailChangeResendResponse }
  | { readonly rateLimited: true; readonly retryAt: number }

export function userEmailChangeResend(options: UserEmailChangeResendOptions): Result<UserEmailChangeResendResponse> {
  const op = "userEmailChangeResend"
  const context = userEmailChangeContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userEmailChangeResendRequestSchema, options.input)
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
  const committed = storageTransactionRun<UserEmailChangeResendCommit>(options.database, (transaction) => {
    const limited = userEmailChangeRateLimitConsume(transaction, {
      clientIp: options.clientIp ?? "unknown",
      identifier: parsed.output.challengeId,
      now,
      operation: "resend",
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      userId: options.userId,
    })
    if (!limited.success) return limited
    if (!limited.data.allowed) return resultCreate({ rateLimited: true as const, retryAt: limited.data.retryAt })
    const repository = userEmailChangeRepositoryCreate(transaction)
    const requested = repository.userEmailChangeChallengeGet(options.realmId, options.userId, parsed.output.challengeId)
    if (!requested.success) return requested
    if (requested.data === null || requested.data.pendingEmail !== email.data)
      return resultErrorCreate(op, "The account email-change challenge is invalid.", "users.invalid")
    const latest = repository.userEmailChangeChallengeLatestGet(options.realmId, options.userId, email.data)
    if (!latest.success) return latest
    if (latest.data === null || latest.data.id !== requested.data.id)
      return resultErrorCreate(op, "The account email-change challenge is invalid.", "users.invalid")
    const user = userRepositoryCreate(transaction).userGet(options.realmId, options.userId)
    if (!user.success) return user
    if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
      return resultErrorCreate(op, "The authenticated user is not available.", "users.not-found")
    if (user.data.email === email.data)
      return resultErrorCreate(op, "The account already uses this email address.", "users.conflict")
    const conflict = userRepositoryCreate(transaction).userGetByEmail(options.realmId, email.data)
    if (!conflict.success) return conflict
    if (conflict.data !== null && conflict.data.id !== options.userId)
      return resultErrorCreate(op, "The email address is already used by another account.", "users.conflict")
    if (latest.data.consumedAt === null && latest.data.cooldownUntil > now)
      return resultCreate({
        response: {
          accepted: true,
          challengeId: latest.data.id,
          expiresAt: latest.data.expiresAt,
          retryAt: latest.data.cooldownUntil,
        },
      })
    const previous = repository.userEmailChangeChallengeExpirePrevious(options.realmId, options.userId, now)
    if (!previous.success) return previous
    const expiresAt = now + userEmailChangeExpiryMs
    const cooldownUntil = now + userEmailChangeCooldownMs
    const created = repository.userEmailChangeChallengeCreate({
      attempts: 0,
      consumedAt: null,
      cooldownUntil,
      createdAt: now,
      expiresAt,
      id: challengeId,
      maxAttempts: userEmailChangeMaxAttempts,
      pendingEmail: email.data,
      realmId: options.realmId,
      tokenHash: userEmailChangeTokenHashCreate(token.valueGet()),
      userId: options.userId,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(userEmailChangeRequestedEventPayloadSchema, { expiresAt })
    if (!payload.success)
      return resultErrorCreate(op, "The email-change event payload is invalid.", "users.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: challengeId,
        aggregateType: "user_email_change",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.emailChangeRequested,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      delivery: {
        challengeId,
        email: email.data,
        expiresAt,
        realmId: options.realmId,
        token: token.valueGet(),
        userId: options.userId,
        userName: user.data.userName,
      },
      response: { accepted: true, challengeId, expiresAt, retryAt: cooldownUntil },
    })
  })
  if (!committed.success) return committed
  if ("rateLimited" in committed.data)
    return resultErrorCreate(op, "Too many email-change requests.", "users.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if (committed.data.delivery !== undefined) userEmailChangeDeliveryInvoke(options.onDelivery, committed.data.delivery)
  return resultCreate(committed.data.response)
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
      "userEmailChangeResend",
      "An authenticated user is required for the account email change.",
      "users.forbidden",
    )
  return resultCreate(undefined)
}

function userEmailChangeDeliveryInvoke(
  callback: ((delivery: UserEmailChangeDelivery) => void | Promise<void>) | undefined,
  delivery: UserEmailChangeDelivery,
): void {
  try {
    if (callback !== undefined) void Promise.resolve(callback(delivery)).catch(() => undefined)
  } catch (_error) {}
}
