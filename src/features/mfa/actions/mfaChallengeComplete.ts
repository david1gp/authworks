import * as v from "valibot"
import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { mfaChallengeTokenHashCreate } from "../domain/mfaChallengeTokenHashCreate.js"
import { mfaRecoveryCodeHashCreate } from "../domain/mfaRecoveryCodeHashCreate.js"
import { mfaTotpCodeVerify } from "../domain/mfaTotpCodeVerify.js"
import { mfaTotpSecretProtect } from "../domain/mfaTotpSecretProtect.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import { sessionCredentialCreate } from "../../sessions/domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../../sessions/domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../../sessions/domain/sessionPublicViewCreate.js"
import { sessionRepositoryCreate } from "../../sessions/persistence/sessionRepositoryCreate.js"
import { sessionRotatedEventPayloadSchema } from "../../sessions/events/sessionRotatedEventPayloadSchema.js"
import { sessionEventTypes } from "../../sessions/events/sessionEventTypes.js"
import { sessionIssue } from "../../sessions/actions/sessionIssue.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import type { MfaChallengeCompleteRequest } from "../public/mfaChallengeCompleteRequestSchema.js"
import { mfaChallengeCompleteRequestSchema } from "../public/mfaChallengeCompleteRequestSchema.js"
import type { MfaLoginResponse } from "../public/mfaLoginResponseSchema.js"

type MfaChallengeCompleteOptions = {
  readonly actorId?: string | null
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: MfaChallengeCompleteRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
  readonly correlationId?: string
}

export function mfaChallengeComplete(options: MfaChallengeCompleteOptions): Result<MfaLoginResponse> {
  const op = "mfaChallengeComplete"
  const input = v.safeParse(mfaChallengeCompleteRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The MFA code is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The MFA timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) =>
    mfaChallengeCompleteTransaction({
      actorId: options.actorId,
      correlationId,
      database: transaction,
      encryptionSecret: options.encryptionSecret,
      input: input.output,
      instanceId: options.instanceId,
      now,
      runtime,
      sessionToken: options.sessionToken,
    }),
  )
}

type MfaChallengeCompleteTransactionOptions = {
  readonly actorId?: string | null
  readonly correlationId: string
  readonly database: Parameters<typeof mfaRepositoryCreate>[0]
  readonly encryptionSecret?: Secret | string
  readonly input: MfaChallengeCompleteRequest
  readonly instanceId: string
  readonly now: number
  readonly runtime: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionToken?: string
}

function mfaChallengeCompleteTransaction(options: MfaChallengeCompleteTransactionOptions): Result<MfaLoginResponse> {
  const op = "mfaChallengeComplete"
  const repository = mfaRepositoryCreate(options.database)
  const challenge = repository.mfaChallengeGetByTokenHash(
    options.instanceId,
    mfaChallengeTokenHashCreate(options.input.token),
  )
  if (!challenge.success) return challenge
  if (
    challenge.data === null ||
    challenge.data.consumedAt !== null ||
    challenge.data.expiresAt <= options.now ||
    challenge.data.attempts >= challenge.data.maxAttempts
  )
    return resultErrorCreate(op, "The MFA challenge is invalid.")
  if (challenge.data.purpose === "step_up" && options.sessionToken === undefined)
    return resultErrorCreate(op, "The MFA session is required.")
  const policyRow = repository.mfaPolicyGet(options.instanceId)
  if (!policyRow.success) return policyRow
  const policy = policyRow.data === null ? mfaPolicyDefaults : policyRow.data
  const currentLockout = repository.mfaLockoutGet(options.instanceId, challenge.data.userId)
  if (!currentLockout.success) return currentLockout
  if (
    currentLockout.data?.lockedUntil !== null &&
    currentLockout.data?.lockedUntil !== undefined &&
    currentLockout.data.lockedUntil > options.now
  )
    return resultErrorCreate(op, "The MFA code is invalid.")
  const active = repository.mfaEnrollmentActiveGet(options.instanceId, challenge.data.userId)
  if (!active.success) return active
  if (active.data === null) return resultErrorCreate(op, "The MFA challenge is invalid.")
  const secret = mfaTotpSecretProtect(
    "decrypt",
    active.data.encryptedSecret,
    options.instanceId,
    options.encryptionSecret,
  )
  if (!secret.success) return resultErrorCreate(op, "The MFA challenge is invalid.")
  const totp = mfaTotpCodeVerify(
    secret.data,
    options.input.code,
    options.now,
    policy.totpWindow,
    active.data.lastUsedStep,
  )
  let factor: "totp" | "recovery_code" | undefined
  let step: number | undefined
  let recoveryCodeId: string | undefined
  let recoveryCodeVersion: number | undefined
  if (totp.success) {
    factor = "totp"
    step = totp.data
  } else {
    const recovery = repository.mfaRecoveryCodeGet(
      options.instanceId,
      challenge.data.userId,
      mfaRecoveryCodeHashCreate(options.input.code),
    )
    if (!recovery.success) return recovery
    if (recovery.data !== null) {
      const consumed = repository.mfaRecoveryCodeConsume(
        options.instanceId,
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
    const updated = repository.mfaEnrollmentUpdate(
      options.instanceId,
      challenge.data.userId,
      active.data.id,
      active.data.version,
      {
        lastUsedStep: step,
        version: active.data.version + 1,
      },
    )
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The MFA code is invalid.")
  }
  if (factor === "recovery_code" && recoveryCodeId !== undefined && recoveryCodeVersion !== undefined) {
    const recoveryPayload = v.safeParse(mfaEventPayloadSchema, {
      factor: "recovery_code",
      userId: challenge.data.userId,
    })
    if (!recoveryPayload.success) return resultErrorCreate(op, "The MFA event payload is invalid.")
    const recoveryEvent = storageEventAppend(
      options.database,
      {
        actorId: options.actorId ?? challenge.data.userId,
        aggregateId: recoveryCodeId,
        aggregateType: "mfa_recovery_code",
        aggregateVersion: recoveryCodeVersion,
        commandIndex: 0,
        correlationId: options.correlationId,
        eventType: mfaEventTypes.recoveryCodeUsed,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: options.now,
        payload: recoveryPayload.output,
      },
      options.runtime,
    )
    if (!recoveryEvent.success) return recoveryEvent
  }
  const consumedChallenge = repository.mfaChallengeUpdate(
    options.instanceId,
    challenge.data.id,
    challenge.data.version,
    {
      consumedAt: options.now,
      version: challenge.data.version + 1,
    },
  )
  if (!consumedChallenge.success) return consumedChallenge
  if (consumedChallenge.data === null) return resultErrorCreate(op, "The MFA challenge is invalid.")
  const reset = repository.mfaLockoutSet({
    failedAttempts: 0,
    instanceId: options.instanceId,
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
  if (!completedPayload.success) return resultErrorCreate(op, "The MFA event payload is invalid.")
  const completedEvent = storageEventAppend(
    options.database,
    {
      actorId: options.actorId ?? challenge.data.userId,
      aggregateId: challenge.data.id,
      aggregateType: "mfa_challenge",
      aggregateVersion: consumedChallenge.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: mfaEventTypes.challengeCompleted,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "mfa" },
      occurredAt: options.now,
      payload: completedPayload.output,
    },
    options.runtime,
  )
  if (!completedEvent.success) return completedEvent
  const authentication = { authenticatedAt: options.now, instanceId: options.instanceId, userId: challenge.data.userId }
  if (challenge.data.purpose === "login") {
    const session = sessionIssue({
      actorId: options.actorId ?? challenge.data.userId,
      assurance: "multi_factor",
      authenticationMethod: challenge.data.primaryAuthenticationMethod as
        | "email_otp"
        | "external_identity"
        | "password"
        | "passkey",
      commandIndex: 1,
      correlationId: options.correlationId,
      deviceMetadata: {
        ...(challenge.data.deviceDescription === null ? {} : { description: challenge.data.deviceDescription }),
        ...(challenge.data.deviceFingerprint === null ? {} : { fingerprint: challenge.data.deviceFingerprint }),
        ...(challenge.data.ipAddress === null ? {} : { ipAddress: challenge.data.ipAddress }),
        ...(challenge.data.userAgent === null ? {} : { userAgent: challenge.data.userAgent }),
      },
      executor: options.database,
      instanceId: options.instanceId,
      mfaMethod: factor,
      runtime: options.runtime,
      userId: challenge.data.userId,
    })
    if (!session.success) return resultErrorCreate(op, "The multi-factor session could not be created.")
    return resultCreate({ authentication, session: session.data })
  }
  return mfaStepUpSessionRotate(options, challenge.data.sessionId!, factor, authentication)
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
  const updated = repository.mfaChallengeUpdate(options.instanceId, challengeId, expectedVersion, {
    attempts: nextAttempts,
    consumedAt,
    version: expectedVersion + 1,
  })
  if (!updated.success) return updated
  if (updated.data === null) return resultErrorCreate("mfaChallengeComplete", "The MFA challenge is invalid.")
  const lockout = repository.mfaLockoutGet(options.instanceId, userId)
  if (!lockout.success) return lockout
  const policy = repository.mfaPolicyGet(options.instanceId)
  if (!policy.success) return policy
  const maxAttemptsForUser = policy.data?.maxAttempts ?? mfaPolicyDefaults.maxAttempts
  const lockoutUpdated = repository.mfaLockoutSet({
    failedAttempts: nextAttempts,
    instanceId: options.instanceId,
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
  if (!payload.success) return resultErrorCreate("mfaChallengeComplete", "The MFA event payload is invalid.")
  const event = storageEventAppend(
    options.database,
    {
      actorId: userId,
      aggregateId: challengeId,
      aggregateType: "mfa_challenge",
      aggregateVersion: updated.data.version,
      commandIndex: 0,
      correlationId: options.correlationId,
      eventType: mfaEventTypes.challengeFailed,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "mfa" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultErrorCreate("mfaChallengeComplete", "The MFA code is invalid.")
}

function mfaStepUpSessionRotate(
  options: MfaChallengeCompleteTransactionOptions,
  sessionId: string,
  factor: "totp" | "recovery_code",
  authentication: MfaLoginResponse["authentication"],
): Result<MfaLoginResponse> {
  const op = "mfaChallengeComplete"
  if (options.sessionToken === undefined) return resultErrorCreate(op, "The MFA session is required.")
  const current = options.database
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.instanceId, options.instanceId),
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
    return resultErrorCreate(op, "The MFA session is invalid.")
  const nextToken = sessionCredentialCreate(options.runtime)
  const rotated = sessionRepositoryCreate(options.database).sessionAssuranceRotate(
    options.instanceId,
    current.id,
    current.tokenHash,
    sessionCredentialHashCreate(nextToken),
    options.now,
    current.version,
    current.version + 1,
    factor,
  )
  if (!rotated.success) return rotated
  if (rotated.data === null) return resultErrorCreate(op, "The MFA session is invalid.")
  const eventVersion = sessionRepositoryCreate(options.database).sessionEventVersionGet(options.instanceId, current.id)
  if (!eventVersion.success) return eventVersion
  const payload = v.safeParse(sessionRotatedEventPayloadSchema, { rotatedAt: options.now, sessionId: current.id })
  if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.")
  const event = storageEventAppend(
    options.database,
    {
      actorId: authentication.userId,
      aggregateId: current.id,
      aggregateType: "session",
      aggregateVersion: eventVersion.data + 1,
      commandIndex: 1,
      correlationId: options.correlationId,
      eventType: sessionEventTypes.rotated,
      instanceId: options.instanceId,
      metadata: { auditSafe: true, source: "sessions" },
      occurredAt: options.now,
      payload: payload.output,
    },
    options.runtime,
  )
  if (!event.success) return event
  return resultCreate({
    authentication,
    session: { session: sessionPublicViewCreate(rotated.data, true), token: nextToken },
  })
}
