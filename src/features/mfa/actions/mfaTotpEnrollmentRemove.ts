import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { sessionCredentialHashCreate } from "../../sessions/domain/sessionCredentialHashCreate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import { mfaEventPayloadSchema } from "../events/mfaEventPayloadSchema.js"
import { mfaEventTypes } from "../events/mfaEventTypes.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaTotpEnrollmentRemoveResponse } from "../public/mfaTotpEnrollmentRemoveResponseSchema.js"

type MfaTotpEnrollmentRemoveOptions = {
  readonly actorId?: string | null
  readonly database: StorageDatabase
  readonly enrollmentId?: string
  readonly realmId: string
  readonly sessionToken: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function mfaTotpEnrollmentRemove(
  options: MfaTotpEnrollmentRemoveOptions,
): Result<MfaTotpEnrollmentRemoveResponse> {
  const op = "mfaTotpEnrollmentRemove"
  if (options.sessionToken.length === 0)
    return resultErrorCreate(op, "MFA step-up authorization is required.", "mfa.unauthorized")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The TOTP removal timestamp is invalid.", "mfa.invalid-timestamp")
  return storageTransactionRun(options.database, (transaction) => {
    const session = transaction
      .select()
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.realmId, options.realmId),
          eq(sessionTable.userId, options.userId),
          eq(sessionTable.tokenHash, sessionCredentialHashCreate(options.sessionToken)),
        ),
      )
      .get()
    if (
      session === undefined ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.assurance !== "multi_factor"
    )
      return resultErrorCreate(op, "MFA step-up authorization is required.", "mfa.unauthorized")
    const repository = mfaRepositoryCreate(transaction)
    const enrollment =
      options.enrollmentId === undefined
        ? repository.mfaEnrollmentActiveGet(options.realmId, options.userId)
        : repository.mfaEnrollmentGet(options.realmId, options.userId, options.enrollmentId)
    if (!enrollment.success) return enrollment
    if (enrollment.data === null || enrollment.data.status !== "active")
      return resultErrorCreate(op, "The TOTP enrollment was not found.", "mfa.not-found")
    const removed = repository.mfaEnrollmentDelete(
      options.realmId,
      options.userId,
      enrollment.data.id,
      enrollment.data.version,
    )
    if (!removed.success) return removed
    if (!removed.data) return resultErrorCreate(op, "The TOTP enrollment was not found.", "mfa.not-found")
    const payload = v.safeParse(mfaEventPayloadSchema, {
      enrollmentId: enrollment.data.id,
      factor: "totp",
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The MFA event payload is invalid.", "mfa.event-invalid")
    const event = eventSecurityEventAppend(
      transaction,
      {
        actorId: options.actorId ?? options.userId,
        aggregateId: enrollment.data.id,
        aggregateType: "mfa_totp_enrollment",
        aggregateVersion: enrollment.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: mfaEventTypes.totpRemoved,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "mfa" },
        occurredAt: now,
        payload: payload.output,
        userSubjectId: options.userId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true })
  })
}
