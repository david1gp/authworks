import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaTotpCodeVerify } from "../domain/mfaTotpCodeVerify.js"
import { mfaTotpEnrollmentViewCreate } from "../domain/mfaTotpEnrollmentViewCreate.js"
import { mfaTotpSecretProtect } from "../domain/mfaTotpSecretProtect.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaTotpEnrollmentConfirmRequest } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { mfaTotpEnrollmentConfirmRequestSchema } from "../public/mfaTotpEnrollmentConfirmRequestSchema.js"
import type { MfaTotpEnrollmentConfirmResponse } from "../public/mfaTotpEnrollmentConfirmResponseSchema.js"

type MfaTotpEnrollmentConfirmOptions = {
  readonly actorId?: string | null
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: MfaTotpEnrollmentConfirmRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly correlationId?: string
}

export function mfaTotpEnrollmentConfirm(
  options: MfaTotpEnrollmentConfirmOptions,
): Result<MfaTotpEnrollmentConfirmResponse> {
  const op = "mfaTotpEnrollmentConfirm"
  const input = v.safeParse(mfaTotpEnrollmentConfirmRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The TOTP code is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The TOTP confirmation timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const enrollment = repository.mfaEnrollmentGet(options.realmId, options.userId, input.output.enrollmentId)
    if (!enrollment.success) return enrollment
    if (enrollment.data === null || enrollment.data.status !== "pending")
      return resultErrorCreate(op, "The TOTP enrollment is invalid.")
    const policyRow = repository.mfaPolicyGet(options.realmId)
    if (!policyRow.success) return policyRow
    const policy = policyRow.data === null ? mfaPolicyDefaults : policyRow.data
    const lockout = repository.mfaLockoutGet(options.realmId, options.userId)
    if (!lockout.success) return lockout
    if (lockout.data?.lockedUntil !== null && lockout.data?.lockedUntil !== undefined && lockout.data.lockedUntil > now)
      return resultErrorCreate(op, "The TOTP code is invalid.")
    const secret = mfaTotpSecretProtect(
      "decrypt",
      enrollment.data.encryptedSecret,
      options.realmId,
      options.encryptionSecret,
    )
    if (!secret.success) return resultErrorCreate(op, "The TOTP enrollment is invalid.")
    const step = mfaTotpCodeVerify(secret.data, input.output.code, now, policy.totpWindow)
    if (!step.success) {
      const attempts = (lockout.data?.failedAttempts ?? 0) + 1
      const locked = attempts >= policy.maxAttempts
      const savedLockout = repository.mfaLockoutSet({
        failedAttempts: attempts,
        realmId: options.realmId,
        lockedUntil: locked ? now + policy.lockoutDurationMs : null,
        updatedAt: now,
        userId: options.userId,
        version: (lockout.data?.version ?? 0) + 1,
      })
      if (!savedLockout.success) return savedLockout
      const payload = v.safeParse(mfaEventPayloadSchema, {
        attempts,
        enrollmentId: enrollment.data.id,
        factor: "totp",
        locked,
        userId: options.userId,
      })
      if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.")
      const event = storageEventAppend(
        transaction,
        {
          actorId: options.actorId,
          aggregateId: options.userId,
          aggregateType: "mfa_lockout",
          aggregateVersion: savedLockout.data.version,
          commandIndex: 0,
          correlationId,
          eventType: mfaEventTypes.challengeFailed,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "mfa" },
          occurredAt: now,
          payload: payload.output,
        },
        runtime,
      )
      if (!event.success) return event
      return resultErrorCreate(op, "The TOTP code is invalid.")
    }
    const updated = repository.mfaEnrollmentUpdate(
      options.realmId,
      options.userId,
      enrollment.data.id,
      enrollment.data.version,
      {
        confirmedAt: now,
        lastUsedStep: step.data,
        status: "active",
        version: enrollment.data.version + 1,
      },
    )
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The TOTP enrollment is invalid.")
    const reset = repository.mfaLockoutSet({
      failedAttempts: 0,
      realmId: options.realmId,
      lockedUntil: null,
      updatedAt: now,
      userId: options.userId,
      version: (lockout.data?.version ?? 0) + 1,
    })
    if (!reset.success) return reset
    const payload = v.safeParse(mfaEventPayloadSchema, {
      enrollmentId: updated.data.id,
      factor: "totp",
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.actorId,
        aggregateId: updated.data.id,
        aggregateType: "mfa_totp_enrollment",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.totpEnrollmentConfirmed,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ enrollment: mfaTotpEnrollmentViewCreate(updated.data) })
  })
}
