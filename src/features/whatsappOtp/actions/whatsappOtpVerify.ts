import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { otpLockoutRepositoryCreate } from "../../../platform/lockout/otpLockoutRepositoryCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { mfaPrimaryAuthenticationComplete } from "../../mfa/actions/mfaPrimaryAuthenticationComplete.js"
import { organizationLoginPolicyEnforce } from "../../organizations/actions/organizationLoginPolicyEnforce.js"
import { organizationLoginContextResolve } from "../../organizations/server/organizationLoginContextResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import type { SessionDeviceMetadata } from "../../sessions/public/sessionDeviceMetadataSchema.js"
import { userEventTypes } from "../../users/events/userEventTypes.js"
import { userStateChangedEventPayloadSchema } from "../../users/events/userStateChangedEventPayloadSchema.js"
import { userTable } from "../../users/persistence/userTable.js"
import { userLookupCreate } from "../../users/server/userLookupCreate.js"
import { passwordPolicyResolve } from "../../passwords/domain/passwordPolicyResolve.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"
import { passwordRepositoryCreate } from "../../passwords/persistence/passwordRepositoryCreate.js"
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
    const loginContext = organizationLoginContextResolve({
      executor: options.database.db,
      organizationId: parsed.output.organizationId,
      realmId: options.realmId,
    })
    if (!loginContext.success) return resultErrorCreate(op, "The WhatsApp OTP code is invalid.", "whatsapp-otp.invalid")
    const policy = organizationLoginPolicyEnforce({
      database: options.database,
      method: "whatsapp_otp",
      organizationId: loginContext.data.organizationId,
      realmId: options.realmId,
    })
    if (!policy.success)
      return resultErrorCreate(
        op,
        "The WhatsApp OTP login method is disabled for this organization.",
        "whatsapp-otp.conflict",
      )
  } else {
    const denial = whatsappOtpChallengePolicyDenialGet({
      challengeId: parsed.output.challengeId,
      database: options.database,
      realmId: options.realmId,
    })
    if (!denial.success) return denial
    if (denial.data.denied)
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

type WhatsappOtpChallengePolicyDenialOptions = {
  readonly challengeId: string
  readonly database: StorageDatabase
  readonly realmId: string
}

function whatsappOtpChallengePolicyDenialGet(
  options: WhatsappOtpChallengePolicyDenialOptions,
): Result<{ denied: boolean }> {
  const challenge = whatsappOtpRepositoryCreate(options.database.db).whatsappOtpChallengeGet(
    options.realmId,
    options.challengeId,
  )
  if (!challenge.success) return challenge
  if (challenge.data === null || challenge.data.purpose !== "sign_in") return resultCreate({ denied: false })
  const loginContext = organizationLoginContextValidate({
    context: {
      ...(challenge.data.organizationId === null ? {} : { organizationId: challenge.data.organizationId }),
      realmId: challenge.data.realmId,
    },
    executor: options.database.db,
    expectedRealmId: options.realmId,
  })
  if (!loginContext.success) return resultCreate({ denied: false })
  const policy = organizationLoginPolicyEnforce({
    database: options.database,
    method: "whatsapp_otp",
    organizationId: loginContext.data.organizationId,
    realmId: options.realmId,
  })
  if (!policy.success) return resultCreate({ denied: true })
  return resultCreate({ denied: false })
}

type WhatsappOtpVerifyTransactionOptions = {
  readonly clientIp: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly correlationId: string
  readonly database: StorageTransaction
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
  if (challenge.data === null || challenge.data.purpose !== "sign_in") return resultCreate({ failure: true })
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
  if (!loginContext.success) return resultCreate({ failure: true })
  const organizationId = loginContext.data.organizationId
  const policy = organizationLoginPolicyEnforce({
    database: options.policyDatabase,
    executor: options.database,
    method: "whatsapp_otp",
    organizationId,
    realmId: options.realmId,
  })
  if (!policy.success) return resultCreate({ policyDenied: true })
  const otpPolicy = passwordPolicyResolve({
    executor: options.database,
    ...(organizationId === undefined ? {} : { organizationId }),
    realmId: options.realmId,
  })
  if (!otpPolicy.success) return resultCreate({ failure: true })
  const otpLockouts = otpLockoutRepositoryCreate(options.database)
  const otpLockout = current.userId === null ? null : otpLockouts.otpLockoutGet(options.realmId, current.userId)
  if (otpLockout !== null && !otpLockout.success) return otpLockout
  const otpLockoutRow = otpLockout?.data ?? null
  if (
    otpLockoutRow?.lockedUntil !== null &&
    otpLockoutRow?.lockedUntil !== undefined &&
    otpLockoutRow.lockedUntil > options.now
  )
    return resultCreate({
      failure: true,
      notification:
        current.userId === null
          ? undefined
          : whatsappOtpNotificationCreate(
              "failed",
              current.userId,
              current.id,
              options.realmId,
              otpLockoutRow.failedAttempts,
            ),
    })
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
    if (current.userId !== null) {
      const lockoutRecorded = whatsappOtpFailureLockoutRecord({
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
  let verifiedUser = user.data
  let passwordLockedOut = false
  if (verifiedUser !== null && verifiedUser.state === "locked") {
    const passwordLockout = passwordRepositoryCreate(options.database).passwordLockoutGet(options.realmId, userId)
    if (!passwordLockout.success) return passwordLockout
    passwordLockedOut =
      passwordLockout.data?.lockedUntil !== null &&
      passwordLockout.data?.lockedUntil !== undefined &&
      passwordLockout.data.lockedUntil > options.now
    if (!passwordLockedOut) {
      const fullUser = passwordRepositoryCreate(options.database).passwordUserGet(options.realmId, userId)
      if (!fullUser.success) return fullUser
      if (fullUser.data === null) return resultCreate({ failure: true })
      const unlocked = options.database
        .update(userTable)
        .set({ state: "active", updatedAt: options.now, version: fullUser.data.version + 1 })
        .where(and(eq(userTable.id, userId), eq(userTable.realmId, options.realmId)))
        .returning()
        .get()
      if (unlocked === undefined) return resultCreate({ failure: true })
      const unlockedPayload = v.safeParse(userStateChangedEventPayloadSchema, { from: "locked", to: "active" })
      if (!unlockedPayload.success)
        return resultErrorCreate(
          "whatsappOtpVerify",
          "The WhatsApp OTP event payload is invalid.",
          "whatsapp-otp.internal",
        )
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
          metadata: { auditSafe: true, source: "whatsapp_otp" },
          occurredAt: options.now,
          payload: unlockedPayload.output,
        },
        options.runtime,
      )
      if (!unlockedEvent.success) return unlockedEvent
      const refreshed = users.userGet(options.realmId, userId)
      if (!refreshed.success) return refreshed
      verifiedUser = refreshed.data
    }
  }
  const eligible =
    !passwordLockedOut &&
    verifiedUser !== null &&
    verifiedUser.state === "active" &&
    verifiedUser.deletedAt === null &&
    verifiedUser.phoneNumber !== null &&
    verifiedUser.phoneNumberVerifiedAt !== null &&
    whatsappOtpPhoneHashCreate(verifiedUser.phoneNumber) === current.phoneHash
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
    organizationId,
    policyDatabase: options.policyDatabase,
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
        organizationId,
        realmId: options.realmId,
        runtime: options.runtime,
        userId,
      }),
    userId,
  })
  if (!authenticationResult.success) return authenticationResult
  return resultCreate({
    failure: false,
    notification: whatsappOtpNotificationCreate("verified", userId, current.id, options.realmId),
    response: { authentication, ...authenticationResult.data },
  })
}

type WhatsappOtpFailureLockoutRecordOptions = {
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

function whatsappOtpFailureLockoutRecord(
  options: WhatsappOtpFailureLockoutRecordOptions,
): Result<{ readonly locked: boolean }> {
  const op = "whatsappOtpVerify"
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
  const users = userLookupCreate(options.database)
  const user = users.userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "locked") return resultCreate({ locked: true })
  const fullUser = passwordRepositoryCreate(options.database).passwordUserGet(options.realmId, options.userId)
  if (!fullUser.success) return fullUser
  if (fullUser.data === null) return resultCreate({ locked: true })
  const updated = options.database
    .update(userTable)
    .set({ state: "locked", updatedAt: options.now, version: fullUser.data.version + 1 })
    .where(and(eq(userTable.id, options.userId), eq(userTable.realmId, options.realmId)))
    .returning()
    .get()
  if (updated === undefined)
    return resultErrorCreate(op, "The WhatsApp OTP code is invalid.", "whatsapp-otp.write-failed")
  const payload = v.safeParse(userStateChangedEventPayloadSchema, { from: fullUser.data.state, to: "locked" })
  if (!payload.success)
    return resultErrorCreate(op, "The WhatsApp OTP event payload is invalid.", "whatsapp-otp.internal")
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
      metadata: { auditSafe: true, source: "whatsapp_otp" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({ locked: true })
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
