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
import { mfaPrimaryAuthenticationComplete } from "../../mfa/actions/mfaPrimaryAuthenticationComplete.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { userLookupCreate } from "../../users/server/userLookupCreate.js"
import type { WhatsappOtpAvailabilityPort } from "../domain/whatsappOtpAvailabilityPort.js"
import { whatsappOtpCodeMatches } from "../domain/whatsappOtpCodeMatches.js"
import { whatsappOtpPhoneHashCreate } from "../domain/whatsappOtpPhoneHashCreate.js"
import { whatsappOtpEventTypes } from "../events/whatsappOtpEventTypes.js"
import { whatsappOtpFailedEventPayloadSchema } from "../events/whatsappOtpFailedEventPayloadSchema.js"
import { whatsappOtpVerifiedEventPayloadSchema } from "../events/whatsappOtpVerifiedEventPayloadSchema.js"
import { whatsappOtpRepositoryCreate } from "../persistence/whatsappOtpRepositoryCreate.js"
import type { WhatsappOtpSecurityNotification } from "../public/whatsappOtpSecurityNotificationSchema.js"
import type { WhatsappOtpVerifyRequest } from "../public/whatsappOtpVerifyRequestSchema.js"
import { whatsappOtpVerifyRequestSchema } from "../public/whatsappOtpVerifyRequestSchema.js"
import type { WhatsappOtpVerifyResponse } from "../public/whatsappOtpVerifyResponseSchema.js"
import { whatsappOtpRateLimitConsume } from "./whatsappOtpRateLimitConsume.js"

type WhatsappOtpVerifyOptions = {
  readonly clientIp?: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly availability: WhatsappOtpAvailabilityPort
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly input: WhatsappOtpVerifyRequest
  readonly onSecurityNotification?: (notification: WhatsappOtpSecurityNotification) => void | Promise<void>
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

type WhatsappOtpVerifyCommit =
  | { readonly failure?: false; readonly policyDenied?: false; readonly rateLimited: true; readonly retryAt: number }
  | { readonly failure?: false; readonly policyDenied: true; readonly rateLimited?: false }
  | {
      readonly failure: true
      readonly policyDenied?: false
      readonly rateLimited?: false
      readonly notification?: WhatsappOtpSecurityNotification
    }
  | {
      readonly failure: false
      readonly policyDenied?: false
      readonly rateLimited?: false
      readonly response: WhatsappOtpVerifyResponse
      readonly notification: WhatsappOtpSecurityNotification
    }

export function whatsappOtpVerify(options: WhatsappOtpVerifyOptions): Result<WhatsappOtpVerifyResponse> {
  const op = "whatsappOtpVerify"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "whatsapp-otp.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The WhatsApp OTP is not available in this tenant context.", "whatsapp-otp.not-found")
  const parsed = v.safeParse(whatsappOtpVerifyRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The WhatsApp OTP code is invalid.", "whatsapp-otp.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The WhatsApp OTP timestamp is invalid.", "whatsapp-otp.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The WhatsApp OTP code is invalid.", "whatsapp-otp.invalid")
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
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    whatsappOtpVerifyTransaction({
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      deviceMetadata: options.deviceMetadata,
      input: parsed.output,
      now,
      policyDatabase: options.database,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      runtime,
    }),
  )
  if (!committed.success) return committed
  if (committed.data.rateLimited === true)
    return resultErrorCreate(op, "Too many WhatsApp OTP requests.", "whatsapp-otp.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if (committed.data.policyDenied === true)
    return resultErrorCreate(
      op,
      "The WhatsApp OTP login method is disabled for this organization.",
      "whatsapp-otp.conflict",
    )
  if (committed.data.notification !== undefined)
    whatsappOtpNotificationInvoke(options.onSecurityNotification, committed.data.notification)
  if (committed.data.failure) return resultErrorCreate(op, "The WhatsApp OTP code is invalid.", "whatsapp-otp.invalid")
  return resultCreate(committed.data.response)
}

type WhatsappOtpVerifyTransactionOptions = {
  readonly clientIp: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly input: WhatsappOtpVerifyRequest
  readonly now: number
  readonly policyDatabase: StorageDatabase
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

function whatsappOtpVerifyTransaction(options: WhatsappOtpVerifyTransactionOptions): Result<WhatsappOtpVerifyCommit> {
  const limited = whatsappOtpRateLimitConsume(options.database, {
    clientIp: options.clientIp,
    identifier: options.input.challengeId,
    now: options.now,
    operation: "verify",
    rateLimitSecret: options.rateLimitSecret,
    realmId: options.realmId,
  })
  if (!limited.success) return limited
  if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })

  const repository = whatsappOtpRepositoryCreate(options.database)
  const users = userLookupCreate(options.database)
  const challenge = repository.whatsappOtpChallengeGet(options.realmId, options.input.challengeId)
  if (!challenge.success) return challenge
  if (options.input.organizationId !== undefined) {
    const policy = organizationLoginPolicyEnforce({
      database: options.policyDatabase,
      executor: options.database,
      method: "whatsapp_otp",
      organizationId: options.input.organizationId,
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
    if (!realmPolicy.success) return resultCreate({ failure: true })
  }
  if (
    challenge.data === null ||
    challenge.data.purpose !== "sign_in" ||
    (options.input.organizationId !== undefined && options.input.organizationId !== challenge.data.organizationId)
  )
    return resultCreate({ failure: true })
  if (options.input.organizationId === undefined && challenge.data.organizationId !== null) {
    const challengePolicy = organizationLoginPolicyEnforce({
      database: options.policyDatabase,
      executor: options.database,
      method: "whatsapp_otp",
      organizationId: challenge.data.organizationId,
      realmId: options.realmId,
    })
    if (!challengePolicy.success) return resultCreate({ failure: true })
  }
  const current = challenge.data
  if (current.consumedAt !== null) return resultCreate({ failure: true })
  if (current.expiresAt <= options.now)
    return whatsappOtpExpiredRecord(
      options,
      current.id,
      current.realmId,
      current.version,
      current.attempts,
      current.userId,
    )
  if (current.attempts >= current.maxAttempts) return resultCreate({ failure: true })
  const matched = whatsappOtpCodeMatches(current.id, options.input.code, current.codeHash)
  if (!matched) {
    const attempts = current.attempts + 1
    const exhausted = attempts >= current.maxAttempts
    const updated = repository.whatsappOtpChallengeAttemptRecord({
      attempts,
      consumedAt: exhausted ? options.now : null,
      expectedVersion: current.version,
      id: current.id,
      realmId: options.realmId,
      version: current.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultCreate({ failure: true })
    const event = whatsappOtpFailedEventAppend(options, updated.data.version, attempts, exhausted, "invalid_code")
    if (!event.success) return event
    return resultCreate({
      failure: true,
      notification:
        current.userId === null
          ? undefined
          : whatsappOtpNotificationCreate("failed", current.userId, current.id, options.realmId, attempts),
    })
  }
  if (current.userId === null) return resultCreate({ failure: true })
  const userId = current.userId
  const user = users.userGet(options.realmId, userId)
  if (!user.success) return user
  const eligible =
    user.data !== null &&
    user.data.state === "active" &&
    user.data.deletedAt === null &&
    user.data.phoneNumber !== null &&
    user.data.phoneNumberVerifiedAt !== null &&
    whatsappOtpPhoneHashCreate(user.data.phoneNumber) === current.phoneHash
  if (!eligible) {
    const consumed = repository.whatsappOtpChallengeConsume(options.realmId, current.id, current.version, options.now)
    if (!consumed.success) return consumed
    if (consumed.data === null) return resultCreate({ failure: true })
    const event = whatsappOtpFailedEventAppend(
      options,
      consumed.data.version,
      consumed.data.attempts,
      true,
      "authorization_failed",
    )
    if (!event.success) return event
    return resultCreate({
      failure: true,
      notification: whatsappOtpNotificationCreate("failed", userId, current.id, options.realmId, current.attempts),
    })
  }
  const consumed = repository.whatsappOtpChallengeConsume(options.realmId, current.id, current.version, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const payload = v.safeParse(whatsappOtpVerifiedEventPayloadSchema, { challengeId: current.id, userId })
  if (!payload.success)
    return resultErrorCreate("whatsappOtpVerify", "The WhatsApp OTP event payload is invalid.", "whatsapp-otp.internal")
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: current.id,
      aggregateType: "whatsapp_otp",
      aggregateVersion: consumed.data.version,
      commandIndex: 0,
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
  const authentication = { authenticatedAt: options.now, realmId: options.realmId, userId }
  const authenticationResult = mfaPrimaryAuthenticationComplete({
    actorId: options.context.actorId,
    deviceMetadata: options.deviceMetadata,
    executor: options.database,
    organizationId: current.organizationId ?? undefined,
    primaryAuthenticationMethod: "whatsapp_otp",
    realmId: options.realmId,
    runtime: options.runtime,
    sessionCreate: () =>
      sessionIssue({
        actorId: options.context.actorId,
        assurance: "authenticated",
        authenticationMethod: "whatsapp_otp",
        commandIndex: 1,
        correlationId: options.correlationId,
        database: options.policyDatabase,
        deviceMetadata: options.deviceMetadata,
        executor: options.database,
        organizationId: current.organizationId ?? undefined,
        realmId: options.realmId,
        runtime: options.runtime,
        userId,
      }),
    userId,
  })
  if (!authenticationResult.success)
    return resultErrorCreate(
      "whatsappOtpVerify",
      "The authenticated session could not be created.",
      "whatsapp-otp.internal",
    )
  return resultCreate({
    failure: false,
    notification: whatsappOtpNotificationCreate("verified", userId, current.id, options.realmId),
    response: { authentication, ...authenticationResult.data },
  })
}

function whatsappOtpExpiredRecord(
  options: WhatsappOtpVerifyTransactionOptions,
  challengeId: string,
  realmId: string,
  expectedVersion: number,
  attempts: number,
  userId: string | null,
): Result<WhatsappOtpVerifyCommit> {
  const repository = whatsappOtpRepositoryCreate(options.database)
  const consumed = repository.whatsappOtpChallengeConsume(realmId, challengeId, expectedVersion, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null) return resultCreate({ failure: true })
  const event = whatsappOtpFailedEventAppend(options, consumed.data.version, attempts, false, "expired")
  if (!event.success) return event
  return resultCreate({
    failure: true,
    notification:
      userId === null ? undefined : whatsappOtpNotificationCreate("failed", userId, challengeId, realmId, attempts),
  })
}

function whatsappOtpFailedEventAppend(
  options: WhatsappOtpVerifyTransactionOptions,
  aggregateVersion: number,
  attempts: number,
  exhausted: boolean,
  reason: "authorization_failed" | "expired" | "invalid_code",
) {
  const payload = v.safeParse(whatsappOtpFailedEventPayloadSchema, { attempts, exhausted, reason })
  if (!payload.success)
    return resultErrorCreate("whatsappOtpVerify", "The WhatsApp OTP event payload is invalid.", "whatsapp-otp.internal")
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

function whatsappOtpNotificationCreate(
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

function whatsappOtpNotificationInvoke(
  callback: ((notification: WhatsappOtpSecurityNotification) => void | Promise<void>) | undefined,
  notification: WhatsappOtpSecurityNotification,
): void {
  if (callback === undefined) return
  try {
    void Promise.resolve(callback(notification)).catch(() => undefined)
  } catch (_error) {}
}
