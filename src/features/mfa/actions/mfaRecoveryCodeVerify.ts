import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { mfaRecoveryCodeHashCreate } from "../domain/mfaRecoveryCodeHashCreate.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaRecoveryCodeVerifyResponse } from "../public/mfaRecoveryCodeVerifyResponseSchema.js"

type MfaRecoveryCodeVerifyOptions = {
  readonly actorId?: string | null
  readonly code: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly correlationId?: string
}

export function mfaRecoveryCodeVerify(options: MfaRecoveryCodeVerifyOptions): Result<MfaRecoveryCodeVerifyResponse> {
  const op = "mfaRecoveryCodeVerify"
  if (!/^[A-Za-z0-9-]{8,64}$/.test(options.code))
    return resultErrorCreate(op, "The recovery code is invalid.", "mfa.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The recovery code timestamp is invalid.", "mfa.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const found = repository.mfaRecoveryCodeGet(
      options.realmId,
      options.userId,
      mfaRecoveryCodeHashCreate(options.code),
    )
    if (!found.success) return found
    if (found.data === null) return resultErrorCreate(op, "The recovery code is invalid.", "mfa.not-found")
    const consumed = repository.mfaRecoveryCodeConsume(options.realmId, found.data.id, found.data.version, now)
    if (!consumed.success) return consumed
    if (consumed.data === null) return resultErrorCreate(op, "The recovery code is invalid.", "mfa.not-found")
    const payload = v.safeParse(mfaEventPayloadSchema, { factor: "recovery_code", userId: options.userId })
    if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId,
        aggregateId: found.data.id,
        aggregateType: "mfa_recovery_code",
        aggregateVersion: consumed.data.version,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.recoveryCodeUsed,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ method: "recovery_code", verified: true })
  })
}
