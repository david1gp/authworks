import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { sessionEventTypes } from "../events/sessionEventTypes.js"
import { sessionRevokedEventPayloadSchema } from "../events/sessionRevokedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionRevocationResponse } from "../public/sessionRevocationResponseSchema.js"
import { impersonationEndedEventPayloadSchema } from "../../impersonation/events/impersonationEndedEventPayloadSchema.js"
import { impersonationEventTypes } from "../../impersonation/events/impersonationEventTypes.js"
import { and, desc, eq } from "drizzle-orm"

type SessionRevokeOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly reason?: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionId: string
  readonly userId: string
}

export function sessionRevoke(options: SessionRevokeOptions): Result<SessionRevocationResponse> {
  const op = "sessionRevoke"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "The session timestamp is invalid.")
  const reason = options.reason ?? "user_requested"
  if (reason.length === 0 || reason.length > 128)
    return resultErrorCreate(op, "The session revocation reason is invalid.")
  const correlationId = uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = sessionRepositoryCreate(transaction)
    const current = repository.sessionGet(options.realmId, options.sessionId)
    if (!current.success) return current
    if (current.data === null || current.data.userId !== options.userId)
      return resultErrorCreate(op, "The session was not found.")
    if (current.data.revokedAt !== null) return resultCreate<SessionRevocationResponse>({ revoked: false })
    const revoked = repository.sessionVersionUpdate(options.realmId, options.sessionId, current.data.version, {
      revocationReason: reason,
      revokedAt: now,
      version: current.data.version + 1,
    })
    if (!revoked.success) return revoked
    if (revoked.data === null) return resultErrorCreate(op, "The session was not found.")
    const eventVersion = repository.sessionEventVersionGet(options.realmId, options.sessionId)
    if (!eventVersion.success) return eventVersion
    const payload = v.safeParse(sessionRevokedEventPayloadSchema, {
      reason,
      revokedAt: now,
      sessionId: options.sessionId,
    })
    if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.userId,
        aggregateId: options.sessionId,
        aggregateType: "session",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: sessionEventTypes.revoked,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "sessions" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    if (current.data.impersonatorId !== null) {
      const impersonationVersion = transaction
        .select({ aggregateVersion: storageEventTable.aggregateVersion })
        .from(storageEventTable)
        .where(
          and(
            eq(storageEventTable.aggregateType, "impersonation"),
            eq(storageEventTable.aggregateId, options.sessionId),
          ),
        )
        .orderBy(desc(storageEventTable.aggregateVersion))
        .get()?.aggregateVersion
      if (impersonationVersion === undefined)
        return resultErrorCreate(op, "The impersonation audit event was not found.")
      const endedPayload = v.safeParse(impersonationEndedEventPayloadSchema, {
        actorId: current.data.impersonatorId,
        endedAt: now,
        endedById: options.userId,
        realmId: options.realmId,
        ...(current.data.impersonationOrganizationId === null
          ? {}
          : { organizationId: current.data.impersonationOrganizationId }),
        sessionId: options.sessionId,
        subjectId: current.data.userId,
      })
      if (!endedPayload.success) return resultErrorCreate(op, "The impersonation event payload is invalid.")
      const endedEvent = storageEventAppend(
        transaction,
        {
          actorId: options.userId,
          aggregateId: options.sessionId,
          aggregateType: "impersonation",
          aggregateVersion: impersonationVersion + 1,
          commandIndex: 1,
          correlationId,
          eventType: impersonationEventTypes.ended,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "impersonation" },
          occurredAt: now,
          payload: endedPayload.output,
        },
        runtime,
      )
      if (!endedEvent.success) return endedEvent
    }
    return resultCreate<SessionRevocationResponse>({ revoked: true })
  })
}
