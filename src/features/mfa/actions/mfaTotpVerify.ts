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
import { mfaTotpSecretProtect } from "../domain/mfaTotpSecretProtect.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaTotpVerifyResponse } from "../public/mfaTotpVerifyResponseSchema.js"

type MfaTotpVerifyOptions = {
  readonly actorId?: string | null
  readonly code: string
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly correlationId?: string
}

export function mfaTotpVerify(options: MfaTotpVerifyOptions): Result<MfaTotpVerifyResponse> {
  const op = "mfaTotpVerify"
  if (!/^\d{6}$/.test(options.code)) return resultErrorCreate(op, "The TOTP code is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const enrollment = repository.mfaEnrollmentActiveGet(options.instanceId, options.userId)
    if (!enrollment.success) return enrollment
    if (enrollment.data === null) return resultErrorCreate(op, "The TOTP code is invalid.")
    const policy = repository.mfaPolicyGet(options.instanceId)
    if (!policy.success) return policy
    const settings = policy.data ?? mfaPolicyDefaults
    const lockout = repository.mfaLockoutGet(options.instanceId, options.userId)
    if (!lockout.success) return lockout
    if (lockout.data?.lockedUntil !== null && lockout.data?.lockedUntil !== undefined && lockout.data.lockedUntil > now)
      return resultErrorCreate(op, "The TOTP code is invalid.")
    const secret = mfaTotpSecretProtect(
      "decrypt",
      enrollment.data.encryptedSecret,
      options.instanceId,
      options.encryptionSecret,
    )
    if (!secret.success) return resultErrorCreate(op, "The TOTP code is invalid.")
    const verified = mfaTotpCodeVerify(
      secret.data,
      options.code,
      now,
      settings.totpWindow,
      enrollment.data.lastUsedStep,
    )
    if (!verified.success) {
      const attempts = (lockout.data?.failedAttempts ?? 0) + 1
      const saved = repository.mfaLockoutSet({
        failedAttempts: attempts,
        instanceId: options.instanceId,
        lockedUntil: attempts >= settings.maxAttempts ? now + settings.lockoutDurationMs : null,
        updatedAt: now,
        userId: options.userId,
        version: (lockout.data?.version ?? 0) + 1,
      })
      if (!saved.success) return saved
      return resultErrorCreate(op, "The TOTP code is invalid.")
    }
    const updated = repository.mfaEnrollmentUpdate(
      options.instanceId,
      options.userId,
      enrollment.data.id,
      enrollment.data.version,
      {
        lastUsedStep: verified.data,
        version: enrollment.data.version + 1,
      },
    )
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The TOTP code is invalid.")
    const reset = repository.mfaLockoutSet({
      failedAttempts: 0,
      instanceId: options.instanceId,
      lockedUntil: null,
      updatedAt: now,
      userId: options.userId,
      version: (lockout.data?.version ?? 0) + 1,
    })
    if (!reset.success) return reset
    const payload = v.safeParse(mfaEventPayloadSchema, {
      enrollmentId: enrollment.data.id,
      factor: "totp",
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId,
        aggregateId: enrollment.data.id,
        aggregateType: "mfa_totp_enrollment",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.totpVerified,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ method: "totp", verified: true })
  })
}
