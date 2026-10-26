import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { otpLockoutRepositoryCreate } from "../../../platform/lockout/otpLockoutRepositoryCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { mfaPrimaryAuthenticationComplete } from "../../mfa/actions/mfaPrimaryAuthenticationComplete.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
import { userEmailRepositoryCreate } from "../../users/persistence/userEmailRepositoryCreate.js"
import { userTable } from "../../users/persistence/userTable.js"
import { passwordPolicyResolve } from "../../passwords/domain/passwordPolicyResolve.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"
import { passwordRepositoryCreate } from "../../passwords/persistence/passwordRepositoryCreate.js"
import { emailOtpCodeMatches } from "../domain/emailOtpCodeMatches.js"
import { emailOtpEmailHashCreate } from "../domain/emailOtpEmailHashCreate.js"
import { emailOtpEventTypes } from "../events/emailOtpEventTypes.js"
import { emailOtpFailedEventPayloadSchema } from "../events/emailOtpFailedEventPayloadSchema.js"
import { emailOtpVerifiedEventPayloadSchema } from "../events/emailOtpVerifiedEventPayloadSchema.js"
import { emailOtpRepositoryCreate } from "../persistence/emailOtpRepositoryCreate.js"
import { emailOtpRateLimitConsume } from "./emailOtpRateLimitConsume.js"
import type { EmailOtpSecurityNotification } from "../public/emailOtpSecurityNotificationSchema.js"
import type { EmailOtpVerifyRequest } from "../public/emailOtpVerifyRequestSchema.js"
import { emailOtpVerifyRequestSchema } from "../public/emailOtpVerifyRequestSchema.js"
import type { EmailOtpVerifyResponse } from "../public/emailOtpVerifyResponseSchema.js"

type EmailOtpVerifyOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly clientIp?: string
  readonly database: StorageDatabase
  readonly input: EmailOtpVerifyRequest
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly onSecurityNotification?: (notification: EmailOtpSecurityNotification) => void | Promise<void>
}

type EmailOtpVerifyCommit =
  | {
      readonly failure: true
      readonly errorMessage: string
      readonly notification?: EmailOtpSecurityNotification
      readonly rateLimited?: false
    }
  | { readonly failure?: false; readonly rateLimited: true; readonly retryAt: number }
  | {
      readonly failure: false
      readonly rateLimited?: false
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
  if (challenge.data === null) return resultErrorCreate(op, "The email OTP code is invalid.", "email-otp.invalid")
  const loginContext = organizationLoginContextValidate({
    context: {
      ...(challenge.data.organizationId === null ? {} : { organizationId: challenge.data.organizationId }),
      realmId: challenge.data.realmId,
    },
    executor: options.database.db,
    ...(parsed.output.organizationId === undefined ? {} : { expectedOrganizationId: parsed.output.organizationId }),
    expectedRealmId: options.realmId,
  })
  if (!loginContext.success) return resultErrorCreate(op, "The email OTP code is invalid.", "email-otp.invalid")
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    realmId: options.realmId,
    method: "email_otp",
    organizationId: loginContext.data.organizationId,
  })
  if (!policy.success)
    return resultErrorCreate(op, "The email OTP login method is disabled for this organization.", "email-otp.conflict")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) =>
    emailOtpVerifyTransaction({
      clientIp: options.clientIp ?? "unknown",
      context: options.context,
      correlationId,
      database: transaction,
      deviceMetadata: options.deviceMetadata,
      input: parsed.output,
      policyDatabase: options.database,
      rateLimitIdentifier: challenge.data?.emailHash ?? parsed.output.challengeId,
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
      now,
      runtime,
    }),
  )
  if (!committed.success) return committed
  if (committed.data.rateLimited === true)
    return resultErrorCreate(op, "Too many email OTP requests.", "email-otp.rate-limited", {
      retryAfterSeconds: Math.max(1, Math.ceil((committed.data.retryAt - now) / 1_000)),
    })
  if (committed.data.notification !== undefined)
    emailOtpPortInvoke(options.onSecurityNotification, committed.data.notification)
  if (committed.data.failure) return resultErrorCreate(op, committed.data.errorMessage, "email-otp.invalid")
  return resultCreate(committed.data.response)
}

type EmailOtpVerifyTransactionOptions = {
  readonly clientIp: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageTransaction
  readonly deviceMetadata?: SessionDeviceMetadata
  readonly input: EmailOtpVerifyRequest
  readonly policyDatabase: StorageDatabase
  readonly rateLimitIdentifier: string
  readonly rateLimitSecret?: Secret | string
  readonly realmId: string
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

function emailOtpVerifyTransaction(options: EmailOtpVerifyTransactionOptions): Result<EmailOtpVerifyCommit> {
  const op = "emailOtpVerify"
  if (options.rateLimitSecret !== undefined) {
    const limited = emailOtpRateLimitConsume(options.database, {
      clientIp: options.clientIp,
      identifier: options.rateLimitIdentifier,
      now: options.now,
      operation: "verify",
      rateLimitSecret: options.rateLimitSecret,
      realmId: options.realmId,
    })
    if (!limited.success) return limited
    if (!limited.data.allowed) return resultCreate({ rateLimited: true, retryAt: limited.data.retryAt })
  }
  const repository = emailOtpRepositoryCreate(options.database)
  const challenge = repository.emailOtpChallengeGet(options.realmId, options.input.challengeId)
  if (!challenge.success) return challenge
  if (challenge.data === null || challenge.data.purpose !== "sign_in")
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const current = challenge.data
  const loginContext = organizationLoginContextValidate({
    context: {
      ...(current.organizationId === null ? {} : { organizationId: current.organizationId }),
      realmId: current.realmId,
    },
    executor: options.database,
    ...(options.input.organizationId === undefined ? {} : { expectedOrganizationId: options.input.organizationId }),
    expectedRealmId: options.realmId,
  })
  if (!loginContext.success)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const organizationId = loginContext.data.organizationId
  const otpPolicy = passwordPolicyResolve({
    executor: options.database,
    ...(organizationId === undefined ? {} : { organizationId }),
    realmId: options.realmId,
  })
  if (!otpPolicy.success)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const otpLockouts = otpLockoutRepositoryCreate(options.database)
  const otpLockout = current.userId === null ? null : otpLockouts.otpLockoutGet(options.realmId, current.userId)
  if (otpLockout !== null && !otpLockout.success)
    return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
  const otpLockoutRow = otpLockout?.data ?? null
  if (
    otpLockoutRow?.lockedUntil !== null &&
    otpLockoutRow?.lockedUntil !== undefined &&
    otpLockoutRow.lockedUntil > options.now
  )
    return resultCreate({
      errorMessage: "The email OTP code is invalid.",
      failure: true as const,
      notification:
        current.userId === null
          ? undefined
          : emailOtpNotificationCreate(
              "failed",
              current.userId,
              current.id,
              options.realmId,
              otpLockoutRow.failedAttempts,
            ),
    })
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
    if (current.userId !== null) {
      const lockoutRecorded = emailOtpFailureLockoutRecord({
        context: options.context,
        correlationId: options.correlationId,
        database: options.database,
        lockedUntil: otpLockoutRow?.lockedUntil ?? null,
        now: options.now,
        otpLockouts,
        policy: otpPolicy.data,
        previousAttempts: otpLockoutRow?.failedAttempts ?? 0,
        previousVersion: otpLockoutRow?.version ?? 0,
        realmId: options.realmId,
        runtime: options.runtime,
        userId: current.userId,
      })
      if (!lockoutRecorded.success) return lockoutRecorded
    }
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
  let verifiedUser = user.data
  let passwordLockedOut = false
  if (verifiedUser !== null && verifiedUser.state === "locked") {
    const passwordLockout = passwordRepositoryCreate(options.database).passwordLockoutGet(options.realmId, userId)
    if (!passwordLockout.success)
      return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
    passwordLockedOut =
      passwordLockout.data?.lockedUntil !== null &&
      passwordLockout.data?.lockedUntil !== undefined &&
      passwordLockout.data.lockedUntil > options.now
    if (!passwordLockedOut) {
      const unlocked = options.database
        .update(userTable)
        .set({ state: "active", updatedAt: options.now, version: verifiedUser.version + 1 })
        .where(and(eq(userTable.id, userId), eq(userTable.realmId, options.realmId)))
        .returning()
        .get()
      if (unlocked === undefined)
        return resultCreate({ errorMessage: "The email OTP code is invalid.", failure: true as const })
      const unlockedPayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!unlockedPayload.success)
        return resultErrorCreate(op, "The email OTP event payload is invalid.", "email-otp.internal")
      const unlockedEvent = storageEventAppend(
        options.database,
        {
          actorId: options.context.actorId,
          aggregateId: userId,
          aggregateType: "user",
          aggregateVersion: unlocked.version,
          commandIndex: 0,
          correlationId: options.correlationId,
          eventType: userEventTypes.stateChanged,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "email_otp" },
          occurredAt: options.now,
          payload: unlockedPayload.output,
        },
        options.runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
      verifiedUser = unlocked
    }
  }
  const emails = userEmailRepositoryCreate(options.database).userEmailList(options.realmId, userId)
  if (!emails.success) return resultErrorCreate(op, "The email OTP code is invalid.", "email-otp.read-failed")
  const eligible =
    !passwordLockedOut &&
    verifiedUser !== null &&
    verifiedUser.state === "active" &&
    verifiedUser.deletedAt === null &&
    emails.data.some((email) => email.verifiedAt !== null && emailOtpEmailHashCreate(email.email) === current.emailHash)
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
  if (otpLockoutRow !== null) {
    const reset = otpLockouts.otpLockoutSet({
      failedAttempts: 0,
      lockedUntil: null,
      realmId: options.realmId,
      updatedAt: options.now,
      userId,
      version: otpLockoutRow.version + 1,
    })
    if (!reset.success) return reset
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
    organizationId,
    policyDatabase: options.policyDatabase,
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
        database: options.policyDatabase,
        deviceMetadata: options.deviceMetadata,
        executor: options.database,
        organizationId,
        realmId: options.realmId,
        runtime: options.runtime,
        userId,
      }),
    userId,
  })
  if (!authenticationResult.success) return authenticationResult
  return resultCreate({
    failure: false as const,
    notification: emailOtpNotificationCreate("verified", userId, current.id, options.realmId),
    response: {
      authentication,
      ...authenticationResult.data,
    },
  })
}

type EmailOtpFailureLockoutRecordOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageTransaction
  readonly lockedUntil: number | null
  readonly now: number
  readonly otpLockouts: ReturnType<typeof otpLockoutRepositoryCreate>
  readonly policy: PasswordPolicy
  readonly previousAttempts: number
  readonly previousVersion: number
  readonly realmId: string
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

function emailOtpFailureLockoutRecord(
  options: EmailOtpFailureLockoutRecordOptions,
): Result<{ readonly locked: boolean }> {
  const op = "emailOtpVerify"
  const base = options.lockedUntil !== null && options.lockedUntil <= options.now ? 0 : options.previousAttempts
  const attempts = base + 1
  const locked = attempts >= options.policy.maximumAttempts
  const recorded = options.otpLockouts.otpLockoutSet({
    failedAttempts: attempts,
    lockedUntil: locked ? options.now + options.policy.lockoutDurationMs : null,
    realmId: options.realmId,
    updatedAt: options.now,
    userId: options.userId,
    version: options.previousVersion + 1,
  })
  if (!recorded.success) return recorded
  if (!locked) return resultCreate({ locked: false })
  const user = emailOtpRepositoryCreate(options.database).emailOtpUserGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "locked") return resultCreate({ locked: true })
  const updated = options.database
    .update(userTable)
    .set({ state: "locked", updatedAt: options.now, version: user.data.version + 1 })
    .where(and(eq(userTable.id, options.userId), eq(userTable.realmId, options.realmId)))
    .returning()
    .get()
  if (updated === undefined) return resultErrorCreate(op, "The email OTP code is invalid.", "email-otp.write-failed")
  const payload = v.safeParse(userStateChangedEventPayloadSchema, { from: user.data.state, to: "locked" })
  if (!payload.success) return resultErrorCreate(op, "The email OTP event payload is invalid.", "email-otp.internal")
  const event = storageEventAppend(
    options.database,
    {
      actorId: options.context.actorId,
      aggregateId: options.userId,
      aggregateType: "user",
      aggregateVersion: updated.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: userEventTypes.stateChanged,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "email_otp" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({ locked: true })
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
