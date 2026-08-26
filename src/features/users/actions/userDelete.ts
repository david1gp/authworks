import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userPictureObjectKeyFromPublicUrlCreate } from "../domain/userPictureObjectKeyFromPublicUrlCreate.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userDeletedEventPayloadSchema } from "../events/userDeletedEventPayloadSchema.js"
import { userEventTypes } from "../events/userEventTypes.js"
import { userProfilePictureCleanupRepositoryCreate } from "../persistence/userProfilePictureCleanupRepositoryCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"
import { userProfilePictureCleanupDrain } from "./userProfilePictureCleanupDrain.js"

type UserDeleteOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly profilePicturePublicOrigin?: string
  readonly profilePictureStorage?: R2ObjectStorage
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export async function userDelete(options: UserDeleteOptions): Promise<Result<{ user: User }>> {
  const op = "userDelete"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "users.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The user is not available in this tenant context.", "users.tenant-mismatch")
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0)
    return resultErrorCreate(op, "The user timestamp is invalid.", "users.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  const deleted = storageTransactionRun(options.database, (transaction) => {
    const repository = userRepositoryCreate(transaction)
    const current = repository.userGet(options.realmId, options.userId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The user was not found.", "users.not-found")
    if (current.data.state === "deleted")
      return resultErrorCreate(op, "The user has already been deleted.", "users.already-deleted")
    const deleted = repository.userUpdate(options.realmId, options.userId, {
      deletedAt,
      state: "deleted",
      updatedAt: deletedAt,
      version: current.data.version + 1,
    })
    if (!deleted.success) return deleted
    if (deleted.data === null) return resultErrorCreate(op, "The user was not found.", "users.not-found")
    const cleanup = userProfilePictureCleanupQueuePrevious({
      database: transaction,
      objectUrl: current.data.profile.pictureUrl,
      publicOrigin: options.profilePicturePublicOrigin,
      updatedAt: deletedAt,
      userName: current.data.userName,
    })
    if (!cleanup.success) return cleanup
    const payload = v.safeParse(userDeletedEventPayloadSchema, { deletedAt })
    if (!payload.success)
      return resultErrorCreate(op, "The user deletion event payload is invalid.", "users.event-invalid")
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
    return resultCreate({
      user: userPublicViewCreate(deleted.data),
    })
  })
  if (!deleted.success) return deleted
  await userProfilePictureCleanupDrain({
    database: options.database,
    publicOrigin: options.profilePicturePublicOrigin,
    storage: options.profilePictureStorage,
  })
  return resultCreate({ user: deleted.data.user })
}

function userProfilePictureCleanupQueuePrevious(options: {
  readonly database: Parameters<typeof userProfilePictureCleanupRepositoryCreate>[0]
  readonly objectUrl: string | null
  readonly publicOrigin?: string
  readonly updatedAt: number
  readonly userName: string
}): Result<void> {
  if (options.objectUrl === null || options.publicOrigin === undefined) return resultCreate(undefined)
  const key = userPictureObjectKeyFromPublicUrlCreate({
    publicOrigin: options.publicOrigin,
    url: options.objectUrl,
    userName: options.userName,
  })
  if (!key.success || key.data === undefined) return resultCreate(undefined)
  return userProfilePictureCleanupRepositoryCreate(options.database).userProfilePictureCleanupEnqueue({
    createdAt: options.updatedAt,
    objectKey: key.data,
  })
}
