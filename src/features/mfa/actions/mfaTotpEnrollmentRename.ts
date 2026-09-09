import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { mfaTotpEnrollmentViewCreate } from "../domain/mfaTotpEnrollmentViewCreate.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaTotpEnrollmentRenameRequest } from "../public/mfaTotpEnrollmentRenameRequestSchema.js"
import { mfaTotpEnrollmentRenameRequestSchema } from "../public/mfaTotpEnrollmentRenameRequestSchema.js"
import type { MfaTotpEnrollmentRenameResponse } from "../public/mfaTotpEnrollmentRenameResponseSchema.js"

type MfaTotpEnrollmentRenameOptions = {
  readonly actorId?: string | null
  readonly correlationId?: string
  readonly database: StorageDatabase
  readonly input: MfaTotpEnrollmentRenameRequest
  readonly enrollmentId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}

export function mfaTotpEnrollmentRename(
  options: MfaTotpEnrollmentRenameOptions,
): Result<MfaTotpEnrollmentRenameResponse> {
  const op = "mfaTotpEnrollmentRename"
  const input = v.safeParse(mfaTotpEnrollmentRenameRequestSchema, options.input)
  if (!input.success) return resultErrorCreate(op, "The TOTP enrollment label is invalid.", "mfa.invalid")
  if (options.enrollmentId.length === 0)
    return resultErrorCreate(op, "The TOTP enrollment was not found.", "mfa.not-found")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The TOTP rename timestamp is invalid.", "mfa.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = mfaRepositoryCreate(transaction)
    const enrollment = repository.mfaEnrollmentGet(options.realmId, options.userId, options.enrollmentId)
    if (!enrollment.success) return enrollment
    if (enrollment.data === null) return resultErrorCreate(op, "The TOTP enrollment was not found.", "mfa.not-found")
    if (enrollment.data.status !== "active")
      return resultErrorCreate(op, "The TOTP enrollment is not active.", "mfa.not-active")
    if (enrollment.data.label === input.output.label)
      return resultCreate({ enrollment: mfaTotpEnrollmentViewCreate(enrollment.data) })

    const updated = repository.mfaEnrollmentUpdate(
      options.realmId,
      options.userId,
      enrollment.data.id,
      enrollment.data.version,
      { label: input.output.label, version: enrollment.data.version + 1 },
    )
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The TOTP enrollment is stale.", "mfa.conflict")

    const payload = v.safeParse(mfaEventPayloadSchema, {
      enrollmentId: updated.data.id,
      label: updated.data.label,
      previousLabel: enrollment.data.label,
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId,
        aggregateId: updated.data.id,
        aggregateType: "mfa_totp_enrollment",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.totpRenamed,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ enrollment: mfaTotpEnrollmentViewCreate(updated.data) })
  })
}
