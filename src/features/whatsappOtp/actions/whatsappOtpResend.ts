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
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userLookupCreate } from "../../users/server/userLookupCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpCodeCreate } from "../domain/whatsappOtpCodeCreate.js"
import { whatsappOtpCodeHashCreate } from "../domain/whatsappOtpCodeHashCreate.js"
import type { WhatsappOtpDeliveryPort } from "../domain/whatsappOtpDeliveryPort.js"
import { whatsappOtpEventTypes } from "../events/whatsappOtpEventTypes.js"
import { whatsappOtpRequestedEventPayloadSchema } from "../events/whatsappOtpRequestedEventPayloadSchema.js"
import { whatsappOtpRepositoryCreate } from "../persistence/whatsappOtpRepositoryCreate.js"
import type { WhatsappOtpDelivery } from "../public/whatsappOtpDeliverySchema.js"
import type { WhatsappOtpResendRequest } from "../public/whatsappOtpResendRequestSchema.js"
import { whatsappOtpResendRequestSchema } from "../public/whatsappOtpResendRequestSchema.js"
import type { WhatsappOtpResendResponse } from "../public/whatsappOtpResendResponseSchema.js"
import type { WhatsappOtpSecurityNotification } from "../public/whatsappOtpSecurityNotificationSchema.js"
import { whatsappOtpRateLimitConsume } from "./whatsappOtpRateLimitConsume.js"

const whatsappOtpCooldownMs = 60 * 1_000
const whatsappOtpExpiryMs = 10 * 60 * 1_000
const whatsappOtpMaxAttempts = 5

type WhatsappOtpResendOptions = {
  readonly clientIp?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly availability: WhatsappOtpAvailabilityPort
  readonly delivery?: WhatsappOtpDeliveryPort
  readonly input: WhatsappOtpResendRequest
  readonly onDelivery?: (delivery: WhatsappOtpDelivery) => void | Promise<void>
  readonly onSecurityNotification?: (notification: WhatsappOtpSecurityNotification) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

type WhatsappOtpResendCommit =
  | { readonly rateLimited: true; readonly retryAt: number }
  | { readonly policyDenied: true; readonly rateLimited?: false }
  | {
      readonly policyDenied?: false
      readonly rateLimited?: false
      readonly response: WhatsappOtpResendResponse
      readonly delivery?: WhatsappOtpDelivery
      readonly notification?: WhatsappOtpSecurityNotification
    }

export function whatsappOtpResend(options: WhatsappOtpResendOptions): Result<WhatsappOtpResendResponse> {
  const op = "whatsappOtpResend"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "whatsapp-otp.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The WhatsApp OTP is not available in this tenant context.", "whatsapp-otp.not-found")
  const parsed = v.safeParse(whatsappOtpResendRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The WhatsApp OTP request is invalid.", "whatsapp-otp.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The WhatsApp OTP timestamp is invalid.", "whatsapp-otp.invalid")
  if (parsed.output.organizationId !== undefined) {
    const policy = organizationLoginPolicyEnforce({
      database: options.database,
      method: "whatsapp_otp",
      organizationId: parsed.output.organizationId,
      realmId: options.realmId,
    })
    if (!policy.success)
      return resultErrorCreate(
        op,
        "The WhatsApp OTP login method is disabled for this organization.",
        "whatsapp-otp.conflict",
      )
  }
  if (options.availability === undefined)
    return resultErrorCreate(op, "The WhatsApp OTP is currently unavailable.", "whatsapp-otp.unavailable")
  const availability = options.availability.whatsappOtpAvailabilityGet({
    organizationId: parsed.output.organizationId,
    realmId: options.realmId,
  })
  if (!availability.success || !availability.data.available)
    return resultErrorCreate(op, "The WhatsApp OTP is currently unavailable.", "whatsapp-otp.unavailable")
  const challengeId = uuidv7Create(runtime)
  const code = whatsappOtpCodeCreate(runtime)
  if (!code.success) return code
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    whatsappOtpResendTransaction({
      clientIp: options.clientIp ?? "unknown",
      code: code.data,
      context: options.context,
      correlationId,
      database: transaction,
      input: parsed.output,
      newChallengeId: challengeId,
      now,
      policyDatabase: options.database,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
    }),
  )
  if (!committed.success) return committed
  if (committed.data.rateLimited)
    return resultErrorCreate(op, "Too many WhatsApp OTP requests.", "whatsapp-otp.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if ("policyDenied" in committed.data && committed.data.policyDenied)
    return resultErrorCreate(
      op,
      "The WhatsApp OTP login method is disabled for this organization.",
      "whatsapp-otp.conflict",
    )
  if (committed.data.delivery !== undefined) {
    whatsappOtpDeliveryInvoke(options.onDelivery, committed.data.delivery)
    whatsappOtpPortInvoke(options.delivery, committed.data.delivery)
  }
  if (committed.data.notification !== undefined)
    whatsappOtpNotificationInvoke(options.onSecurityNotification, committed.data.notification)
  return resultCreate(committed.data.response)
}

type WhatsappOtpResendTransactionOptions = {
  readonly clientIp: string
  readonly code: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly input: WhatsappOtpResendRequest
  readonly newChallengeId: string
  readonly now: number
  readonly policyDatabase: StorageDatabase
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

function whatsappOtpResendTransaction(options: WhatsappOtpResendTransactionOptions): Result<WhatsappOtpResendCommit> {
  const generic = (): Result<WhatsappOtpResendCommit> =>
    resultCreate({
      response: {
        accepted: true,
        challengeId: options.newChallengeId,
        expiresAt: options.now + whatsappOtpExpiryMs,
        retryAt: options.now + whatsappOtpCooldownMs,
      },
    })
  const limited = whatsappOtpRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.input.challengeId,
    now: options.now,
    operation: "resend",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })

  const repository = whatsappOtpRepositoryCreate(options.database)
  const users = userLookupCreate(options.database)
  const requested = repository.whatsappOtpChallengeGet(options.realmId, options.input.challengeId)
  if (!requested.success) return requested
  if (requested.data === null || requested.data.purpose !== "sign_in") return generic()
  const loginContext = organizationLoginContextValidate({
    context: {
      ...(requested.data.organizationId === null ? {} : { organizationId: requested.data.organizationId }),
      realmId: requested.data.realmId,
    },
    executor: options.database,
    ...(options.input.organizationId === undefined ? {} : { expectedOrganizationId: options.input.organizationId }),
    expectedRealmId: options.realmId,
  })
  if (!loginContext.success) return generic()
  const organizationId = loginContext.data.organizationId
  if (options.input.organizationId !== undefined) {
    const policy = organizationLoginPolicyEnforce({
      database: options.policyDatabase,
      executor: options.database,
      method: "whatsapp_otp",
      organizationId,
      realmId: options.realmId,
    })
    if (!policy.success) return resultCreate({ policyDenied: true })
  } else {
    const realmPolicy = organizationLoginPolicyEnforce({
      database: options.policyDatabase,
      executor: options.database,
      method: "whatsapp_otp",
      realmId: options.realmId,
    })
    if (!realmPolicy.success) return generic()
  }
  if (options.input.organizationId === undefined && organizationId !== undefined) {
    const challengePolicy = organizationLoginPolicyEnforce({
      database: options.policyDatabase,
      executor: options.database,
      method: "whatsapp_otp",
      organizationId,
      realmId: options.realmId,
    })
    if (!challengePolicy.success) return generic()
  }
  const current = repository.whatsappOtpChallengeLatestGet(options.realmId, requested.data.phoneHash, "sign_in")
  if (!current.success) return current
  if (current.data === null) return generic()
  if (current.data.cooldownUntil > options.now)
    return resultCreate({
      response: {
        accepted: true,
        challengeId: current.data.id,
        expiresAt: current.data.expiresAt,
        retryAt: current.data.cooldownUntil,
      },
    })

  const previous = repository.whatsappOtpChallengeExpirePrevious(
    options.realmId,
    requested.data.phoneHash,
    "sign_in",
    options.now,
  )
  if (!previous.success) return previous
  const user = current.data.userId === null ? resultCreate(null) : users.userGet(options.realmId, current.data.userId)
  if (!user.success) return user
  const eligible =
    user.data !== null &&
    user.data.state === "active" &&
    user.data.deletedAt === null &&
    user.data.phoneNumber !== null &&
    user.data.phoneNumberVerifiedAt !== null
  const expiresAt = options.now + whatsappOtpExpiryMs
  const cooldownUntil = options.now + whatsappOtpCooldownMs
  const created = repository.whatsappOtpChallengeCreate({
    attempts: 0,
    codeHash: whatsappOtpCodeHashCreate(options.newChallengeId, eligible ? options.code : `${options.code}decoy`),
    consumedAt: null,
    cooldownUntil,
    createdAt: options.now,
    expiresAt,
    id: options.newChallengeId,
    maxAttempts: whatsappOtpMaxAttempts,
    organizationId: current.data.organizationId,
    phoneHash: requested.data.phoneHash,
    purpose: "sign_in",
    realmId: options.realmId,
    userId: eligible && user.data !== null ? user.data.id : null,
    version: 1,
  })
  if (!created.success) return created
  const payload = v.safeParse(whatsappOtpRequestedEventPayloadSchema, {
    challengeId: options.newChallengeId,
    expiresAt,
    purpose: "sign_in",
  })
  if (!payload.success)
    return resultErrorCreate("whatsappOtpResend", "The WhatsApp OTP event payload is invalid.", "whatsapp-otp.internal")
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
  if (!eligible || user.data === null || user.data.phoneNumber === null)
    return resultCreate({
      response: { accepted: true, challengeId: options.newChallengeId, expiresAt, retryAt: cooldownUntil },
    })
  return resultCreate({
    delivery: {
      challengeId: options.newChallengeId,
      code: options.code,
      expiresAt,
      phoneNumber: user.data.phoneNumber,
      purpose: "sign_in",
      realmId: options.realmId,
      userId: user.data.id,
    },
    notification: {
      challengeId: options.newChallengeId,
      kind: "requested",
      realmId: options.realmId,
      userId: user.data.id,
    },
    response: { accepted: true, challengeId: options.newChallengeId, expiresAt, retryAt: cooldownUntil },
  })
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
