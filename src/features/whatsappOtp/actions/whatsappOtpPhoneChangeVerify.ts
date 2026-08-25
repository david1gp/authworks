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
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userPhoneNumberChange } from "../../users/actions/userPhoneNumberChange.js"
import { userPhoneNumberNormalize } from "../../users/domain/userPhoneNumberNormalize.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpCodeMatches } from "../domain/whatsappOtpCodeMatches.js"
import { whatsappOtpPhoneChangePurpose } from "../domain/whatsappOtpPhoneChangePurpose.js"
import { whatsappOtpPhoneHashCreate } from "../domain/whatsappOtpPhoneHashCreate.js"
import { whatsappOtpEventTypes } from "../events/whatsappOtpEventTypes.js"
import { whatsappOtpFailedEventPayloadSchema } from "../events/whatsappOtpFailedEventPayloadSchema.js"
import { whatsappOtpVerifiedEventPayloadSchema } from "../events/whatsappOtpVerifiedEventPayloadSchema.js"
import { whatsappOtpRepositoryCreate } from "../persistence/whatsappOtpRepositoryCreate.js"
import type { WhatsappOtpPhoneChangeVerifyRequest } from "../public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import type { WhatsappOtpPhoneChangeVerifyResponse } from "../public/whatsappOtpPhoneChangeVerifyResponseSchema.js"
import type { WhatsappOtpSecurityNotification } from "../public/whatsappOtpSecurityNotificationSchema.js"
import { whatsappOtpPhoneChangeContextValidate } from "./whatsappOtpPhoneChangeContextValidate.js"
import { whatsappOtpRateLimitConsume } from "./whatsappOtpRateLimitConsume.js"

type WhatsappOtpPhoneChangeVerifyOptions = {
  readonly availability: WhatsappOtpAvailabilityPort
  readonly clientIp?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: WhatsappOtpPhoneChangeVerifyRequest
  readonly onSecurityNotification?: (notification: WhatsappOtpSecurityNotification) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

type WhatsappOtpPhoneChangeVerifyCommit =
  | { readonly failure: true; readonly notification?: WhatsappOtpSecurityNotification }
  | {
      readonly failure: false
      readonly notification: WhatsappOtpSecurityNotification
      readonly response: WhatsappOtpPhoneChangeVerifyResponse
    }
  | { readonly rateLimited: true; readonly retryAt: number }

export function whatsappOtpPhoneChangeVerify(
  options: WhatsappOtpPhoneChangeVerifyOptions,
): Result<WhatsappOtpPhoneChangeVerifyResponse> {
  const op = "whatsappOtpPhoneChangeVerify"
  const authenticated = whatsappOtpPhoneChangeContextValidate(options.context, options.realmId, options.userId)
  if (!authenticated.success)
    return resultErrorCreate(op, authenticated.errorMessage, authenticated.code ?? "whatsapp-otp.invalid")
  const parsed = v.safeParse(whatsappOtpPhoneChangeVerifyRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The account phone-change code is invalid.", "whatsapp-otp.invalid")
  const phoneNumber = userPhoneNumberNormalize(parsed.output.phoneNumber)
  if (!phoneNumber.success) return phoneNumber
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The WhatsApp OTP timestamp is invalid.", "whatsapp-otp.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The account phone change is not available in this realm.", "whatsapp-otp.not-found")
  if (options.availability === undefined)
    return resultErrorCreate(op, "The WhatsApp OTP is currently unavailable.", "whatsapp-otp.unavailable")
  const availability = options.availability.whatsappOtpAvailabilityGet({ realmId: options.realmId })
  if (!availability.success || !availability.data.available)
    return resultErrorCreate(op, "The WhatsApp OTP is currently unavailable.", "whatsapp-otp.unavailable")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    whatsappOtpPhoneChangeVerifyTransaction({
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      input: { ...parsed.output, phoneNumber: phoneNumber.data },
      now,
      originalDatabase: options.database,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
      userId: options.userId,
    }),
  )
  if (!committed.success) return committed
  const commit = committed.data
  if ("rateLimited" in commit)
    return resultErrorCreate(op, "Too many WhatsApp OTP requests.", "whatsapp-otp.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((commit.retryAt - now) / 1_000)),
    })
  if (commit.notification !== undefined)
    whatsappOtpPhoneChangeNotificationInvoke(options.onSecurityNotification, commit.notification)
  if (commit.failure) return resultErrorCreate(op, "The account phone-change code is invalid.", "whatsapp-otp.invalid")
  return resultCreate(commit.response)
}

type WhatsappOtpPhoneChangeVerifyTransactionOptions = {
  readonly clientIp: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly input: WhatsappOtpPhoneChangeVerifyRequest
  readonly now: number
  readonly originalDatabase: StorageDatabase
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

function whatsappOtpPhoneChangeVerifyTransaction(
  options: WhatsappOtpPhoneChangeVerifyTransactionOptions,
): Result<WhatsappOtpPhoneChangeVerifyCommit> {
  const limited = whatsappOtpRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.input.challengeId,
    now: options.now,
    operation: "phone_change_verify",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })
  const repository = whatsappOtpRepositoryCreate(options.database)
  const challenge = repository.whatsappOtpPhoneChangeChallengeGet(
    options.realmId,
    options.userId,
    options.input.challengeId,
  )
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    challenge.data.purpose !== whatsappOtpPhoneChangePurpose ||
    challenge.data.phoneHash !== whatsappOtpPhoneHashCreate(options.input.phoneNumber)
  )
    return resultCreate({ failure: true })
  const current = challenge.data
  if (current.consumedAt !== null || current.attempts >= current.maxAttempts) return resultCreate({ failure: true })
  if (current.expiresAt <= options.now)
    return whatsappOtpPhoneChangeExpiredRecord(options, current.id, current.version, current.attempts)
  const matched = whatsappOtpCodeMatches(current.id, options.input.code, current.codeHash)
  if (!matched) {
    const attempts = current.attempts + 1
    const updated = repository.whatsappOtpChallengeAttemptRecord({
      attempts,
      consumedAt: attempts >= current.maxAttempts ? options.now : null,
      expectedVersion: current.version,
      id: current.id,
      realmId: options.realmId,
      version: current.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultCreate({ failure: true })
    const event = whatsappOtpPhoneChangeFailedEventAppend(
      options,
      updated.data.version,
      attempts,
      attempts >= current.maxAttempts,
      "invalid_code",
    )
    if (!event.success) return event
    return resultCreate({
      failure: true,
      notification: whatsappOtpPhoneChangeNotificationCreate(
        "failed",
        options.userId,
        current.id,
        options.realmId,
        attempts,
      ),
    })
  }
  const consumed = repository.whatsappOtpChallengeConsume(options.realmId, current.id, current.version, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const changed = userPhoneNumberChange({
    context: options.context,
    correlationId: options.correlationId,
    database: options.originalDatabase,
    executor: options.database,
    input: { phoneNumber: options.input.phoneNumber },
    realmId: options.realmId,
    runtime: options.runtime,
    userId: options.userId,
  })
  if (!changed.success) return changed
  const payload = v.safeParse(whatsappOtpVerifiedEventPayloadSchema, {
    challengeId: current.id,
    userId: options.userId,
  })
  if (!payload.success)
    return resultErrorCreate(
      "whatsappOtpPhoneChangeVerify",
      "The WhatsApp OTP event payload is invalid.",
      "whatsapp-otp.internal",
    )
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: current.id,
      aggregateType: "whatsapp_otp",
      aggregateVersion: consumed.data.version,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: whatsappOtpEventTypes.verified,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "whatsapp_otp" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({
    failure: false,
    notification: whatsappOtpPhoneChangeNotificationCreate("verified", options.userId, current.id, options.realmId),
    response: changed.data,
  })
}

function whatsappOtpPhoneChangeExpiredRecord(
  options: WhatsappOtpPhoneChangeVerifyTransactionOptions,
  challengeId: string,
  expectedVersion: number,
  attempts: number,
): Result<WhatsappOtpPhoneChangeVerifyCommit> {
  const repository = whatsappOtpRepositoryCreate(options.database)
  const consumed = repository.whatsappOtpChallengeConsume(options.realmId, challengeId, expectedVersion, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const event = whatsappOtpPhoneChangeFailedEventAppend(options, consumed.data.version, attempts, false, "expired")
  if (!event.success) return event
  return resultCreate({
    failure: true,
    notification: whatsappOtpPhoneChangeNotificationCreate(
      "failed",
      options.userId,
      challengeId,
      options.realmId,
      attempts,
    ),
  })
}

function whatsappOtpPhoneChangeFailedEventAppend(
  options: WhatsappOtpPhoneChangeVerifyTransactionOptions,
  aggregateVersion: number,
  attempts: number,
  exhausted: boolean,
  reason: "expired" | "invalid_code",
) {
  const payload = v.safeParse(whatsappOtpFailedEventPayloadSchema, { attempts, exhausted, reason })
  if (!payload.success)
    return resultErrorCreate(
      "whatsappOtpPhoneChangeVerify",
      "The WhatsApp OTP event payload is invalid.",
      "whatsapp-otp.internal",
    )
  return storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.input.challengeId,
      aggregateType: "whatsapp_otp",
      aggregateVersion,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: whatsappOtpEventTypes.failed,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "whatsapp_otp" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
}

function whatsappOtpPhoneChangeNotificationCreate(
  kind: "failed" | "verified",
  userId: string,
  challengeId: string,
  realmId: string,
  attempts?: number,
): WhatsappOtpSecurityNotification {
  return {
    ...(attempts === undefined ? {} : { attempts }),
    challengeId,
    kind,
    realmId,
    userId,
  }
}

function whatsappOtpPhoneChangeNotificationInvoke(
  callback: ((notification: WhatsappOtpSecurityNotification) => void | Promise<void>) | undefined,
  notification: WhatsappOtpSecurityNotification,
): void {
  if (callback === undefined) return
  try {
    void Promise.resolve(callback(notification)).catch(() => undefined)
  } catch (_error) {}
}
