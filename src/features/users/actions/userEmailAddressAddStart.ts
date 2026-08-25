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
import { userEmailAddressAddedEventPayloadSchema } from "../events/userEmailAddressAddedEventPayloadSchema.js"
import { userEmailAddressVerificationRequestedEventPayloadSchema } from "../events/userEmailAddressVerificationRequestedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userEmailChangeRepositoryCreate } from "../persistence/userEmailChangeRepositoryCreate.js"
import { userEmailRepositoryCreate } from "../persistence/userEmailRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { UserEmailAddressAddStartRequest } from "../public/userEmailAddressAddStartRequestSchema.js"
import { userEmailAddressAddStartRequestSchema } from "../public/userEmailAddressAddStartRequestSchema.js"
import type { UserEmailAddressAddStartResponse } from "../public/userEmailAddressAddStartResponseSchema.js"
import type { UserEmailAddressVerificationDelivery } from "../public/userEmailAddressVerificationDeliverySchema.js"

const userEmailAddressVerificationCooldownMs = 60 * 1_000
const userEmailAddressVerificationExpiryMs = 10 * 60 * 1_000
const userEmailAddressVerificationMaxAttempts = 5

type UserEmailAddressAddStartOptions = {
  readonly clientIp?: string
  readonly context: RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: UserEmailAddressAddStartRequest
  readonly onDelivery?: (delivery: UserEmailAddressVerificationDelivery) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly session?: Session
  readonly userId: string
}

type UserEmailAddressAddStartCommit = {
  readonly delivery?: UserEmailAddressVerificationDelivery
  readonly response: UserEmailAddressAddStartResponse
}

export function userEmailAddressAddStart(
  options: UserEmailAddressAddStartOptions,
): Result<UserEmailAddressAddStartResponse> {
  const op = "userEmailAddressAddStart"
  const context = userEmailAddressContextValidate(options.context, options.realmId, options.userId)
  if (!context.success) return context
  const parsed = v.safeParse(userEmailAddressAddStartRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The email address request is invalid.", "users.invalid")
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
  const emailId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    userEmailAddressAddStartTransaction({
      challengeId,
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      email: email.data,
      emailId,
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
  userEmailAddressAddDeliveryInvoke(options.onDelivery, committed.data.delivery)
  return resultCreate(committed.data.response)
}

type UserEmailAddressAddStartTransactionOptions = {
  readonly challengeId: string
  readonly clientIp: string
  readonly context: RealmTenantContext
  readonly correlationId: string
  readonly database: Parameters<typeof userEmailChangeRepositoryCreate>[0]
  readonly email: string
  readonly emailId: string
  readonly now: number
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
  readonly userId: string
}

function userEmailAddressAddStartTransaction(
  options: UserEmailAddressAddStartTransactionOptions,
): Result<UserEmailAddressAddStartCommit | { readonly rateLimited: true; readonly retryAt: number }> {
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
    return resultErrorCreate("userEmailAddressAddStart", "The authenticated user is not available.", "users.not-found")

  const emails = userEmailRepositoryCreate(options.database)
  const existing = emails.userEmailGetByAddress(options.realmId, options.email)
  if (!existing.success) return existing
  if (existing.data !== null && existing.data.userId !== options.userId)
    return resultErrorCreate(
      "userEmailAddressAddStart",
      "The email address is already used by another account.",
      "users.conflict",
    )
  if (existing.data !== null && existing.data.verifiedAt !== null)
    return resultErrorCreate(
      "userEmailAddressAddStart",
      "The account already has this email address.",
      "users.conflict",
    )

  const challenges = userEmailChangeRepositoryCreate(options.database)
  const latest = challenges.userEmailChangeChallengeLatestGet(
    options.realmId,
    options.userId,
    options.email,
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

  const email =
    existing.data === null
      ? emails.userEmailCreate({
          createdAt: options.now,
          email: options.email,
          id: options.emailId,
          isPrimary: false,
          realmId: options.realmId,
          updatedAt: options.now,
          userId: options.userId,
          verifiedAt: null,
          version: 1,
        })
      : resultCreate(existing.data)
  if (!email.success) return email

  const previous = challenges.userEmailChangeChallengeExpireForEmail(
    options.realmId,
    options.userId,
    options.email,
    options.now,
    "email_address",
  )
  if (!previous.success) return previous
  const expiresAt = options.now + userEmailAddressVerificationExpiryMs
  const cooldownUntil = options.now + userEmailAddressVerificationCooldownMs
  const challenge = challenges.userEmailChangeChallengeCreate({
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
  if (!challenge.success) return challenge

  let commandIndex = 0
  if (existing.data === null) {
    const addedPayload = v.safeParse(userEmailAddressAddedEventPayloadSchema, { added: true })
    if (!addedPayload.success)
      return resultErrorCreate(
        "userEmailAddressAddStart",
        "The email address event payload is invalid.",
        "users.event-invalid",
      )
    const added = storageEventAppend(
      options.database,
      {
        actorId: options.context.actorId,
        aggregateId: email.data.id,
        aggregateType: "user_email_address",
        aggregateVersion: email.data.version,
        commandIndex: commandIndex++,
        correlationId: options.correlationId,
        eventType: userEventTypes.emailAddressAdded,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: options.now,
        payload: addedPayload.output,
      },
      options.runtime,
    )
    if (!added.success) return added
  }
  const requestedPayload = v.safeParse(userEmailAddressVerificationRequestedEventPayloadSchema, { expiresAt })
  if (!requestedPayload.success)
    return resultErrorCreate(
      "userEmailAddressAddStart",
      "The email verification event payload is invalid.",
      "users.event-invalid",
    )
  const requested = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.challengeId,
      aggregateType: "user_email_address_verification",
      aggregateVersion: challenge.data.version,
      commandIndex,
      correlationId: options.correlationId,
      eventType: userEventTypes.emailAddressVerificationRequested,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "users" },
      occurredAt: options.now,
      payload: requestedPayload.output,
    },
    options.runtime,
  )
  if (!requested.success) return requested
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
