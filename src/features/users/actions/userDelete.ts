import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userDeletedEventPayloadSchema } from "../events/userDeletedEventPayloadSchema.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"

type UserDeleteOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function userDelete(options: UserDeleteOptions): Result<{ user: User }> {
  const op = "userDelete"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.")
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) return resultErrorCreate(op, "The user timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const current = repository.userGet(options.realmId, options.userId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The user was not found.")
    if (current.data.state === "deleted") return resultErrorCreate(op, "The user has already been deleted.")
    const deleted = repository.userUpdate(options.realmId, options.userId, {
      deletedAt,
      state: "deleted",
      updatedAt: deletedAt,
      version: current.data.version + 1,
    })
    if (!deleted.success) return deleted
    if (deleted.data === null) return resultErrorCreate(op, "The user was not found.")
    const payload = v.safeParse(userDeletedEventPayloadSchema, { deletedAt })
    if (!payload.success) return resultErrorCreate(op, "The user deletion event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "user",
        aggregateVersion: deleted.data.version,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.deleted,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "users" },
        occurredAt: deletedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ user: userPublicViewCreate(deleted.data) })
  })
}
