import { and, desc, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { sessionEventTypes } from "../../sessions/events/sessionEventTypes.js"
import { sessionRevokedEventPayloadSchema } from "../../sessions/events/sessionRevokedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../../sessions/persistence/sessionRepositoryCreate.js"
import { impersonationEndedEventPayloadSchema } from "../events/impersonationEndedEventPayloadSchema.js"
import { impersonationEventTypes } from "../events/impersonationEventTypes.js"
import type { ImpersonationSecurityNotification } from "../public/impersonationSecurityNotificationSchema.js"
import type { ImpersonationEndResponse } from "../public/impersonationEndResponseSchema.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"

type ImpersonationEndOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly onSecurityNotification?: (notification: ImpersonationSecurityNotification) => void | Promise<void>
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sessionId: string
}

type ImpersonationEndCommit = {
  readonly notification?: ImpersonationSecurityNotification
  readonly response: ImpersonationEndResponse
}

export function impersonationEnd(options: ImpersonationEndOptions): Result<ImpersonationEndResponse> {
  const op = "impersonationEnd"
  if (options.realmId.length === 0 || options.sessionId.length === 0)
    return resultErrorCreate(op, "The impersonation session is invalid.", "impersonation.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The impersonation timestamp is invalid.", "impersonation.invalid-timestamp")
  const correlationId = uuidv7Create(runtime)
  const committed = storageTransactionRun(options.database, (transaction) => {
    const repository = sessionRepositoryCreate(transaction)
    const current = repository.sessionGet(options.realmId, options.sessionId)
    if (!current.success) return current
    if (current.data === null || current.data.impersonatorId === null)
      return resultErrorCreate(op, "The impersonation session was not found.", "impersonation.not-found")
    const isImpersonator =
      options.actor.actorId === current.data.impersonatorId && options.actor.impersonatorId === undefined
    const isSubject =
      options.actor.actorId === current.data.userId &&
      options.actor.impersonationSessionId === options.sessionId &&
      options.actor.impersonatorId === current.data.impersonatorId
    if (!isImpersonator && !isSubject)
      return resultErrorCreate(op, "The actor is not authorized to end this impersonation.", "authorization.forbidden")
    if (current.data.revokedAt !== null)
      return resultCreate<ImpersonationEndCommit>({ response: { ended: false, sessionId: options.sessionId } })
    const revoked = repository.sessionVersionUpdate(options.realmId, options.sessionId, current.data.version, {
      revokedAt: now,
      revocationReason: "impersonation_ended",
      version: current.data.version + 1,
    })
    if (!revoked.success) return revoked
    if (revoked.data === null)
      return resultErrorCreate(op, "The impersonation session was not found.", "impersonation.not-found")
    const sessionVersion = repository.sessionEventVersionGet(options.realmId, options.sessionId)
    if (!sessionVersion.success) return sessionVersion
    const revokedPayload = v.safeParse(sessionRevokedEventPayloadSchema, {
      reason: "impersonation_ended",
      revokedAt: now,
      sessionId: options.sessionId,
    })
    if (!revokedPayload.success)
      return resultErrorCreate(op, "The session event payload is invalid.", "impersonation.event-invalid")
    const revokedEvent = storageEventAppend(
      transaction,
      {
        actorId: options.actor.actorId,
        aggregateId: options.sessionId,
        aggregateType: "session",
        aggregateVersion: sessionVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: sessionEventTypes.revoked,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "sessions" },
        occurredAt: now,
        payload: revokedPayload.output,
      },
      runtime,
    )
    if (!revokedEvent.success) return revokedEvent
    const impersonationVersion = transaction
      .select({ aggregateVersion: storageEventTable.aggregateVersion })
      .from(storageEventTable)
      .where(
        and(eq(storageEventTable.aggregateType, "impersonation"), eq(storageEventTable.aggregateId, options.sessionId)),
      )
      .orderBy(desc(storageEventTable.aggregateVersion))
      .get()?.aggregateVersion
    if (impersonationVersion === undefined)
      return resultErrorCreate(op, "The impersonation audit event was not found.", "impersonation.not-found")
    const endedPayload = v.safeParse(impersonationEndedEventPayloadSchema, {
      actorId: current.data.impersonatorId,
      endedAt: now,
      endedById: options.actor.actorId,
      realmId: options.realmId,
      ...(current.data.impersonationOrganizationId === null
        ? {}
        : { organizationId: current.data.impersonationOrganizationId }),
      sessionId: options.sessionId,
      subjectId: current.data.userId,
    })
    if (!endedPayload.success)
      return resultErrorCreate(op, "The impersonation event payload is invalid.", "impersonation.event-invalid")
    const endedEvent = storageEventAppend(
      transaction,
      {
        actorId: options.actor.actorId,
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
    return resultCreate<ImpersonationEndCommit>({
      notification: {
        actorId: current.data.impersonatorId,
        endedById: options.actor.actorId,
        realmId: options.realmId,
        kind: "ended",
        ...(current.data.impersonationOrganizationId === null
          ? {}
          : { organizationId: current.data.impersonationOrganizationId }),
        sessionId: options.sessionId,
        subjectId: current.data.userId,
      },
      response: { ended: true, sessionId: options.sessionId },
    })
  })
  if (!committed.success) return committed
  if (committed.data.notification !== undefined)
    impersonationSecurityNotificationInvoke(options.onSecurityNotification, committed.data.notification)
  return resultCreate(committed.data.response)
}

function impersonationSecurityNotificationInvoke(
  port: ((value: ImpersonationSecurityNotification) => void | Promise<void>) | undefined,
  value: ImpersonationSecurityNotification,
): void {
  if (port === undefined) return
  try {
    void Promise.resolve(port(value)).catch(() => undefined)
  } catch (_error) {}
}
