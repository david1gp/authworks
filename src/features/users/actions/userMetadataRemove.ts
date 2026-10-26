import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userMetadataRemovedEventPayloadSchema } from "../events/userMetadataRemovedEventPayloadSchema.js"
import { userMetadataRepositoryCreate } from "../persistence/userMetadataRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import { userMetadataKeySchema } from "../public/userMetadataKeySchema.js"
import { userMetadataAuthorize } from "./userMetadataAuthorize.js"

type UserMetadataRemoveOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly key: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
  readonly correlationId?: string
}

export function userMetadataRemove(options: UserMetadataRemoveOptions): Result<{ removed: true }> {
  const op = "userMetadataRemove"
  if (!v.safeParse(userMetadataKeySchema, options.key).success)
    return resultErrorCreate(op, "The metadata key is invalid.", "users.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted")
    return resultErrorCreate(op, "The user was not found.", "users.not-found")
  const authorized = userMetadataAuthorize({
    allowSelfRead: false,
    context: options.context,
    database: options.database,
    permission: "user.manage",
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The metadata timestamp is invalid.", "users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = userMetadataRepositoryCreate(transaction)
    const removed = repository.userMetadataDelete(options.realmId, options.userId, options.key)
    if (!removed.success) return removed
    if (removed.data === null) return resultErrorCreate(op, "The user metadata was not found.", "users.not-found")
    const payload = v.safeParse(userMetadataRemovedEventPayloadSchema, {
      key: options.key,
      userId: options.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The metadata event payload is invalid.", "users.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.userId,
        aggregateType: "user_metadata",
        aggregateVersion: removed.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: userEventTypes.metadataRemoved,
        metadata: { source: "users" },
        occurredAt: now,
        payload: payload.output,
        realmId: options.realmId,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true as const })
  })
}
