import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { rateLimitKeyHashCreate } from "../../../platform/rateLimit/rateLimitKeyHashCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userPhoneNumberNormalize } from "../../users/domain/userPhoneNumberNormalize.js"
import { whatsappOtpCodeCreate } from "../domain/whatsappOtpCodeCreate.js"
import { whatsappOtpCodeHashCreate } from "../domain/whatsappOtpCodeHashCreate.js"
import type { WhatsappOtpDeliveryPort } from "../domain/whatsappOtpDeliveryPort.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpPhoneHashCreate } from "../domain/whatsappOtpPhoneHashCreate.js"
import { whatsappOtpEventTypes } from "../events/whatsappOtpEventTypes.js"
import { whatsappOtpRequestedEventPayloadSchema } from "../events/whatsappOtpRequestedEventPayloadSchema.js"
import { whatsappOtpRepositoryCreate } from "../persistence/whatsappOtpRepositoryCreate.js"
import type { WhatsappOtpDelivery } from "../public/whatsappOtpDeliverySchema.js"
import type { WhatsappOtpSecurityNotification } from "../public/whatsappOtpSecurityNotificationSchema.js"
import type { WhatsappOtpStartRequest } from "../public/whatsappOtpStartRequestSchema.js"
import { whatsappOtpStartRequestSchema } from "../public/whatsappOtpStartRequestSchema.js"
import type { WhatsappOtpStartResponse } from "../public/whatsappOtpStartResponseSchema.js"
import { whatsappOtpRateLimitConsume } from "./whatsappOtpRateLimitConsume.js"

const whatsappOtpCooldownMs = 60 * 1_000
const whatsappOtpExpiryMs = 10 * 60 * 1_000
const whatsappOtpMaxAttempts = 5

type WhatsappOtpStartOptions = {
  readonly clientIp?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly delivery?: WhatsappOtpDeliveryPort
  readonly input: WhatsappOtpStartRequest
  readonly onDelivery?: (delivery: WhatsappOtpDelivery) => void | Promise<void>
  readonly onSecurityNotification?: (notification: WhatsappOtpSecurityNotification) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly availability: WhatsappOtpAvailabilityPort
}

type WhatsappOtpStartCommit = {
  readonly response: WhatsappOtpStartResponse
  readonly delivery?: WhatsappOtpDelivery
  readonly notification?: WhatsappOtpSecurityNotification
}

export function whatsappOtpStart(options: WhatsappOtpStartOptions): Result<WhatsappOtpStartResponse> {
  const op = "whatsappOtpStart"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "whatsapp-otp.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The WhatsApp OTP is not available in this tenant context.", "whatsapp-otp.not-found")
  const parsed = v.safeParse(whatsappOtpStartRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The WhatsApp OTP request is invalid.", "whatsapp-otp.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The WhatsApp OTP timestamp is invalid.", "whatsapp-otp.invalid")
  const generic = (): Result<WhatsappOtpStartResponse> =>
    resultCreate({
      accepted: true,
      challengeId: uuidv7Create(runtime),
      expiresAt: now + whatsappOtpExpiryMs,
      retryAt: now + whatsappOtpCooldownMs,
    })
  const rateLimitSecret = whatsappOtpStartRateLimitSecretGet(options.rateLimitSecret)
  const rateLimitSecretConfigured = rateLimitSecret !== undefined && rateLimitSecret.length > 0
  const phoneNumber = userPhoneNumberNormalize(parsed.output.phoneNumber)
  if (!phoneNumber.success && !rateLimitSecretConfigured) return generic()
  const identifier = phoneNumber.success
    ? resultCreate(phoneNumber.data)
    : whatsappOtpStartInvalidIdentifierTokenCreate(rateLimitSecret)
  if (!identifier.success) return identifier
  const startRateLimitConsume = (rateLimitIdentifier: string) =>
    storageTransactionRun(options.database, (transaction) =>
      whatsappOtpRateLimitConsume(transaction, {
        clientIp: options.clientIp ?? "unknown",
        identifier: rateLimitIdentifier,
        now,
        operation: "start",
        rateLimitSecret,
        realmId: options.realmId,
      }),
    )
  if (rateLimitSecretConfigured) {
    const limited = startRateLimitConsume(identifier.data)
    if (!limited.success) return limited
    if (!limited.data.allowed)
      return resultErrorCreate(op, "Too many WhatsApp OTP requests.", "whatsapp-otp.rate-limited", {
        retryAfterSeconds: Math.max(1, Math.ceil((limited.data.retryAt - now) / 1_000)),
      })
  }
  if (!phoneNumber.success) return generic()
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success || realm.data.realm.status !== "active") return generic()
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    method: "whatsapp_otp",
    organizationId: options.input.organizationId,
    realmId: options.realmId,
  })
  if (!policy.success)
    return resultErrorCreate(
      op,
      "The WhatsApp OTP login method is disabled for this organization.",
      "whatsapp-otp.conflict",
    )
  if (options.availability === undefined)
    return resultErrorCreate(op, "The WhatsApp OTP is currently unavailable.", "whatsapp-otp.unavailable")
  const availability = options.availability.whatsappOtpAvailabilityGet({
    organizationId: parsed.output.organizationId,
    realmId: options.realmId,
  })
  if (!availability.success)
    return resultErrorCreate(op, "The WhatsApp OTP is currently unavailable.", "whatsapp-otp.unavailable")
  if (!availability.data.available)
    return resultErrorCreate(op, "The WhatsApp OTP is currently unavailable.", "whatsapp-otp.unavailable")
  if (!rateLimitSecretConfigured) {
    const limited = startRateLimitConsume(identifier.data)
    if (!limited.success) return limited
    if (!limited.data.allowed)
      return resultErrorCreate(op, "Too many WhatsApp OTP requests.", "whatsapp-otp.rate-limited", {
        retryAfterSeconds: Math.max(1, Math.ceil((limited.data.retryAt - now) / 1_000)),
      })
  }
  const code = whatsappOtpCodeCreate(runtime)
  if (!code.success) return code
  const challengeId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    whatsappOtpStartTransaction({
      code: code.data,
      context: options.context,
      correlationId,
      database: transaction,
      input: parsed.output,
      challengeId,
      now,
      phoneNumber: phoneNumber.data,
      realmId: options.realmId,
      runtime,
    }),
  )
  if (!committed.success) return committed
  if (committed.data.delivery !== undefined) {
    whatsappOtpDeliveryInvoke(options.onDelivery, committed.data.delivery)
    whatsappOtpPortInvoke(options.delivery, committed.data.delivery)
  }
  if (committed.data.notification !== undefined)
    whatsappOtpNotificationInvoke(options.onSecurityNotification, committed.data.notification)
  return resultCreate(committed.data.response)
}

type WhatsappOtpStartTransactionOptions = {
  readonly challengeId: string
  readonly code: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly input: WhatsappOtpStartRequest
  readonly now: number
  readonly phoneNumber: string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

function whatsappOtpStartTransaction(options: WhatsappOtpStartTransactionOptions): Result<WhatsappOtpStartCommit> {
  const repository = whatsappOtpRepositoryCreate(options.database)
  const phoneHash = whatsappOtpPhoneHashCreate(options.phoneNumber)
  const latest = repository.whatsappOtpChallengeLatestGet(options.realmId, phoneHash, "sign_in")
  if (!latest.success) return latest
  if (latest.data !== null && latest.data.cooldownUntil > options.now)
    return resultCreate({
      response: {
        accepted: true,
        challengeId: latest.data.id,
        expiresAt: latest.data.expiresAt,
        retryAt: latest.data.cooldownUntil,
      },
    })
  const previous = repository.whatsappOtpChallengeExpirePrevious(options.realmId, phoneHash, "sign_in", options.now)
  if (!previous.success) return previous
  const user = repository.whatsappOtpUserFindByPhone(options.realmId, options.phoneNumber)
  if (!user.success) return user
  const eligibleUser =
    user.data !== null &&
    user.data.state === "active" &&
    user.data.deletedAt === null &&
    user.data.phoneNumber === options.phoneNumber &&
    user.data.phoneNumberVerifiedAt !== null
      ? user.data
      : null
  const expiresAt = options.now + whatsappOtpExpiryMs
  const cooldownUntil = options.now + whatsappOtpCooldownMs
  const created = repository.whatsappOtpChallengeCreate({
    attempts: 0,
    codeHash: whatsappOtpCodeHashCreate(
      options.challengeId,
      eligibleUser === null ? `${options.code}decoy` : options.code,
    ),
    consumedAt: null,
    cooldownUntil,
    createdAt: options.now,
    expiresAt,
    id: options.challengeId,
    maxAttempts: whatsappOtpMaxAttempts,
    organizationId: options.input.organizationId ?? null,
    phoneHash,
    purpose: "sign_in",
    realmId: options.realmId,
    userId: eligibleUser?.id ?? null,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(whatsappOtpRequestedEventPayloadSchema, {
    challengeId: options.challengeId,
    expiresAt,
    purpose: "sign_in",
  })
  if (!payload.success)
    return resultErrorCreate("whatsappOtpStart", "The WhatsApp OTP event payload is invalid.", "whatsapp-otp.internal")
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.challengeId,
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
  if (eligibleUser === null)
    return resultCreate({
      response: { accepted: true, challengeId: options.challengeId, expiresAt, retryAt: cooldownUntil },
    })
  return resultCreate({
    delivery: {
      challengeId: options.challengeId,
      code: options.code,
      expiresAt,
      phoneNumber: options.phoneNumber,
      purpose: "sign_in",
      realmId: options.realmId,
      userId: eligibleUser.id,
    },
    notification: {
      challengeId: options.challengeId,
      kind: "requested",
      realmId: options.realmId,
      userId: eligibleUser.id,
    },
    response: { accepted: true, challengeId: options.challengeId, expiresAt, retryAt: cooldownUntil },
  })
}

function whatsappOtpStartRateLimitSecretGet(rateLimitSecret?: Secret | string): string | undefined {
  return typeof rateLimitSecret === "string" ? rateLimitSecret : rateLimitSecret?.valueGet()
}

function whatsappOtpStartInvalidIdentifierTokenCreate(rateLimitSecret: string | undefined): Result<string> {
  const secret = rateLimitSecret
  if (secret === undefined || secret.length === 0)
    return resultErrorCreate(
      "whatsappOtpStart",
      "WhatsApp OTP rate limiting requires a system secret.",
      "platform.configuration-invalid",
    )
  return resultCreate(rateLimitKeyHashCreate(secret, "whatsapp-otp.start.invalid-identifier"))
}

function whatsappOtpDeliveryInvoke(
  callback: ((delivery: WhatsappOtpDelivery) => void | Promise<void>) | undefined,
  delivery: WhatsappOtpDelivery,
): void {
  if (callback === undefined) return
  try {
    void Promise.resolve(callback(delivery)).catch(() => undefined)
  } catch (_error) {}
}

function whatsappOtpNotificationInvoke(
  callback: ((notification: WhatsappOtpSecurityNotification) => void | Promise<void>) | undefined,
  notification: WhatsappOtpSecurityNotification,
): void {
  if (callback === undefined) return
  try {
    void Promise.resolve(callback(notification)).catch(() => undefined)
  } catch (_error) {}
}

function whatsappOtpPortInvoke(port: WhatsappOtpDeliveryPort | undefined, delivery: WhatsappOtpDelivery): void {
  if (port === undefined) return
  try {
    void Promise.resolve(
      port.sendText({
        phoneNumber: delivery.phoneNumber,
        text: `Your Authworks WhatsApp sign-in code is ${delivery.code}.`,
      }),
    ).catch(() => undefined)
  } catch (_error) {}
}
