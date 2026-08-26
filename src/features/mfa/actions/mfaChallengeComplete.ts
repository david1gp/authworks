import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageTransaction } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { emailOtpCodeMatches } from "../../emailOtp/domain/emailOtpCodeMatches.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { organizationLoginPolicyResolve } from "../../organizations/actions/organizationLoginPolicyResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { organizationMembershipContextValidate } from "../../organizations/server/organizationMembershipContextValidate.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { sessionCredentialCreate } from "../../sessions/domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../../sessions/domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../../sessions/domain/sessionPublicViewCreate.js"
import { sessionEventTypes } from "../../sessions/events/sessionEventTypes.js"
import { sessionRotatedEventPayloadSchema } from "../../sessions/events/sessionRotatedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../../sessions/persistence/sessionRepositoryCreate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaRecoveryCodeHashCreate } from "../domain/mfaRecoveryCodeHashCreate.js"
import { mfaTotpCodeVerify } from "../domain/mfaTotpCodeVerify.js"
import { mfaTotpSecretProtect } from "../domain/mfaTotpSecretProtect.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaChallengeCompleteRequest } from "../public/mfaChallengeCompleteRequestSchema.js"
import { mfaChallengeCompleteRequestSchema } from "../public/mfaChallengeCompleteRequestSchema.js"
import type { MfaLoginResponse } from "../public/mfaLoginResponseSchema.js"
import { mfaLoginChallengeContextGet } from "../server/mfaLoginChallengeContextGet.js"
import { mfaFactorAvailabilityResolve } from "./mfaFactorAvailabilityResolve.js"

type MfaChallengeCompleteOptions = {
  readonly actorId?: string | null
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: MfaChallengeCompleteRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
  readonly correlationId?: string
}

export function mfaChallengeComplete(options: MfaChallengeCompleteOptions): Result<MfaLoginResponse> {
  const op = "mfaChallengeComplete"
  const input = v.safeParse(mfaChallengeCompleteRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The MFA code is invalid.", "mfa.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The MFA timestamp is invalid.", "mfa.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) =>
    mfaChallengeCompleteTransaction({
      actorId: options.actorId,
      correlationId,
      database: transaction,
      encryptionSecret: options.encryptionSecret,
      input: input.output,
      policyDatabase: options.database,
      realmId: options.realmId,
      now,
      runtime,
      sessionToken: options.sessionToken,
    }),
  )
}

type MfaChallengeCompleteTransactionOptions = {
  readonly actorId?: string | null
  readonly correlationId: string
  readonly database: StorageTransaction
  readonly encryptionSecret?: Secret | string
  readonly input: MfaChallengeCompleteRequest
  readonly policyDatabase: StorageDatabase
  readonly realmId: string
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
}

function mfaChallengeCompleteTransaction(options: MfaChallengeCompleteTransactionOptions): Result<MfaLoginResponse> {
  const op = "mfaChallengeComplete"
  const repository = mfaRepositoryCreate(options.database)
  const challenge = repository.mfaChallengeGetByTokenHash(
    options.realmId,
    mfaChallengeTokenHashCreate(options.input.token),
  )
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    challenge.data.consumedAt !== null ||
    challenge.data.expiresAt <= options.now ||
    challenge.data.attempts >= challenge.data.maxAttempts
  )
    return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  const challengeContext = mfaLoginChallengeContextGet({
    executor: options.database,
    now: options.now,
    realmId: options.realmId,
    token: options.input.token,
  })
  if (!challengeContext.success) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  const loginContext = organizationLoginContextValidate({
    context: {
      ...(challenge.data.organizationId === null ? {} : { organizationId: challenge.data.organizationId }),
      realmId: challenge.data.realmId,
    },
    executor: options.database,
    expectedRealmId: options.realmId,
  })
  if (!loginContext.success) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  if (challenge.data.purpose === "step_up" && loginContext.data.organizationId !== undefined) {
    const membership = organizationMembershipContextValidate({
      executor: options.database,
      organizationId: loginContext.data.organizationId,
      realmId: options.realmId,
      userId: challenge.data.userId,
    })
    if (!membership.success) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.unauthorized")
  }
  if (challenge.data.purpose === "step_up" && options.sessionToken === undefined)
    return resultErrorCreate(op, "The MFA session is required.", "mfa.unauthorized")
  const selectedFactor = challengeContext.data.factor
  if (options.input.factor !== undefined && options.input.factor !== selectedFactor)
    return resultErrorCreate(op, "The MFA factor is not selected for this challenge.", "mfa.factor-disabled")
  const recoveryFallback = options.input.factor === undefined && options.input.code.length !== 6
  if (selectedFactor === "passkey" && !recoveryFallback)
    return resultErrorCreate(op, "The passkey factor must use a passkey ceremony.", "mfa.factor-unavailable")
  const available = mfaFactorAvailabilityResolve({
    executor: options.database,
    primaryAuthenticationMethod: challengeContext.data.primaryAuthenticationMethod,
    realmId: options.realmId,
    userId: challengeContext.data.userId,
  })
  if (!available.success) return available
  if (!recoveryFallback && !available.data.includes(selectedFactor))
    return resultErrorCreate(op, "The MFA factor is unavailable.", "mfa.factor-unavailable")
  const organizationPolicy = organizationLoginPolicyResolve({
    database: options.policyDatabase,
    executor: options.database,
    organizationId: loginContext.data.organizationId,
    realmId: options.realmId,
    runtimeAvailableFactors: recoveryFallback ? [selectedFactor] : available.data,
  })
  if (!organizationPolicy.success) return organizationPolicy
  if (
    !organizationPolicy.data.allowedFactors.includes(selectedFactor) ||
    (!recoveryFallback && !organizationPolicy.data.preferredFactorOrder.includes(selectedFactor))
  )
    return resultErrorCreate(op, "The MFA factor is disabled for this organization.", "mfa.factor-disabled")
  const policyRow = repository.mfaPolicyGet(options.realmId)
  if (!policyRow.success) return policyRow
  const policy = policyRow.data === null ? mfaPolicyDefaults : policyRow.data
  const currentLockout = repository.mfaLockoutGet(options.realmId, challenge.data.userId)
  if (!currentLockout.success) return currentLockout
  if (
    currentLockout.data?.lockedUntil !== null &&
    currentLockout.data?.lockedUntil !== undefined &&
    currentLockout.data.lockedUntil > options.now
  )
    return resultErrorCreate(op, "The MFA code is invalid.", "mfa.unauthorized")
  const active = repository.mfaEnrollmentActiveGet(options.realmId, challenge.data.userId)
  if (!active.success) return active
  const secret =
    active.data === null
      ? resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.not-found")
      : mfaTotpSecretProtect("decrypt", active.data.encryptedSecret, options.realmId, options.encryptionSecret)
  if (selectedFactor === "totp" && !secret.success)
    return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
  const totp =
    selectedFactor === "email_otp"
      ? resultErrorCreate(op, "The email OTP code is invalid.", "mfa.invalid")
      : !secret.success || active.data === null
        ? resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.invalid")
        : mfaTotpCodeVerify(secret.data, options.input.code, options.now, policy.totpWindow, active.data.lastUsedStep)
  const email =
    selectedFactor === "email_otp" &&
    challenge.data.emailCodeHash !== null &&
    options.now < challenge.data.expiresAt &&
    emailOtpCodeMatches(challenge.data.id, options.input.code, challenge.data.emailCodeHash)
  let factor: "email_otp" | "recovery_code" | "totp" | undefined
  let step: number | undefined
  let recoveryCodeId: string | undefined
  let recoveryCodeVersion: number | undefined
  if (email) {
    factor = "email_otp"
  } else if (totp.success) {
    factor = "totp"
    step = totp.data
  } else if (recoveryFallback) {
    const recovery = repository.mfaRecoveryCodeGet(
      options.realmId,
      challenge.data.userId,
      mfaRecoveryCodeHashCreate(options.input.code),
    )
    if (!recovery.success) return recovery
    if (recovery.data !== null) {
      const consumed = repository.mfaRecoveryCodeConsume(
        options.realmId,
        recovery.data.id,
        recovery.data.version,
        options.now,
      )
      if (!consumed.success) return consumed
      if (consumed.data !== null) {
        factor = "recovery_code"
        recoveryCodeId = consumed.data.id
        recoveryCodeVersion = consumed.data.version
      }
    }
  }
  if (factor === undefined)
    return mfaChallengeFailureRecord(
      options,
      challenge.data.id,
      challenge.data.version,
      challenge.data.attempts,
      challenge.data.maxAttempts,
      challenge.data.userId,
    )
  if (factor === "totp") {
    if (active.data === null || !secret.success)
      return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.not-found")
    const updated = repository.mfaEnrollmentUpdate(
      options.realmId,
      challenge.data.userId,
      active.data.id,
      active.data.version,
      {
        lastUsedStep: step,
        version: active.data.version + 1,
      },
    )
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The MFA code is invalid.", "mfa.write-failed")
  }
  if (factor === "recovery_code" && recoveryCodeId !== undefined && recoveryCodeVersion !== undefined) {
    const recoveryPayload = v.safeParse(mfaEventPayloadSchema, {
      factor: "recovery_code",
      userId: challenge.data.userId,
    })
    if (!recoveryPayload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
    const recoveryEvent = eventSecurityEventAppend(
      options.database,
      {
        actorId: options.actorId ?? challenge.data.userId,
        aggregateId: recoveryCodeId,
        aggregateType: "mfa_recovery_code",
        aggregateVersion: recoveryCodeVersion,
        commandIndex: 0,
        correlationId: options.correlationId,
        eventType: mfaEventTypes.recoveryCodeUsed,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: options.now,
        payload: recoveryPayload.output,
        userSubjectId: challenge.data.userId,
      },
      options.runtime,
    )
    if (!recoveryEvent.success) return recoveryEvent
  }
  const consumedChallenge = repository.mfaChallengeUpdate(options.realmId, challenge.data.id, challenge.data.version, {
    consumedAt: options.now,
    version: challenge.data.version + 1,
  })
  if (!consumedChallenge.success) return consumedChallenge
  if (consumedChallenge.data === null) return resultErrorCreate(op, "The MFA challenge is invalid.", "mfa.write-failed")
  const reset = repository.mfaLockoutSet({
    failedAttempts: 0,
    realmId: options.realmId,
    lockedUntil: null,
    updatedAt: options.now,
    userId: challenge.data.userId,
    version: (currentLockout.data?.version ?? 0) + 1,
  })
  if (!reset.success) return reset
  const completedPayload = v.safeParse(mfaEventPayloadSchema, {
    challengeId: challenge.data.id,
    factor,
    purpose: challenge.data.purpose,
    userId: challenge.data.userId,
  })
  if (!completedPayload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
  const completedEvent = eventSecurityEventAppend(
    options.database,
    {
      actorId: options.actorId ?? challenge.data.userId,
      aggregateId: challenge.data.id,
      aggregateType: "mfa_challenge",
      aggregateVersion: consumedChallenge.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: mfaEventTypes.challengeCompleted,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "mfa" },
      occurredAt: options.now,
      payload: completedPayload.output,
      userSubjectId: challenge.data.userId,
    },
    options.runtime,
  )
  if (!completedEvent.success) return completedEvent
  const authentication = { authenticatedAt: options.now, realmId: options.realmId, userId: challenge.data.userId }
  if (challenge.data.purpose === "login") {
    const session = sessionIssue({
      actorId: options.actorId ?? challenge.data.userId,
      assurance: "multi_factor",
      authenticationMethod: challenge.data.primaryAuthenticationMethod as
        | "email_otp"
        | "external_identity"
        | "password"
        | "passkey"
        | "whatsapp_otp",
      commandIndex: 1,
      correlationId: options.correlationId,
      deviceMetadata: {
        ...(challenge.data.deviceDescription === null ? {} : { description: challenge.data.deviceDescription }),
        ...(challenge.data.deviceFingerprint === null ? {} : { fingerprint: challenge.data.deviceFingerprint }),
        ...(challenge.data.ipAddress === null ? {} : { ipAddress: challenge.data.ipAddress }),
        ...(challenge.data.userAgent === null ? {} : { userAgent: challenge.data.userAgent }),
      },
      database: options.policyDatabase,
      executor: options.database,
      organizationId: challenge.data.organizationId ?? undefined,
      realmId: options.realmId,
      mfaChallengeId: challenge.data.id,
      mfaMethod: factor,
      runtime: options.runtime,
      userId: challenge.data.userId,
    })
    if (!session.success)
      return resultErrorCreate(op, "The multi-factor session could not be created.", "mfa.write-failed")
    return resultCreate({
      authentication: {
        authenticatedAt: authentication.authenticatedAt,
        realmId: authentication.realmId,
        userId: authentication.userId,
      },
      session: session.data,
    })
  }
  return mfaStepUpSessionRotate(
    options,
    challenge.data.sessionId!,
    loginContext.data.organizationId,
    factor,
    authentication,
  )
}

function mfaChallengeFailureRecord(
  options: MfaChallengeCompleteTransactionOptions,
  challengeId: string,
  expectedVersion: number,
  attempts: number,
  maxAttempts: number,
  userId: string,
): Result<MfaLoginResponse> {
  const nextAttempts = attempts + 1
  const consumedAt = nextAttempts >= maxAttempts ? options.now : null
  const repository = mfaRepositoryCreate(options.database)
  const updated = repository.mfaChallengeUpdate(options.realmId, challengeId, expectedVersion, {
    attempts: nextAttempts,
    consumedAt,
    version: expectedVersion + 1,
  })
  if (!updated.success) return updated
  if (updated.data === null)
    return resultErrorCreate("mfaChallengeComplete", "The MFA challenge is invalid.", "mfa.write-failed")
  const lockout = repository.mfaLockoutGet(options.realmId, userId)
  if (!lockout.success) return lockout
  const policy = repository.mfaPolicyGet(options.realmId)
  if (!policy.success) return policy
  const maxAttemptsForUser = policy.data?.maxAttempts ?? mfaPolicyDefaults.maxAttempts
  const lockoutUpdated = repository.mfaLockoutSet({
    failedAttempts: nextAttempts,
    realmId: options.realmId,
    lockedUntil:
      nextAttempts >= maxAttemptsForUser
        ? options.now + (policy.data?.lockoutDurationMs ?? mfaPolicyDefaults.lockoutDurationMs)
        : null,
    updatedAt: options.now,
    userId,
    version: (lockout.data?.version ?? 0) + 1,
  })
  if (!lockoutUpdated.success) return lockoutUpdated
  const payload = v.safeParse(mfaEventPayloadSchema, {
    attempts: nextAttempts,
    challengeId,
    locked: consumedAt !== null,
    userId,
  })
  if (!payload.success)
    return resultErrorCreate("mfaChallengeComplete", "The MFA event payload is invalid.", "mfa.event-invalid")
  const event = eventSecurityEventAppend(
    options.database,
    {
      actorId: userId,
      aggregateId: challengeId,
      aggregateType: "mfa_challenge",
      aggregateVersion: updated.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: mfaEventTypes.challengeFailed,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "mfa" },
      occurredAt: options.now,
      payload: payload.output,
      userSubjectId: userId,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultErrorCreate("mfaChallengeComplete", "The MFA code is invalid.", "mfa.unauthorized")
}

function mfaStepUpSessionRotate(
  options: MfaChallengeCompleteTransactionOptions,
  sessionId: string,
  organizationId: string | undefined,
  factor: "email_otp" | "passkey" | "recovery_code" | "totp",
  authentication: MfaAuthentication,
): Result<MfaLoginResponse> {
  const op = "mfaChallengeComplete"
  if (options.sessionToken === undefined)
    return resultErrorCreate(op, "The MFA session is required.", "mfa.unauthorized")
  const current = options.database
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.realmId, options.realmId),
        eq(sessionTable.id, sessionId),
        eq(sessionTable.userId, authentication.userId),
      ),
    )
    .get()
  if (
    current === undefined ||
    current.tokenHash !== sessionCredentialHashCreate(options.sessionToken) ||
    current.revokedAt !== null ||
    current.expiresAt <= options.now
  )
    return resultErrorCreate(op, "The MFA session is invalid.", "mfa.unauthorized")
  const sessionContext = organizationLoginContextValidate({
    context: {
      ...(current.organizationId === null ? {} : { organizationId: current.organizationId }),
      realmId: current.realmId,
    },
    executor: options.database,
    expectedRealmId: options.realmId,
  })
  if (!sessionContext.success || sessionContext.data.organizationId !== organizationId)
    return resultErrorCreate(op, "The MFA session is invalid.", "mfa.unauthorized")
  if (organizationId !== undefined) {
    const membership = organizationMembershipContextValidate({
      executor: options.database,
      organizationId,
      realmId: options.realmId,
      userId: authentication.userId,
    })
    if (!membership.success) return resultErrorCreate(op, "The MFA session is invalid.", "mfa.unauthorized")
  }
  const nextToken = sessionCredentialCreate(options.runtime)
  const rotated = sessionRepositoryCreate(options.database).sessionAssuranceRotate(
    options.realmId,
    current.id,
    current.tokenHash,
    sessionCredentialHashCreate(nextToken),
    options.now,
    current.version,
    current.version + 1,
    factor,
  )
  if (!rotated.success) return rotated
  if (rotated.data === null) return resultErrorCreate(op, "The MFA session is invalid.", "mfa.write-failed")
  const eventVersion = sessionRepositoryCreate(options.database).sessionEventVersionGet(options.realmId, current.id)
  if (!eventVersion.success) return eventVersion
  const payload = v.safeParse(sessionRotatedEventPayloadSchema, { rotatedAt: options.now, sessionId: current.id })
  if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.", "mfa.event-invalid")
  const event = eventSecurityEventAppend(
    options.database,
    {
      actorId: authentication.userId,
      aggregateId: current.id,
      aggregateType: "session",
      aggregateVersion: eventVersion.data + 1,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: sessionEventTypes.rotated,
      realmId: options.realmId,
      metadata: { auditSafe: true, source: "sessions" },
      occurredAt: options.now,
      payload: payload.output,
      userSubjectId: authentication.userId,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({
    authentication: {
      authenticatedAt: authentication.authenticatedAt,
      realmId: authentication.realmId,
      userId: authentication.userId,
    },
    session: { session: sessionPublicViewCreate(rotated.data, true), token: nextToken },
  })
}

type MfaAuthentication = {
  readonly authenticatedAt: number
  readonly realmId: string
  readonly userId: string
}
