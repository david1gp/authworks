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
import { userPhoneNumberNormalize } from "../../users/domain/userPhoneNumberNormalize.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpCodeCreate } from "../domain/whatsappOtpCodeCreate.js"
import { whatsappOtpCodeHashCreate } from "../domain/whatsappOtpCodeHashCreate.js"
import type { WhatsappOtpDeliveryPort } from "../domain/whatsappOtpDeliveryPort.js"
import { whatsappOtpPhoneChangePurpose } from "../domain/whatsappOtpPhoneChangePurpose.js"
import { whatsappOtpPhoneHashCreate } from "../domain/whatsappOtpPhoneHashCreate.js"
import { whatsappOtpEventTypes } from "../events/whatsappOtpEventTypes.js"
import { whatsappOtpRequestedEventPayloadSchema } from "../events/whatsappOtpRequestedEventPayloadSchema.js"
import { whatsappOtpRepositoryCreate } from "../persistence/whatsappOtpRepositoryCreate.js"
import type { WhatsappOtpDelivery } from "../public/whatsappOtpDeliverySchema.js"
import type { WhatsappOtpPhoneChangeResendRequest } from "../public/whatsappOtpPhoneChangeResendRequestSchema.js"
import { whatsappOtpPhoneChangeResendRequestSchema } from "../public/whatsappOtpPhoneChangeResendRequestSchema.js"
import type { WhatsappOtpPhoneChangeResendResponse } from "../public/whatsappOtpPhoneChangeResendResponseSchema.js"
import type { WhatsappOtpSecurityNotification } from "../public/whatsappOtpSecurityNotificationSchema.js"
import { whatsappOtpPhoneChangeContextValidate } from "./whatsappOtpPhoneChangeContextValidate.js"
import { whatsappOtpRateLimitConsume } from "./whatsappOtpRateLimitConsume.js"

const whatsappOtpPhoneChangeCooldownMs = 60 * 1_000
const whatsappOtpPhoneChangeExpiryMs = 10 * 60 * 1_000
const whatsappOtpPhoneChangeMaxAttempts = 5

type WhatsappOtpPhoneChangeResendOptions = {
  readonly availability: WhatsappOtpAvailabilityPort
  readonly clientIp?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly delivery?: WhatsappOtpDeliveryPort
  readonly input: WhatsappOtpPhoneChangeResendRequest
  readonly onDelivery?: (delivery: WhatsappOtpDelivery) => void | Promise<void>
  readonly onSecurityNotification?: (notification: WhatsappOtpSecurityNotification) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

type WhatsappOtpPhoneChangeResendCommit = {
  readonly delivery?: WhatsappOtpDelivery
  readonly notification?: WhatsappOtpSecurityNotification
  readonly response: WhatsappOtpPhoneChangeResendResponse
}

export function whatsappOtpPhoneChangeResend(
  options: WhatsappOtpPhoneChangeResendOptions,
): Result<WhatsappOtpPhoneChangeResendResponse> {
  const op = "whatsappOtpPhoneChangeResend"
  const authenticated = whatsappOtpPhoneChangeContextValidate(options.context, options.realmId, options.userId)
  if (!authenticated.success)
    return resultErrorCreate(op, authenticated.errorMessage, authenticated.code ?? "whatsapp-otp.invalid")
  const parsed = v.safeParse(whatsappOtpPhoneChangeResendRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCreate(op, "The account phone-change request is invalid.", "whatsapp-otp.invalid")
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
  const code = whatsappOtpCodeCreate(runtime)
  if (!code.success) return code
  const newChallengeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    whatsappOtpPhoneChangeResendTransaction({
      challengeId: parsed.output.challengeId,
      clientIp: options.clientIp ?? "unknown",
      code: code.data,
      context: options.context,
      correlationId,
      database: transaction,
      newChallengeId,
      now,
      phoneNumber: phoneNumber.data,
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
  if (commit.delivery !== undefined) {
    whatsappOtpPhoneChangeDeliveryInvoke(options.onDelivery, commit.delivery)
    whatsappOtpPhoneChangePortInvoke(options.delivery, commit.delivery)
  }
  if (commit.notification !== undefined)
    whatsappOtpPhoneChangeNotificationInvoke(options.onSecurityNotification, commit.notification)
  return resultCreate(commit.response)
}

type WhatsappOtpPhoneChangeResendTransactionOptions = {
  readonly challengeId: string
  readonly clientIp: string
  readonly code: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly newChallengeId: string
  readonly now: number
  readonly phoneNumber: string
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

function whatsappOtpPhoneChangeResendTransaction(
  options: WhatsappOtpPhoneChangeResendTransactionOptions,
): Result<WhatsappOtpPhoneChangeResendCommit | { readonly rateLimited: true; readonly retryAt: number }> {
  const limited = whatsappOtpRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.challengeId,
    now: options.now,
    operation: "phone_change_resend",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })

  const repository = whatsappOtpRepositoryCreate(options.database)
  const requested = repository.whatsappOtpPhoneChangeChallengeGet(options.realmId, options.userId, options.challengeId)
  if (!requested.success) return requested
  const phoneHash = whatsappOtpPhoneHashCreate(options.phoneNumber)
  if (requested.data === null || requested.data.phoneHash !== phoneHash)
    return resultErrorCreate(
      "whatsappOtpPhoneChangeResend",
      "The account phone-change challenge is invalid.",
      "whatsapp-otp.invalid",
    )
  const current = repository.whatsappOtpPhoneChangeChallengeLatestGet(options.realmId, options.userId, phoneHash)
  if (!current.success) return current
  if (current.data === null)
    return resultErrorCreate(
      "whatsappOtpPhoneChangeResend",
      "The account phone-change challenge is invalid.",
      "whatsapp-otp.invalid",
    )
  if (current.data.cooldownUntil > options.now)
    return resultCreate({
      response: {
        accepted: true,
        challengeId: current.data.id,
        expiresAt: current.data.expiresAt,
        retryAt: current.data.cooldownUntil,
      },
    })
  const user = repository.whatsappOtpUserGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
    return resultErrorCreate(
      "whatsappOtpPhoneChangeResend",
      "The authenticated user is not available.",
      "whatsapp-otp.not-found",
    )
  const previous = repository.whatsappOtpPhoneChangeChallengeExpirePrevious(
    options.realmId,
    options.userId,
    options.now,
  )
  if (!previous.success) return previous
  const expiresAt = options.now + whatsappOtpPhoneChangeExpiryMs
  const cooldownUntil = options.now + whatsappOtpPhoneChangeCooldownMs
  const created = repository.whatsappOtpPhoneChangeChallengeCreate({
    attempts: 0,
    codeHash: whatsappOtpCodeHashCreate(options.newChallengeId, options.code),
    consumedAt: null,
    cooldownUntil,
    createdAt: options.now,
    expiresAt,
    id: options.newChallengeId,
    maxAttempts: whatsappOtpPhoneChangeMaxAttempts,
    phoneHash,
    realmId: options.realmId,
    userId: options.userId,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(whatsappOtpRequestedEventPayloadSchema, {
    challengeId: options.newChallengeId,
    expiresAt,
    purpose: whatsappOtpPhoneChangePurpose,
  })
  if (!payload.success)
    return resultErrorCreate(
      "whatsappOtpPhoneChangeResend",
      "The WhatsApp OTP event payload is invalid.",
      "whatsapp-otp.internal",
    )
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.newChallengeId,
      aggregateType: "whatsapp_otp",
      aggregateVersion: 1,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: whatsappOtpEventTypes.requested,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "whatsapp_otp" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({
    delivery: {
      challengeId: options.newChallengeId,
      code: options.code,
      expiresAt,
      phoneNumber: options.phoneNumber,
      purpose: whatsappOtpPhoneChangePurpose,
      realmId: options.realmId,
      userId: options.userId,
    },
    notification: {
      challengeId: options.newChallengeId,
      kind: "requested",
      realmId: options.realmId,
      userId: options.userId,
    },
    response: { accepted: true, challengeId: options.newChallengeId, expiresAt, retryAt: cooldownUntil },
  })
}

function whatsappOtpPhoneChangeDeliveryInvoke(
  callback: ((delivery: WhatsappOtpDelivery) => void | Promise<void>) | undefined,
  delivery: WhatsappOtpDelivery,
): void {
  if (callback === undefined) return
  try {
    void Promise.resolve(callback(delivery)).catch(() => undefined)
  } catch (_error) {}
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

function whatsappOtpPhoneChangePortInvoke(
  port: WhatsappOtpDeliveryPort | undefined,
  delivery: WhatsappOtpDelivery,
): void {
  if (port === undefined) return
  try {
    void Promise.resolve(
      port.sendText({
        phoneNumber: delivery.phoneNumber,
        text: `Your Authworks WhatsApp account phone-change code is ${delivery.code}.`,
      }),
    ).catch(() => undefined)
  } catch (_error) {}
}
