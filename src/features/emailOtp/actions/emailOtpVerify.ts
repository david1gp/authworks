import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
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
import { mfaPrimaryAuthenticationComplete } from "../../mfa/actions/mfaPrimaryAuthenticationComplete.js"
import { organizationLoginPolicyEnforce } from "../../organizations/public/organizationLoginPolicyEnforce.js"

type EmailOtpVerifyOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: EmailOtpVerifyRequest
  readonly instanceId: string
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
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The email OTP is not available in this tenant context.")
  const parsed = v.safeParse(emailOtpVerifyRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The email OTP code is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The email OTP timestamp is invalid.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success || instance.data.instance.status !== "active")
    return resultErrorCreate(op, "The email OTP code is invalid.")
  const challenge = emailOtpRepositoryCreate(options.database.db).emailOtpChallengeGet(
    options.instanceId,
    parsed.output.challengeId,
  )
  if (
    !challenge.success ||
    challenge.data === null ||
    (parsed.output.organizationId !== undefined && parsed.output.organizationId !== challenge.data.organizationId)
  )
    return resultErrorCreate(op, "The email OTP code is invalid.")
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    instanceId: options.instanceId,
    method: "email_otp",
    organizationId: challenge.data.organizationId ?? undefined,
  })
  if (!policy.success) return resultErrorCreate(op, "The email OTP login method is disabled for this organization.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    emailOtpVerifyTransaction({
      context: options.context,
      correlationId,
      database: transaction,
      deviceMetadata: options.deviceMetadata,
      input: parsed.output,
      instanceId: options.instanceId,
      now,
      runtime,
    }),
  )
  if (!committed.success) return committed
  if (committed.data.notification !== undefined)
    emailOtpPortInvoke(options.onSecurityNotification, committed.data.notification)
  if (committed.data.failure) return resultErrorCreate(op, committed.data.errorMessage)
  return resultCreate(committed.data.response)
}

type EmailOtpVerifyTransactionOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly correlationId: string
  readonly database: StorageExecutor
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly input: EmailOtpVerifyRequest
  readonly instanceId: string
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

function emailOtpVerifyTransaction(options: EmailOtpVerifyTransactionOptions): Result<EmailOtpVerifyCommit> {
  const op = "emailOtpVerify"
  const repository = emailOtpRepositoryCreate(options.database)
  const challenge = repository.emailOtpChallengeGet(options.instanceId, options.input.challengeId)
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
      current.instanceId,
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
      instanceId: options.instanceId,
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
        : emailOtpNotificationCreate("failed", current.userId, current.id, options.instanceId, attempts)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const, notification })
  }
  if (current.userId === null)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const userId = current.userId
  const user = repository.emailOtpUserGet(options.instanceId, userId)
  if (!user.success) return user
  const normalizedEmail =
    user.data === null
      ? resultErrorCreate("emailOtpVerify", "The email OTP code is invalid.")
      : userEmailNormalize(user.data.email)
  const eligible =
    user.data !== null &&
    normalizedEmail.success &&
    emailOtpEmailHashCreate(normalizedEmail.data) === current.emailHash &&
    user.data.state === "active" &&
    user.data.deletedAt === null &&
    user.data.emailVerifiedAt !== null
  if (!eligible) {
    const consumed = repository.emailOtpChallengeConsume(options.instanceId, current.id, current.version, options.now)
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
      notification: emailOtpNotificationCreate(
        "failed",
        current.userId,
        current.id,
        options.instanceId,
        current.attempts,
      ),
    })
  }
  const consumed = repository.emailOtpChallengeConsume(options.instanceId, current.id, current.version, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const payload = v.safeParse(emailOtpVerifiedEventPayloadSchema, { challengeId: current.id, userId })
  if (!payload.success) return resultErrorCreate(op, "The email OTP event payload is invalid.")
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
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "email_otp" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  const authentication = { authenticatedAt: options.now, instanceId: options.instanceId, userId }
  const authenticationResult = mfaPrimaryAuthenticationComplete({
    actorId: options.context.actorId,
    deviceMetadata: options.deviceMetadata,
    executor: options.database,
    instanceId: options.instanceId,
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
        instanceId: options.instanceId,
        runtime: options.runtime,
        userId,
      }),
    userId,
  })
  if (!authenticationResult.success) return resultErrorCreate(op, "The authenticated session could not be created.")
  return resultCreate({
    failure: false as const,
    notification: emailOtpNotificationCreate("verified", userId, current.id, options.instanceId),
    response: {
      authentication,
      ...authenticationResult.data,
    },
  })
}

function emailOtpExpiredRecord(
  options: EmailOtpVerifyTransactionOptions,
  challengeId: string,
  instanceId: string,
  expectedVersion: number,
  attempts: number,
  userId: string | null,
): Result<EmailOtpVerifyCommit> {
  const repository = emailOtpRepositoryCreate(options.database)
  const consumed = repository.emailOtpChallengeConsume(instanceId, challengeId, expectedVersion, options.now)
  if (!consumed.success) return consumed
  if (consumed.data === null)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const event = emailOtpFailedEventAppend(options, consumed.data.version, attempts, false, "expired")
  if (!event.success) return event
  return resultCreate({
    errorMessage: "The email OTP code is invalid.",
    failure: true as const,
    notification:
      userId === null ? undefined : emailOtpNotificationCreate("failed", userId, challengeId, instanceId, attempts),
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
  if (!payload.success) return resultErrorCreate("emailOtpVerify", "The email OTP event payload is invalid.")
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
      instanceId: options.instanceId,
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
  instanceId: string,
  attempts?: number,
): EmailOtpSecurityNotification {
  return {
    ...(attempts === undefined ? {} : { attempts }),
    challengeId,
    instanceId,
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
