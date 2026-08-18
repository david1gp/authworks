import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { and, eq } from "drizzle-orm"
import { realmBootstrapAdminTable } from "../../realms/persistence/realmBootstrapAdminTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { sessionCredentialCreate } from "../domain/sessionCredentialCreate.js"
import { sessionCredentialHashCreate } from "../domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import { sessionEventTypes } from "../events/sessionEventTypes.js"
import { sessionRotatedEventPayloadSchema } from "../events/sessionRotatedEventPayloadSchema.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import type { SessionCredentialResponse } from "../public/sessionCredentialResponseSchema.js"

type SessionRotateOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

export function sessionRotate(options: SessionRotateOptions): Result<SessionCredentialResponse> {
  const op = "sessionRotate"
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "Session rotation is invalid.")
  const nextToken = sessionCredentialCreate(runtime)
  const nextHash = sessionCredentialHashCreate(nextToken)
  const correlationId = uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = sessionRepositoryCreate(transaction)
    const current = repository.sessionGetByTokenHash(sessionCredentialHashCreate(options.token))
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.realmId !== options.realmId ||
      current.data.revokedAt !== null ||
      current.data.expiresAt <= now
    )
      return resultErrorCreate(op, "Session rotation is invalid.")
    const user = transaction
      .select({ state: userTable.state })
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, current.data.userId)))
      .get()
    if (user === undefined || user.state !== "active") return resultErrorCreate(op, "Session rotation is invalid.")
    if (current.data.impersonatorId !== null) {
      const impersonator = transaction
        .select({ id: userTable.id, state: userTable.state })
        .from(userTable)
        .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, current.data.impersonatorId)))
        .get()
      const bootstrap = transaction
        .select({ id: realmBootstrapAdminTable.adminId })
        .from(realmBootstrapAdminTable)
        .where(
          and(
            eq(realmBootstrapAdminTable.realmId, options.realmId),
            eq(realmBootstrapAdminTable.adminId, current.data.impersonatorId),
          ),
        )
        .get()
      if ((impersonator === undefined || impersonator.state !== "active") && bootstrap === undefined)
        return resultErrorCreate(op, "Session rotation is invalid.")
    }
    const rotated = repository.sessionRotate(
      options.realmId,
      current.data.id,
      current.data.tokenHash,
      nextHash,
      now,
      current.data.version,
      current.data.version + 1,
    )
    if (!rotated.success) return rotated
    if (rotated.data === null) return resultErrorCreate(op, "Session rotation is invalid.")
    const eventVersion = repository.sessionEventVersionGet(options.realmId, current.data.id)
    if (!eventVersion.success) return eventVersion
    const payload = v.safeParse(sessionRotatedEventPayloadSchema, { rotatedAt: now, sessionId: current.data.id })
    if (!payload.success) return resultErrorCreate(op, "The session event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: current.data.userId,
        aggregateId: current.data.id,
        aggregateType: "session",
        aggregateVersion: eventVersion.data + 1,
        commandIndex: 0,
        correlationId,
        eventType: sessionEventTypes.rotated,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "sessions" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ session: sessionPublicViewCreate(rotated.data, true), token: nextToken })
  })
}
