import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { mfaRecoveryCodeCreate } from "../domain/mfaRecoveryCodeCreate.js"
import { mfaRecoveryCodeHashCreate } from "../domain/mfaRecoveryCodeHashCreate.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaRecoveryCodesResponse } from "../public/mfaRecoveryCodesResponseSchema.js"

const mfaRecoveryCodeCount = 10

type MfaRecoveryCodesGenerateOptions = {
  readonly actorId?: string | null
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly correlationId?: string
}

export function mfaRecoveryCodesGenerate(options: MfaRecoveryCodesGenerateOptions): Result<MfaRecoveryCodesResponse> {
  const op = "mfaRecoveryCodesGenerate"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The recovery code timestamp is invalid.", "mfa.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const active = repository.mfaEnrollmentActiveGet(options.realmId, options.userId)
    if (!active.success) return active
    if (active.data === null) return resultErrorCreate(op, "An active TOTP enrollment is required.", "mfa.not-found")
    const deleted = repository.mfaRecoveryCodesDelete(options.realmId, options.userId)
    if (!deleted.success) return deleted
    const codes: string[] = []
    const hashes = new Set<string>()
    while (codes.length < mfaRecoveryCodeCount) {
      const code = mfaRecoveryCodeCreate(runtime)
      if (!code.success) return code
      const hash = mfaRecoveryCodeHashCreate(code.data)
      if (hashes.has(hash)) continue
      hashes.add(hash)
      codes.push(code.data)
    }
    for (const code of codes) {
      const created = repository.mfaRecoveryCodeCreate({
        codeHash: mfaRecoveryCodeHashCreate(code),
        consumedAt: null,
        createdAt: now,
        id: uuidv7Create(runtime),
        realmId: options.realmId,
        userId: options.userId,
        version: 1,
      })
      if (!created.success) return created
    }
    const payload = v.safeParse(mfaEventPayloadSchema, { codeCount: codes.length, userId: options.userId })
    if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
    const eventVersion = repository.mfaEventVersionGet(options.realmId, "mfa_recovery_codes", options.userId)
    if (!eventVersion.success) return eventVersion
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId,
        aggregateId: options.userId,
        aggregateType: "mfa_recovery_codes",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.recoveryCodesGenerated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ codes, generatedAt: now })
  })
}
