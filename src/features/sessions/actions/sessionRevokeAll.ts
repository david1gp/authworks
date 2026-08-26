import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { eventSecurityEventAppend } from "../../events/server/eventSecurityEventAppend.js"
import { eventSecurityUnindexedEventAppend } from "../../events/server/eventSecurityUnindexedEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { sessionEventTypes } from "../events/sessionEventTypes.js"
import { sessionRevokedEventPayloadSchema } from "../events/sessionRevokedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionRevocationResponse } from "../public/sessionRevocationResponseSchema.js"
import type { SessionSubjectType } from "../public/sessionSubjectTypeSchema.js"

type SessionRevokeAllOptions = {
  readonly database: StorageDatabase
  readonly exceptSessionId?: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly subjectType?: SessionSubjectType
  readonly userId: string
}

export function sessionRevokeAll(options: SessionRevokeAllOptions): Result<SessionRevocationResponse> {
  const op = "sessionRevokeAll"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The session timestamp is invalid.", "sessions.invalid-timestamp")
  const correlationId = uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = sessionRepositoryCreate(transaction)
    const sessions = repository.sessionList(options.realmId, options.userId, undefined, options.subjectType)
    if (!sessions.success) return sessions
    let revoked = false
    let commandIndex = 0
    for (const session of sessions.data) {
      if (session.revokedAt !== null || session.id === options.exceptSessionId) continue
      const updated = repository.sessionVersionUpdate(options.realmId, session.id, session.version, {
        revocationReason: "user_requested_all",
        revokedAt: now,
        version: session.version + 1,
      })
      if (!updated.success) return updated
      if (updated.data === null)
        return resultErrorCreate(op, "The sessions could not be revoked.", "sessions.write-failed")
      const eventVersion = repository.sessionEventVersionGet(options.realmId, session.id)
      if (!eventVersion.success) return eventVersion
      const payload = v.safeParse(sessionRevokedEventPayloadSchema, {
        reason: "user_requested_all",
        revokedAt: now,
        sessionId: session.id,
      })
      if (!payload.success)
        return resultErrorCreate(op, "The session event payload is invalid.", "sessions.event-invalid")
      const eventInput = {
        actorId: options.userId,
        aggregateId: session.id,
        aggregateType: "session" as const,
        aggregateVersion: eventVersion.data + 1,
        commandIndex,
        correlationId,
        eventType: sessionEventTypes.revokedAll,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "sessions" },
        occurredAt: now,
        payload: payload.output,
      }
      const event =
        session.subjectType === "user"
          ? eventSecurityEventAppend(transaction, { ...eventInput, userSubjectId: session.subjectId }, runtime)
          : eventSecurityUnindexedEventAppend(
              transaction,
              { ...eventInput, unindexedReason: "bootstrap_admin_session" },
              runtime,
            )
      if (!event.success) return event
      revoked = true
      commandIndex += 1
    }
    return resultCreate({ revoked })
  })
}
