import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
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
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { emailOtpCodeMatches } from "../domain/emailOtpCodeMatches.js"
import { emailOtpEmailHashCreate } from "../domain/emailOtpEmailHashCreate.js"
import { emailOtpEventTypes } from "../events/emailOtpEventTypes.js"
import { emailOtpFailedEventPayloadSchema } from "../events/emailOtpFailedEventPayloadSchema.js"
import { emailOtpVerifiedEventPayloadSchema } from "../events/emailOtpVerifiedEventPayloadSchema.js"
import { emailOtpRepositoryCreate } from "../persistence/emailOtpRepositoryCreate.js"
import type { EmailOtpSecurityNotification } from "../public/emailOtpSecurityNotificationSchema.js"
import type { EmailOtpVerifyRequest } from "../public/emailOtpVerifyRequestSchema.js"
import { emailOtpVerifyRequestSchema } from "../public/emailOtpVerifyRequestSchema.js"
import type { EmailOtpVerifyResponse } from "../public/emailOtpVerifyResponseSchema.js"

type EmailOtpVerifyOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: EmailOtpVerifyRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly onSecurityNotification?: (notification: EmailOtpSecurityNotification) => void | Promise<void>
}

type EmailOtpVerifyCommit =
  | { readonly failure: true; readonly errorMessage: string; readonly notification?: EmailOtpSecurityNotification }
  | {
      readonly failure: false
      readonly response: EmailOtpVerifyResponse
      readonly notification: EmailOtpSecurityNotification
    }

export function emailOtpVerify(options: EmailOtpVerifyOptions): Result<EmailOtpVerifyResponse> {
  const op = "emailOtpVerify"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "email-otp.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The email OTP is not available in this tenant context.", "email-otp.not-found")
  const parsed = v.safeParse(emailOtpVerifyRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The email OTP code is invalid.", "email-otp.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The email OTP timestamp is invalid.", "email-otp.invalid")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The email OTP code is invalid.", "email-otp.invalid")
  const challenge = emailOtpRepositoryCreate(options.database.db).emailOtpChallengeGet(
    options.realmId,
    parsed.output.challengeId,
  )
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    (parsed.output.organizationId !== undefined && parsed.output.organizationId !== challenge.data.organizationId)
  )
    return resultErrorCreate(op, "The email OTP code is invalid.", "email-otp.invalid")
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    realmId: options.realmId,
    method: "email_otp",
    organizationId: challenge.data.organizationId ?? undefined,
  })
  if (!policy.success)
    return resultErrorCreate(op, "The email OTP login method is disabled for this organization.", "email-otp.conflict")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    emailOtpVerifyTransaction({
      context: options.context,
      correlationId,
      database: transaction,
      deviceMetadata: options.deviceMetadata,
      input: parsed.output,
      realmId: options.realmId,
      now,
      runtime,
    }),
  )
  if (!committed.success) return committed
  if (committed.data.notification !== undefined)
    emailOtpPortInvoke(options.onSecurityNotification, committed.data.notification)
  if (committed.data.failure) return resultErrorCreate(op, committed.data.errorMessage, "email-otp.invalid")
  return resultCreate(committed.data.response)
}

type EmailOtpVerifyTransactionOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly input: EmailOtpVerifyRequest
  readonly realmId: string
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

function emailOtpVerifyTransaction(options: EmailOtpVerifyTransactionOptions): Result<EmailOtpVerifyCommit> {
  const op = "emailOtpVerify"
  const repository = emailOtpRepositoryCreate(options.database)
  const challenge = repository.emailOtpChallengeGet(options.realmId, options.input.challengeId)
  if (!challenge.success) return challenge
  if (challenge.data === null || challenge.data.purpose !== "sign_in")
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const current = challenge.data
  if (current.consumedAt !== null)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  if (current.expiresAt <= options.now)
    return emailOtpExpiredRecord(
      options,
      current.id,
      current.realmId,
      current.version,
      current.attempts,
      current.userId,
    )
  if (current.attempts >= current.maxAttempts)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const matched = emailOtpCodeMatches(current.id, options.input.code, current.codeHash)
  if (!matched) {
    const attempts = current.attempts + 1
    const exhausted = attempts >= current.maxAttempts
    const updated = repository.emailOtpChallengeAttemptRecord({
      attempts,
      consumedAt: exhausted ? options.now : null,
      expectedVersion: current.version,
      id: current.id,
      realmId: options.realmId,
      version: current.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
    const event = emailOtpFailedEventAppend(
      options,
      updated.data.version,
      updated.data.attempts,
      exhausted,
      "invalid_code",
    )
    if (!event.success) return event
    const notification =
      current.userId === null
        ? undefined
        : emailOtpNotificationCreate("failed", current.userId, current.id, options.realmId, attempts)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const, notification })
  }
  if (current.userId === null)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const userId = current.userId
  const user = repository.emailOtpUserGet(options.realmId, userId)
  if (!user.success) return user
  const normalizedEmail =
    user.data === null
      ? resultErrorCreate("emailOtpVerify", "The email OTP code is invalid.", "email-otp.invalid")
      : userEmailNormalize(user.data.email)
  const eligible =
    user.data !== null &&
    normalizedEmail.success &&
    emailOtpEmailHashCreate(normalizedEmail.data) === current.emailHash &&
    user.data.state === "active" &&
    user.data.deletedAt === null &&
    user.data.emailVerifiedAt !== null
  if (!eligible) {
    const consumed = repository.emailOtpChallengeConsume(options.realmId, current.id, current.version, options.now)
    if (!consumed.success) return consumed
    if (consumed.data === null)
      return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
    const event = emailOtpFailedEventAppend(
      options,
      consumed.data.version,
      consumed.data.attempts,
      true,
      "authorization_failed",
    )
    if (!event.success) return event
    return resultCreate({
      errorMessage: "The email OTP code is invalid.",
      failure: true as const,
      notification: emailOtpNotificationCreate("failed", current.userId, current.id, options.realmId, current.attempts),
    })
  }
  const consumed = repository.emailOtpChallengeConsume(options.realmId, current.id, current.version, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const payload = v.safeParse(emailOtpVerifiedEventPayloadSchema, { challengeId: current.id, userId })
  if (!payload.success) return resultErrorCreate(op, "The email OTP event payload is invalid.", "email-otp.internal")
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: current.id,
      aggregateType: "email_otp",
      aggregateVersion: consumed.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: emailOtpEventTypes.verified,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "email_otp" },
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
    realmId: options.realmId,
    primaryAuthenticationMethod: "email_otp",
    runtime: options.runtime,
    sessionCreate: () =>
      sessionIssue({
        actorId: options.context.actorId,
        assurance: "authenticated",
        authenticationMethod: "email_otp",
        commandIndex: 1,
        correlationId: options.correlationId,
        deviceMetadata: options.deviceMetadata,
        executor: options.database,
        realmId: options.realmId,
        runtime: options.runtime,
        userId,
      }),
    userId,
  })
  if (!authenticationResult.success)
    return resultErrorCreate(op, "The authenticated session could not be created.", "email-otp.internal")
  return resultCreate({
    failure: false as const,
    notification: emailOtpNotificationCreate("verified", userId, current.id, options.realmId),
    response: {
      authentication,
      ...authenticationResult.data,
    },
  })
}

function emailOtpExpiredRecord(
  options: EmailOtpVerifyTransactionOptions,
  challengeId: string,
  realmId: string,
  expectedVersion: number,
  attempts: number,
  userId: string | null,
): Result<EmailOtpVerifyCommit> {
  const repository = emailOtpRepositoryCreate(options.database)
  const consumed = repository.emailOtpChallengeConsume(realmId, challengeId, expectedVersion, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const event = emailOtpFailedEventAppend(options, consumed.data.version, attempts, false, "expired")
  if (!event.success) return event
  return resultCreate({
    errorMessage: "The email OTP code is invalid.",
    failure: true as const,
    notification:
      userId === null ? undefined : emailOtpNotificationCreate("failed", userId, challengeId, realmId, attempts),
  })
}

function emailOtpFailedEventAppend(
  options: EmailOtpVerifyTransactionOptions,
  aggregateVersion: number,
  attempts: number,
  exhausted: boolean,
  reason: "authorization_failed" | "expired" | "invalid_code",
) {
  const payload = v.safeParse(emailOtpFailedEventPayloadSchema, { attempts, exhausted, reason })
  if (!payload.success)
    return resultErrorCreate("emailOtpVerify", "The email OTP event payload is invalid.", "email-otp.internal")
  return storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.input.challengeId,
      aggregateType: "email_otp",
      aggregateVersion,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: emailOtpEventTypes.failed,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "email_otp" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
}

function emailOtpNotificationCreate(
  kind: "failed" | "verified",
  userId: string,
  challengeId: string,
  realmId: string,
  attempts?: number,
): EmailOtpSecurityNotification {
  return {
    ...(attempts === undefined ? {} : { attempts }),
    challengeId,
    realmId: realmId,
    kind,
    userId,
  }
}

function emailOtpPortInvoke<T>(port: ((value: T) => void | Promise<void>) | undefined, value: T): void {
  if (port === undefined) return
  try {
    void Promise.resolve(port(value)).catch(() => undefined)
  } catch (_error) {}
}
