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
import type { Session } from "../../sessions/public/sessionSchema.js"
import { userEmailAddressContextValidate } from "../domain/userEmailAddressContextValidate.js"
import { userEmailChangeRateLimitConsume } from "../domain/userEmailChangeRateLimitConsume.js"
import { userEmailChangeRecentAuthenticationValidate } from "../domain/userEmailChangeRecentAuthenticationValidate.js"
import { userEmailChangeTokenCreate } from "../domain/userEmailChangeTokenCreate.js"
import { userEmailChangeTokenHashCreate } from "../domain/userEmailChangeTokenHashCreate.js"
import { userEmailNormalize } from "../domain/userEmailNormalize.js"
import { userEmailAddressVerificationRequestedEventPayloadSchema } from "../events/userEmailAddressVerificationRequestedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailAddressAddResendRequest } from "../public/userEmailAddressAddResendRequestSchema.js"
import { userEmailAddressAddResendRequestSchema } from "../public/userEmailAddressAddResendRequestSchema.js"
import type { UserEmailAddressAddResendResponse } from "../public/userEmailAddressAddResendResponseSchema.js"
import type { UserEmailAddressVerificationDelivery } from "../public/userEmailAddressVerificationDeliverySchema.js"

const userEmailAddressVerificationCooldownMs = 60 * 1_000
const userEmailAddressVerificationExpiryMs = 10 * 60 * 1_000
const userEmailAddressVerificationMaxAttempts = 5

type UserEmailAddressAddResendOptions = {
  readonly clientIp?: string
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: UserEmailAddressAddResendRequest
  readonly onDelivery?: (delivery: UserEmailAddressVerificationDelivery) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

type UserEmailAddressAddResendCommit = {
  readonly delivery?: UserEmailAddressVerificationDelivery
  readonly response: UserEmailAddressAddResendResponse
}

export function userEmailAddressAddResend(
  options: UserEmailAddressAddResendOptions,
): Result<UserEmailAddressAddResendResponse> {
  const op = "userEmailAddressAddResend"
  const context = userEmailAddressContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userEmailAddressAddResendRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The email verification request is invalid.", "users.invalid")
  const email = userEmailNormalize(parsed.output.email)
  if (!email.success) return email
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email verification timestamp is invalid.", "users.invalid-timestamp")
  const recent = userEmailChangeRecentAuthenticationValidate(options.session, options.realmId, options.userId, now)
  if (!recent.success) return recent
  const token = userEmailChangeTokenCreate(runtime)
  const challengeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    userEmailAddressAddResendTransaction({
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
      requestedChallengeId: parsed.output.challengeId,
      userId: options.userId,
    }),
  )
  if (!committed.success) return committed
  if ("rateLimited" in committed.data)
    return resultErrorCreate(op, "Too many email verification requests.", "users.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  userEmailAddressAddDeliveryInvoke(options.onDelivery, committed.data.delivery)
  return resultCreate(committed.data.response)
}

type UserEmailAddressAddResendTransactionOptions = {
  readonly challengeId: string
  readonly clientIp: string
  readonly context: RealmTenantContext
  readonly correlationId: string
  readonly database: Parameters<typeof userEmailChangeRepositoryCreate>[0]
  readonly email: string
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly requestedChallengeId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
  readonly userId: string
}

function userEmailAddressAddResendTransaction(
  options: UserEmailAddressAddResendTransactionOptions,
): Result<UserEmailAddressAddResendCommit | { readonly rateLimited: true; readonly retryAt: number }> {
  const limited = userEmailChangeRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.requestedChallengeId,
    now: options.now,
    operation: "resend",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })

  const repository = userEmailChangeRepositoryCreate(options.database)
  const requested = repository.userEmailChangeChallengeGet(
    options.realmId,
    options.userId,
    options.requestedChallengeId,
    "email_address",
  )
  if (!requested.success) return requested
  if (requested.data === null || requested.data.pendingEmail !== options.email)
    return resultErrorCreate(
      "userEmailAddressAddResend",
      "The email verification challenge is invalid.",
      "users.invalid",
    )
  const latest = repository.userEmailChangeChallengeLatestGet(
    options.realmId,
    options.userId,
    options.email,
    "email_address",
  )
  if (!latest.success) return latest
  if (latest.data === null || latest.data.id !== requested.data.id)
    return resultErrorCreate(
      "userEmailAddressAddResend",
      "The email verification challenge is invalid.",
      "users.invalid",
    )

  const user = userRepositoryCreate(options.database).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
    return resultErrorCreate("userEmailAddressAddResend", "The authenticated user is not available.", "users.not-found")
  const email = userEmailRepositoryCreate(options.database).userEmailGetByUserAddress(
    options.realmId,
    options.userId,
    options.email,
  )
  if (!email.success) return email
  if (email.data === null || email.data.userId !== options.userId || email.data.verifiedAt !== null)
    return resultErrorCreate(
      "userEmailAddressAddResend",
      "The email verification challenge is invalid.",
      "users.invalid",
    )
  if (latest.data.consumedAt === null && latest.data.cooldownUntil > options.now)
    return resultCreate({
      response: {
        accepted: true,
        challengeId: latest.data.id,
        expiresAt: latest.data.expiresAt,
        retryAt: latest.data.cooldownUntil,
      },
    })

  const previous = repository.userEmailChangeChallengeExpireForEmail(
    options.realmId,
    options.userId,
    options.email,
    options.now,
    "email_address",
  )
  if (!previous.success) return previous
  const expiresAt = options.now + userEmailAddressVerificationExpiryMs
  const cooldownUntil = options.now + userEmailAddressVerificationCooldownMs
  const created = repository.userEmailChangeChallengeCreate({
    attempts: 0,
    consumedAt: null,
    cooldownUntil,
    createdAt: options.now,
    expiresAt,
    id: options.challengeId,
    maxAttempts: userEmailAddressVerificationMaxAttempts,
    pendingEmail: options.email,
    purpose: "email_address",
    realmId: options.realmId,
    tokenHash: userEmailChangeTokenHashCreate(options.token),
    userId: options.userId,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(userEmailAddressVerificationRequestedEventPayloadSchema, { expiresAt })
  if (!payload.success)
    return resultErrorCreate(
      "userEmailAddressAddResend",
      "The email verification event payload is invalid.",
      "users.event-invalid",
    )
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.challengeId,
      aggregateType: "user_email_address_verification",
      aggregateVersion: created.data.version,
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

function userEmailAddressAddDeliveryInvoke(
  callback: ((delivery: UserEmailAddressVerificationDelivery) => void | Promise<void>) | undefined,
  delivery: UserEmailAddressVerificationDelivery | undefined,
): void {
  if (callback === undefined || delivery === undefined) return
  try {
    void Promise.resolve(callback(delivery)).catch(() => undefined)
  } catch (_error) {}
}
